from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from app.config import settings
from app.db import get_documents_collection
from app.schemas import DocumentOut, DocumentStatus


def _validate_extension(filename: str) -> str:
    extension = Path(filename).suffix.lower()
    if extension not in settings.allowed_extensions:
        allowed = ", ".join(settings.allowed_extensions)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Type de fichier non supporte. Autorises: {allowed}",
        )
    return extension


def save_uploaded_document(
    *,
    file: UploadFile,
    title: str,
    category: str,
    description: str,
) -> dict:
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
        "category": category,
        "description": description.strip(),
        "documentStatus": DocumentStatus.INDEXED.value,
        "filePath": str(destination),
        "fileSize": len(payload),
        "fileType": file.content_type or "application/octet-stream",
        "createdAt": now,
        "deletedAt": None,
    }
    inserted = get_documents_collection().insert_one(record)
    record["id"] = str(inserted.inserted_id)
    return record


def list_documents() -> list[DocumentOut]:
    cursor = get_documents_collection().find({"deletedAt": None}).sort("createdAt", -1)
    items: list[DocumentOut] = []
    for item in cursor:
        item["id"] = str(item["_id"])
        del item["_id"]
        items.append(DocumentOut(**item))
    return items
