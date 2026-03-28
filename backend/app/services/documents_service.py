import re
import threading
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from langchain_community.embeddings import FastEmbedEmbeddings
from langchain_qdrant import QdrantVectorStore
from qdrant_client.http import models

from app.core.config import settings
from app.database.connections import qdrant_client
from app.models import DocumentModel
from app.repositories import DocumentsRepository
from app.schemas import (
    DocumentCategory,
    DocumentFavoriteResponse,
    DocumentSearchResponse,
    DocumentSearchResult,
    DocumentOut,
    DocumentStatus,
    ImportDocumentResponse,
    IndexManyResponse,
)
from app.services.indexing import (
    index_document_by_id,
    index_pending_documents,
    list_qdrant_points_for_document,
    qdrant_collection_stats,
    qdrant_health,
)

_documents_repo = DocumentsRepository()
_embeddings = None
_vector_store = None


def _get_embeddings():
    global _embeddings
    if _embeddings is None:
        _embeddings = FastEmbedEmbeddings(model_name=settings.embedding_model)
    return _embeddings


def _get_vector_store():
    global _vector_store
    if _vector_store is None:
        _vector_store = QdrantVectorStore(
            client=qdrant_client,
            collection_name=settings.qdrant_collection_name,
            embedding=_get_embeddings(),
        )
    return _vector_store


def validate_document_extension(filename: str) -> str:
    extension = Path(filename).suffix.lower()
    if extension not in settings.allowed_extensions:
        allowed = ", ".join(settings.allowed_extensions)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Type de fichier non supporte. Autorises: {allowed}",
        )
    return extension


def list_active_documents() -> list[DocumentOut]:
    return [model.to_out_schema() for model in _documents_repo.list_active_documents()]


def import_document_and_index(
    *,
    file: UploadFile,
    title: str,
    category: DocumentCategory,
    description: str = "",
    realized_at: datetime | None = None,
) -> ImportDocumentResponse:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nom de fichier manquant.")
    if not title.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Le titre est obligatoire.")
    if realized_at is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Date de realisation obligatoire.")

    validate_document_extension(file.filename)
    settings.uploads_path.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid4().hex}_{Path(file.filename).name}"
    destination = settings.uploads_path / safe_name
    payload = file.file.read()
    destination.write_bytes(payload)

    existing_doc = _documents_repo.find_active_by_title_and_category(title=title, category=category.value)
    if existing_doc and existing_doc.id:
        document_id = existing_doc.id
        _documents_repo.update_document_import_payload(
            document_id,
            file_path=str(destination),
            file_size=len(payload),
            file_type=file.content_type or "application/octet-stream",
            description=description,
            realized_at=realized_at,
        )
    else:
        model = DocumentModel.new_processing(
            title=title,
            category=category.value,
            description=description,
            realized_at=realized_at,
            file_path=str(destination),
            file_size=len(payload),
            file_type=file.content_type or "application/octet-stream",
        )
        document_id = _documents_repo.create_document(model)

    try:
        chunks_count = index_document_by_id(document_id)
        return ImportDocumentResponse(
            documentId=document_id,
            filename=file.filename,
            status=DocumentStatus.INDEXED,
            chunksCount=chunks_count,
        )
    except Exception as exc:
        return ImportDocumentResponse(
            documentId=document_id,
            filename=file.filename,
            status=DocumentStatus.FAILED,
            chunksCount=0,
            error=str(exc),
        )


def _index_document_async(document_id: str) -> None:
    try:
        index_document_by_id(document_id)
    except Exception:
        # The indexing service already stores FAILED status and error details.
        return


def import_document_and_schedule_index(
    *,
    file: UploadFile,
    title: str,
    category: DocumentCategory,
    description: str = "",
    realized_at: datetime | None = None,
) -> ImportDocumentResponse:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nom de fichier manquant.")
    if not title.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Le titre est obligatoire.")
    if realized_at is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Date de realisation obligatoire.")

    validate_document_extension(file.filename)
    settings.uploads_path.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid4().hex}_{Path(file.filename).name}"
    destination = settings.uploads_path / safe_name
    payload = file.file.read()
    destination.write_bytes(payload)

    existing_doc = _documents_repo.find_active_by_title_and_category(title=title, category=category.value)
    if existing_doc and existing_doc.id:
        document_id = existing_doc.id
        _documents_repo.update_document_import_payload(
            document_id,
            file_path=str(destination),
            file_size=len(payload),
            file_type=file.content_type or "application/octet-stream",
            description=description,
            realized_at=realized_at,
        )
    else:
        model = DocumentModel.new_processing(
            title=title,
            category=category.value,
            description=description,
            realized_at=realized_at,
            file_path=str(destination),
            file_size=len(payload),
            file_type=file.content_type or "application/octet-stream",
        )
        document_id = _documents_repo.create_document(model)

    threading.Thread(target=_index_document_async, args=(document_id,), daemon=True).start()

    return ImportDocumentResponse(
        documentId=document_id,
        filename=file.filename,
        status=DocumentStatus.PROCESSING,
        chunksCount=0,
        error=None,
    )


def delete_document_permanently(document_id: str) -> None:
    raw = _documents_repo.get_document_raw_by_id(document_id)
    if not raw:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document introuvable.")

    try:
        collections = qdrant_client.get_collections()
        names = {collection.name for collection in collections.collections}
        if settings.qdrant_collection_name in names:
            qdrant_client.delete(
                collection_name=settings.qdrant_collection_name,
                points_selector=models.FilterSelector(
                    filter=models.Filter(
                        must=[
                            models.FieldCondition(
                                key="metadata.document_id",
                                match=models.MatchValue(value=document_id),
                            )
                        ]
                    )
                ),
                wait=True,
            )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Suppression Qdrant impossible: %s" % (exc,),
        ) from exc

    raw = _documents_repo.hard_delete_document(document_id)

    file_path = raw.get("filePath")
    if isinstance(file_path, str) and file_path.strip():
        try:
            Path(file_path).unlink(missing_ok=True)
        except Exception:
            pass

    try:
        (settings.indexing_results_path / (document_id + ".txt")).unlink(missing_ok=True)
    except Exception:
        pass


def index_non_indexed_documents() -> IndexManyResponse:
    total, indexed, failed = index_pending_documents()
    return IndexManyResponse(total=total, indexed=indexed, failed=failed)


def index_single_document(document_id: str) -> dict[str, object]:
    chunks = index_document_by_id(document_id)
    return {"documentId": document_id, "status": DocumentStatus.INDEXED, "chunksCount": chunks}


def get_qdrant_health_status() -> dict[str, object]:
    return qdrant_health()


def get_qdrant_stats() -> dict[str, object]:
    return qdrant_collection_stats()


def get_document_points(document_id: str, limit: int = 100) -> dict[str, object]:
    points = list_qdrant_points_for_document(document_id=document_id, limit=limit)
    return {"documentId": document_id, "count": len(points), "points": points}


def _split_search_terms(query: str) -> list[str]:
    raw_terms = [term for term in re.split(r"\s+", query.strip()) if term]
    return raw_terms[:6]


def _parse_date_start(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value).replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _parse_date_end(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value).replace(tzinfo=timezone.utc)
        return parsed.replace(hour=23, minute=59, second=59, microsecond=999999)
    except ValueError:
        return None


def _matches_filters(
    item: DocumentSearchResult,
    *,
    category: DocumentCategory | None,
    date_from: datetime | None,
    date_to: datetime | None,
) -> bool:
    if category is not None and item.category != category:
        return False

    item_date = item.realizedAt or item.createdAt
    if (date_from or date_to) and item_date is None:
        return False
    if item_date is not None:
        if date_from is not None and item_date < date_from:
            return False
        if date_to is not None and item_date > date_to:
            return False
    return True


def _sort_results(items: list[DocumentSearchResult], sort_field: str, sort_dir: str) -> list[DocumentSearchResult]:
    reverse = sort_dir.lower() != "asc"

    if sort_field == "title":
        return sorted(items, key=lambda doc: (doc.title or "").lower(), reverse=reverse)

    def sort_key(doc: DocumentSearchResult) -> float:
        value = doc.realizedAt or doc.createdAt
        if value is None:
            return 0.0
        return value.timestamp()

    return sorted(items, key=sort_key, reverse=reverse)


def _contains_terms(text: str, terms: list[str]) -> bool:
    if not terms:
        return True
    lowered = text.lower()
    return any(term.lower() in lowered for term in terms)


def _build_excerpt(content: str, terms: list[str], max_len: int = 240) -> str:
    if not content:
        return ""
    clean = " ".join(content.split())
    if not terms:
        return clean[:max_len] + ("..." if len(clean) > max_len else "")

    lower = clean.lower()
    match_index = None
    match_len = 0
    for term in terms:
        idx = lower.find(term.lower())
        if idx != -1:
            match_index = idx
            match_len = len(term)
            break

    if match_index is None:
        return clean[:max_len] + ("..." if len(clean) > max_len else "")

    start = max(0, match_index - 80)
    end = min(len(clean), match_index + match_len + 140)
    snippet = clean[start:end].strip()
    if start > 0:
        snippet = f"...{snippet}"
    if end < len(clean):
        snippet = f"{snippet}..."
    return snippet


def _search_documents_qdrant(
    *,
    query: str,
    page: int,
    limit: int,
    terms: list[str],
    category: DocumentCategory | None,
    date_from: datetime | None,
    date_to: datetime | None,
    sort_field: str,
    sort_dir: str,
) -> DocumentSearchResponse:
    results: dict[str, DocumentSearchResult] = {}
    ordered_ids: list[str] = []
    fetch_k = max(page * limit * 8, 200)

    scored = _get_vector_store().similarity_search_with_score(query, k=fetch_k)
    for doc, _score in scored:
        content = doc.page_content or ""
        if terms and not _contains_terms(content, terms):
            continue
        metadata = doc.metadata or {}
        document_id = str(metadata.get("document_id", "")).strip()
        if not document_id or document_id in results:
            continue
        title = str(metadata.get("title", "Document ministeriel"))
        category_raw = str(metadata.get("category", ""))
        excerpt = _build_excerpt(content, terms)

        try:
            item_category = DocumentCategory(category_raw)
        except Exception:
            item_category = DocumentCategory.LOI_DES_FINANCES

        results[document_id] = DocumentSearchResult(
            id=document_id,
            title=title,
            category=item_category,
            description="",
            excerpt=excerpt,
            isFavored=False,
            downloadUrl=f"/api/chat/documents/{document_id}/download",
            fileType="",
            documentStatus=DocumentStatus.INDEXED,
            createdAt=None,
            realizedAt=None,
        )
        ordered_ids.append(document_id)

    if not results:
        return DocumentSearchResponse(items=[], total=0, page=page, limit=limit)

    doc_map = _documents_repo.get_active_documents_fields_by_ids(
        ordered_ids,
        {"title": 1, "category": 1, "description": 1, "isFavored": 1, "createdAt": 1, "realizedAt": 1, "fileType": 1, "documentStatus": 1},
    )

    enriched: list[DocumentSearchResult] = []
    for doc_id in ordered_ids:
        item = results.get(doc_id)
        if not item:
            continue
        raw = doc_map.get(doc_id)
        if raw:
            item.title = str(raw.get("title", item.title))
            category_raw = raw.get("category", item.category.value)
            try:
                item.category = DocumentCategory(category_raw)
            except Exception:
                pass
            item.description = str(raw.get("description", ""))
            item.isFavored = bool(raw.get("isFavored", False))
            item.createdAt = raw.get("createdAt")
            item.realizedAt = raw.get("realizedAt")
            item.fileType = str(raw.get("fileType", ""))
            try:
                item.documentStatus = DocumentStatus(str(raw.get("documentStatus", DocumentStatus.INDEXED.value)))
            except Exception:
                item.documentStatus = DocumentStatus.INDEXED
        if _matches_filters(item, category=category, date_from=date_from, date_to=date_to):
            enriched.append(item)

    sorted_items = _sort_results(enriched, sort_field=sort_field, sort_dir=sort_dir)
    total = len(sorted_items)
    start_index = max((page - 1) * limit, 0)
    end_index = start_index + limit
    return DocumentSearchResponse(items=sorted_items[start_index:end_index], total=total, page=page, limit=limit)


def search_documents(
    *,
    query: str,
    limit: int = 20,
    page: int = 1,
    category: DocumentCategory | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    sort_field: str = "date",
    sort_dir: str = "desc",
) -> DocumentSearchResponse:
    terms = _split_search_terms(query)
    if not terms:
        return DocumentSearchResponse(items=[], total=0, page=page, limit=limit)

    safe_page = max(page, 1)
    safe_limit = min(max(limit, 1), 50)
    parsed_date_from = _parse_date_start(date_from)
    parsed_date_to = _parse_date_end(date_to)
    mongo_sort_field = "title" if sort_field == "title" else "realizedAt"
    mongo_sort_dir = 1 if sort_dir.lower() == "asc" else -1

    try:
        return _search_documents_qdrant(
            query=query,
            page=safe_page,
            limit=safe_limit,
            terms=terms,
            category=category,
            date_from=parsed_date_from,
            date_to=parsed_date_to,
            sort_field=sort_field,
            sort_dir=sort_dir,
        )
    except Exception:
        regex_terms = [re.escape(term) for term in terms]
        total = _documents_repo.count_search_active_documents(
            terms=regex_terms,
            category=category.value if category else None,
            date_from=parsed_date_from,
            date_to=parsed_date_to,
        )
        docs = _documents_repo.search_active_documents(
            terms=regex_terms,
            category=category.value if category else None,
            date_from=parsed_date_from,
            date_to=parsed_date_to,
            limit=safe_limit,
            skip=(safe_page - 1) * safe_limit,
            sort_field=mongo_sort_field,
            sort_dir=mongo_sort_dir,
        )
        results: list[DocumentSearchResult] = []
        for doc in docs:
            excerpt_source = doc.content or doc.description or ""
            results.append(
                DocumentSearchResult(
                    id=doc.id or "",
                    title=doc.title,
                    category=DocumentCategory(doc.category),
                    description=doc.description,
                    excerpt=_build_excerpt(excerpt_source, terms),
                    isFavored=doc.is_favored,
                    downloadUrl=f"/api/chat/documents/{doc.id}/download",
                    fileType=doc.file_type,
                    documentStatus=DocumentStatus(doc.document_status),
                    createdAt=doc.created_at,
                    realizedAt=doc.realized_at,
                )
            )
        return DocumentSearchResponse(items=results, total=total, page=safe_page, limit=safe_limit)



def list_favorite_documents(limit: int = 50) -> list[DocumentSearchResult]:
    docs = _documents_repo.list_favorite_documents(limit=limit)
    results: list[DocumentSearchResult] = []
    for doc in docs:
        excerpt_source = doc.content or doc.description or ""
        results.append(
            DocumentSearchResult(
                id=doc.id or "",
                title=doc.title,
                category=DocumentCategory(doc.category),
                description=doc.description,
                excerpt=_build_excerpt(excerpt_source, []),
                isFavored=doc.is_favored,
                downloadUrl=f"/api/chat/documents/{doc.id}/download",
                fileType=doc.file_type,
                documentStatus=DocumentStatus(doc.document_status),
                createdAt=doc.created_at,
                realizedAt=doc.realized_at,
            )
        )
    return results




def count_favorite_documents() -> int:
    return int(_documents_repo.count_favorite_documents())


def set_document_favorite(document_id: str, *, is_favored: bool) -> DocumentFavoriteResponse:
    _documents_repo.update_document_favorite(document_id, is_favored=is_favored)
    doc = _documents_repo.get_active_document_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document introuvable.")
    return DocumentFavoriteResponse(documentId=document_id, isFavored=doc.is_favored)
