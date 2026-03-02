from fastapi import UploadFile

from app.schemas import DocumentCategory
from app.services.documents_service import (
    get_document_points,
    get_qdrant_health_status,
    get_qdrant_stats,
    import_document_and_index,
    index_non_indexed_documents,
    index_single_document,
    list_active_documents,
)


def list_documents_controller():
    return list_active_documents()


def import_document_controller(
    file: UploadFile,
    title: str,
    category: DocumentCategory,
    description: str = "",
):
    return import_document_and_index(
        file=file,
        title=title,
        category=category,
        description=description,
    )


def index_existing_documents_controller():
    return index_non_indexed_documents()


def index_one_document_controller(document_id: str):
    return index_single_document(document_id)


def qdrant_health_controller():
    return get_qdrant_health_status()


def qdrant_stats_controller():
    return get_qdrant_stats()


def document_points_controller(document_id: str, limit: int = 100):
    return get_document_points(document_id=document_id, limit=limit)
