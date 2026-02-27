from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.core.config import settings
from app.database.connections import get_documents_collection
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

router = APIRouter(prefix="/admin/documents", tags=["documents"])


def _validate_extension(filename: str) -> str:
    # Vérifie que le fichier respecte les extensions autorisées.
    extension = Path(filename).suffix.lower()
    if extension not in settings.allowed_extensions:
        allowed = ", ".join(settings.allowed_extensions)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Type de fichier non supporte. Autorises: {allowed}",
        )
    return extension


@router.get("")
def list_documents():
    # Liste les documents non supprimés (tri récent -> ancien).
    cursor = get_documents_collection().find({"deletedAt": None}).sort("createdAt", -1)
    data: list[DocumentOut] = []
    for item in cursor:
        item["id"] = str(item["_id"])
        del item["_id"]
        data.append(DocumentOut(**item))
    return data


@router.post("/import", response_model=ImportDocumentResponse)
def import_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    category: DocumentCategory = Form(...),
    description: str = Form(default=""),
):
    # Upload + enregistrement Mongo + indexation immédiate.
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nom de fichier manquant.")
    if not title.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Le titre est obligatoire.")

    _validate_extension(file.filename)
    settings.uploads_path.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid4().hex}_{Path(file.filename).name}"
    destination = settings.uploads_path / safe_name
    payload = file.file.read()
    destination.write_bytes(payload)

    now = datetime.now(timezone.utc)
    record = {
        "title": title.strip(),
        "category": category.value,
        "description": description.strip(),
        "documentStatus": DocumentStatus.PROCESSING.value,
        "filePath": str(destination),
        "fileSize": len(payload),
        "fileType": file.content_type or "application/octet-stream",
        "createdAt": now,
        "deletedAt": None,
        "indexedAt": None,
        "chunksCount": None,
        "indexError": None,
    }
    inserted = get_documents_collection().insert_one(record)
    document_id = str(inserted.inserted_id)

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


@router.post("/index-existing", response_model=IndexManyResponse)
def index_existing_documents():
    # Relance l'indexation pour les documents non indexés.
    total, indexed, failed = index_pending_documents()
    return IndexManyResponse(total=total, indexed=indexed, failed=failed)


@router.post("/{document_id}/index")
def index_one_document(document_id: str):
    # Réindexation ciblée d'un seul document.
    chunks = index_document_by_id(document_id)
    return {"documentId": document_id, "status": DocumentStatus.INDEXED, "chunksCount": chunks}


@router.get("/qdrant/health")
def get_qdrant_health():
    return qdrant_health()


@router.get("/qdrant/stats")
def get_qdrant_stats():
    return qdrant_collection_stats()


@router.get("/{document_id}/points")
def get_document_points(document_id: str, limit: int = 100):
    points = list_qdrant_points_for_document(document_id=document_id, limit=limit)
    return {
        "documentId": document_id,
        "count": len(points),
        "points": points,
    }
