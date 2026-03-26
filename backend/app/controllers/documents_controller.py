from datetime import date, datetime, timezone

from fastapi import HTTPException, UploadFile, status

from app.schemas import DocumentCategory
from app.services.documents_service import (
    delete_document_permanently,
    get_document_points,
    get_qdrant_health_status,
    get_qdrant_stats,
    import_document_and_schedule_index,
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
    realized_at: str = "",
    description: str = "",
):
    if not realized_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Date de realisation obligatoire.")

    try:
        realized_date = date.fromisoformat(realized_at)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Date de realisation invalide (AAAA-MM-JJ).",
        ) from exc

    realized_dt = datetime(realized_date.year, realized_date.month, realized_date.day, tzinfo=timezone.utc)

    return import_document_and_schedule_index(
        file=file,
        title=title,
        category=category,
        description=description,
        realized_at=realized_dt,
    )


def delete_document_controller(document_id: str) -> None:
    delete_document_permanently(document_id)
    return None


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
