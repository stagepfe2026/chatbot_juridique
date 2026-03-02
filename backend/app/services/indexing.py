from datetime import datetime, timezone
from typing import Any
from uuid import NAMESPACE_URL, uuid5

from fastapi import HTTPException, status
from langchain_core.documents import Document
from langchain_community.embeddings import FastEmbedEmbeddings
from langchain_qdrant import QdrantVectorStore
from qdrant_client.http import models

from app.core.config import settings
from app.database.connections import qdrant_client
from app.repositories import DocumentsRepository
from app.schemas import DocumentStatus
from app.services.document_loader import extract_text_from_path
from app.services.text_processing import chunk_text, clean_text, unique_chunks

_embeddings = None
_vector_store = None
_documents_repo = DocumentsRepository()


def _get_cached_embedding_model():
    # Cache local du modèle d'embedding pour éviter les rechargements.
    global _embeddings
    if _embeddings is None:
        _embeddings = FastEmbedEmbeddings(model_name=settings.embedding_model)
    return _embeddings


def _ensure_qdrant_collection_exists():
    # Crée la collection Qdrant si elle n'existe pas.
    embeddings = _get_cached_embedding_model()
    vector_size = len(embeddings.embed_query("test vector size"))
    existing = {collection.name for collection in qdrant_client.get_collections().collections}

    if settings.qdrant_collection_name not in existing:
        qdrant_client.create_collection(
            collection_name=settings.qdrant_collection_name,
            vectors_config=models.VectorParams(size=vector_size, distance=models.Distance.COSINE),
        )


def _get_cached_vector_store():
    global _vector_store
    if _vector_store is None:
        _ensure_qdrant_collection_exists()
        _vector_store = QdrantVectorStore(
            client=qdrant_client,
            collection_name=settings.qdrant_collection_name,
            embedding=_get_cached_embedding_model(),
        )
    return _vector_store


def _chunk_point_id(document_id: str, chunk_index: int) -> str:
    # Qdrant accepts UUID strings or uint64 IDs. Use deterministic UUID per chunk.
    return str(uuid5(NAMESPACE_URL, f"{document_id}:{chunk_index}"))


def _write_indexing_result(
    *,
    document_id: str,
    title: str,
    status: str,
    chunks: list[str],
    indexed_points: int,
    chunks_raw_total: int,
    error: str | None = None,
) -> str:
    settings.indexing_results_path.mkdir(parents=True, exist_ok=True)
    output_path = settings.indexing_results_path / f"{document_id}.txt"
    preview = "\n\n".join(
        [f"[chunk {idx}] {chunk}" for idx, chunk in enumerate(chunks[:10])]
    )
    payload = (
        f"document_id: {document_id}\n"
        f"title: {title}\n"
        f"status: {status}\n"
        f"indexed_points: {indexed_points}\n"
        f"chunks_total: {len(chunks)}\n"
        f"chunks_raw_total: {chunks_raw_total}\n"
        f"error: {error or ''}\n"
        f"\n=== CHUNKS PREVIEW (first 10) ===\n{preview}\n"
    )
    output_path.write_text(payload, encoding="utf-8")
    return str(output_path)


def _resolve_document_text_content(doc: dict[str, Any]) -> str:
    if isinstance(doc.get("content"), str) and doc["content"].strip():
        return doc["content"]

    file_path = doc.get("filePath")
    if not isinstance(file_path, str) or not file_path.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucun contenu texte ou chemin de fichier disponible pour ce document.",
        )
    return extract_text_from_path(file_path)


def index_document_by_id(document_id: str) -> int:
    # Pipeline complet: extraction -> nettoyage -> chunks -> embeddings -> Qdrant.
    _ensure_qdrant_collection_exists()
    doc = _documents_repo.get_active_document_raw_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document introuvable.")

    _documents_repo.mark_document_as_processing(document_id)

    try:
        raw = _resolve_document_text_content(doc)
        cleaned = clean_text(raw)
        chunks_raw = chunk_text(cleaned)
        chunks = unique_chunks(chunks_raw)
        if not chunks:
            raise ValueError("Aucun chunk genere apres nettoyage.")

        qdrant_docs = [
            Document(
                page_content=chunk,
                metadata={
                    "document_id": document_id,
                    "title": doc.get("title", ""),
                    "category": doc.get("category", ""),
                    "chunk_index": idx,
                },
            )
            for idx, chunk in enumerate(chunks)
        ]

        # Remove previous points of this document, then upsert fresh chunks.
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

        ids = [_chunk_point_id(document_id, idx) for idx in range(len(qdrant_docs))]
        _get_cached_vector_store().add_documents(qdrant_docs, ids=ids)

        indexed_points = qdrant_client.count(
            collection_name=settings.qdrant_collection_name,
            count_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="metadata.document_id",
                        match=models.MatchValue(value=document_id),
                    )
                ]
            ),
            exact=True,
        ).count
        if indexed_points == 0:
            raise ValueError("Indexation Qdrant echouee: 0 point enregistre.")

        _documents_repo.mark_document_as_indexed(
            document_id,
            indexed_at=datetime.now(timezone.utc),
            chunks_count=indexed_points,
        )
        _write_indexing_result(
            document_id=document_id,
            title=str(doc.get("title", "")),
            status=DocumentStatus.INDEXED.value,
            chunks=chunks,
            indexed_points=indexed_points,
            chunks_raw_total=len(chunks_raw),
        )
        return indexed_points
    except Exception as exc:
        _documents_repo.mark_document_as_failed(document_id, error=str(exc))
        _write_indexing_result(
            document_id=document_id,
            title=str(doc.get("title", "")),
            status=DocumentStatus.FAILED.value,
            chunks=[],
            indexed_points=0,
            chunks_raw_total=0,
            error=str(exc),
        )
        raise


def index_pending_documents() -> tuple[int, int, int]:
    # Indexe tous les documents en attente.
    doc_ids = _documents_repo.list_non_indexed_active_document_ids()
    indexed = 0
    failed = 0

    for document_id in doc_ids:
        try:
            index_document_by_id(document_id)
            indexed += 1
        except Exception:
            failed += 1

    return len(doc_ids), indexed, failed


def qdrant_health() -> dict[str, Any]:
    try:
        collections = qdrant_client.get_collections()
        names = [collection.name for collection in collections.collections]
        return {
            "qdrantUrl": settings.qdrant_url,
            "collection": settings.qdrant_collection_name,
            "collections": names,
            "collectionExists": settings.qdrant_collection_name in names,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Qdrant inaccessible ({settings.qdrant_url}): {exc}",
        ) from exc


def qdrant_collection_stats() -> dict[str, Any]:
    try:
        _ensure_qdrant_collection_exists()
        info = qdrant_client.get_collection(settings.qdrant_collection_name)
        return {
            "collection": settings.qdrant_collection_name,
            "pointsCount": info.points_count or 0,
            "vectorsCount": info.vectors_count or 0,
            "status": str(info.status),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Impossible de lire la collection Qdrant ({settings.qdrant_collection_name}): {exc}",
        ) from exc


def list_qdrant_points_for_document(document_id: str, limit: int = 100) -> list[dict[str, Any]]:
    _ensure_qdrant_collection_exists()
    points, _ = qdrant_client.scroll(
        collection_name=settings.qdrant_collection_name,
        scroll_filter=models.Filter(
            must=[
                models.FieldCondition(
                    key="metadata.document_id",
                    match=models.MatchValue(value=document_id),
                )
            ]
        ),
        with_payload=True,
        with_vectors=False,
        limit=limit,
    )

    serialized: list[dict[str, Any]] = []
    for point in points:
        serialized.append(
            {
                "id": str(point.id),
                "payload": point.payload,
            }
        )
    return serialized
