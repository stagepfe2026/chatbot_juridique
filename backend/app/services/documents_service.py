from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings
from app.models import DocumentModel
from app.repositories import DocumentsRepository
from app.schemas import (
    DocumentCategory,
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
