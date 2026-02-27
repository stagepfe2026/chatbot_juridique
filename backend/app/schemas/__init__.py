from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


class DocumentCategory(str, Enum):
    LOI_DES_FINANCES = "LOI_DES_FINANCES"
    RECUEILS_DES_TEXTES_FISCAUX = "RECUEILS_DES_TEXTES_FISCAUX"
    NOTE_COMMUNES = "NOTE_COMMUNES"
    CONVENTIONS_DE_NON_DOUBLE_IMPOSITION = "CONVENTIONS_DE_NON_DOUBLE_IMPOSITION"


class DocumentStatus(str, Enum):
    PROCESSING = "PROCESSING"
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
    indexedAt: datetime | None = None
    chunksCount: int | None = None
    indexError: str | None = None


class ImportDocumentResponse(BaseModel):
    documentId: str
    filename: str
    status: DocumentStatus
    chunksCount: int = 0
    error: str | None = None


class IndexManyResponse(BaseModel):
    total: int
    indexed: int
    failed: int


class AskQuestionRequest(BaseModel):
    question: str


class SourceItem(BaseModel):
    documentId: str
    title: str
    excerpt: str


class SourceFile(BaseModel):
    documentId: str
    filename: str
    downloadUrl: str


class AskQuestionResponse(BaseModel):
    questionId: str
    answer: str
    sourceFile: SourceFile | None = None
