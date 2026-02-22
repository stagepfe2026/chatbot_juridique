from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


class DocumentCategory(str, Enum):
    LOI_DES_FINANCES = "LOI_DES_FINANCES"
    RECUEILS_DES_TEXTES_FISCAUX = "RECUEILS_DES_TEXTES_FISCAUX"
    NOTE_COMMUNES = "NOTE_COMMUNES"
    CONVENTIONS_DE_NON_DOUBLE_IMPOSITION = "CONVENTIONS_DE_NON_DOUBLE_IMPOSITION"


class DocumentStatus(str, Enum):
    INDEXED = "INDEXED"
    FAILED = "FAILED"


class DocumentOut(BaseModel):
    id: str
    title: str
    category: DocumentCategory
    description: str = ""
    documentStatus: DocumentStatus
    filePath: str
    fileSize: int
    fileType: str
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    deletedAt: datetime | None = None


class ImportDocumentResponse(BaseModel):
    documentId: str
    filename: str
    status: DocumentStatus
