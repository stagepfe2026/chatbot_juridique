import re
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from langchain_community.embeddings import FastEmbedEmbeddings
from langchain_qdrant import QdrantVectorStore

from app.core.config import settings
from app.database.connections import qdrant_client
from app.models import DocumentModel
from app.repositories import DocumentsRepository
from app.schemas import (
    DocumentCategory,
    DocumentFavoriteResponse,
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
) -> ImportDocumentResponse:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nom de fichier manquant.")
    if not title.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Le titre est obligatoire.")

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
        )
    else:
        model = DocumentModel.new_processing(
            title=title,
            category=category.value,
            description=description,
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


def _search_documents_qdrant(query: str, limit: int, terms: list[str]) -> list[DocumentSearchResult]:
    results: dict[str, DocumentSearchResult] = {}
    ordered_ids: list[str] = []

    scored = _get_vector_store().similarity_search_with_score(query, k=max(limit * 4, 10))
    for doc, _score in scored:
        content = doc.page_content or ""
        if terms and not _contains_terms(content, terms):
            continue
        metadata = doc.metadata or {}
        document_id = str(metadata.get("document_id", "")).strip()
        if not document_id or document_id in results:
            continue
        title = str(metadata.get("title", "Document juridique"))
        category_raw = str(metadata.get("category", ""))
        excerpt = _build_excerpt(content, terms)

        try:
            category = DocumentCategory(category_raw)
        except Exception:
            category = DocumentCategory.LOI_DES_FINANCES

        results[document_id] = DocumentSearchResult(
            id=document_id,
            title=title,
            category=category,
            description="",
            excerpt=excerpt,
            isFavored=False,
            downloadUrl=f"/api/chat/documents/{document_id}/download",
            createdAt=None,
        )
        ordered_ids.append(document_id)
        if len(ordered_ids) >= limit:
            break

    if not results:
        return []

    doc_map = _documents_repo.get_active_documents_fields_by_ids(
        ordered_ids,
        {"title": 1, "category": 1, "description": 1, "isFavored": 1, "createdAt": 1},
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
        enriched.append(item)

    return enriched


def search_documents(*, query: str, limit: int = 20) -> list[DocumentSearchResult]:
    terms = _split_search_terms(query)
    if not terms:
        return []

    try:
        return _search_documents_qdrant(query, limit, terms)
    except Exception:
        # Fallback sur Mongo si Qdrant indisponible.
        regex_terms = [re.escape(term) for term in terms]
        docs = _documents_repo.search_active_documents(terms=regex_terms, limit=limit)
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
                    createdAt=doc.created_at,
                )
            )
        return results


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
                createdAt=doc.created_at,
            )
        )
    return results


def set_document_favorite(document_id: str, *, is_favored: bool) -> DocumentFavoriteResponse:
    _documents_repo.update_document_favorite(document_id, is_favored=is_favored)
    doc = _documents_repo.get_active_document_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document introuvable.")
    return DocumentFavoriteResponse(documentId=document_id, isFavored=doc.is_favored)
