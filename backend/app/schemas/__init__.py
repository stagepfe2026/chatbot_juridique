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
    conversationId: str | None = None
    question: str


class SourceItem(BaseModel):
    documentId: str
    title: str
    excerpt: str
    section: str | None = None
    page: str | None = None


class SourceFile(BaseModel):
    documentId: str
    filename: str
    downloadUrl: str


class AskQuestionResponse(BaseModel):
    questionId: str
    conversationId: str
    answer: str
    sources: list[SourceItem] = []
    sourceFile: SourceFile | None = None


class ConversationOut(BaseModel):
    id: str
    question: str
    answer: str
    askedAt: datetime
    answeredAt: datetime
    createdAt: datetime
    userId: str | None = None


class ConversationSummaryOut(BaseModel):
    id: str
    title: str
    preview: str
    summary: str
    createdAt: datetime
    updatedAt: datetime
    messageCount: int


class ConversationMessageOut(BaseModel):
    id: str
    conversationId: str
    role: str
    content: str
    createdAt: datetime


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    FINANCE_USER = "FINANCE_USER"


class AuthUser(BaseModel):
    id: str
    nom: str
    prenom: str
    email: str
    role: UserRole


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    user: AuthUser
    sessionExpiresAt: datetime
