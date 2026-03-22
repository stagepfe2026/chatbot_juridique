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
    realizedAt: datetime | None = None
    filePath: str
    fileSize: int
    fileType: str
    isFavored: bool = False
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    deletedAt: datetime | None = None
    indexedAt: datetime | None = None
    chunksCount: int | None = None
    indexError: str | None = None


class DocumentSearchResult(BaseModel):
    id: str
    title: str
    category: DocumentCategory
    description: str = ""
    excerpt: str = ""
    isFavored: bool = False
    downloadUrl: str = ""
    createdAt: datetime | None = None
    realizedAt: datetime | None = None


class DocumentFavoriteUpdate(BaseModel):
    isFavored: bool


class DocumentFavoriteResponse(BaseModel):
    documentId: str
    isFavored: bool


class FavoritesCountOut(BaseModel):
    count: int


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
    isArchived: bool = False
    archivedAt: datetime | None = None


class ConversationArchiveStateOut(BaseModel):
    conversationId: str
    isArchived: bool
    archivedAt: datetime | None = None
    updatedAt: datetime


class ConversationMessageOut(BaseModel):
    id: str
    conversationId: str
    role: str
    content: str
    createdAt: datetime
    questionId: str | None = None
    sourceFile: SourceFile | None = None


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    FINANCE_USER = "FINANCE_USER"


class AuthUser(BaseModel):
    id: str
    nom: str
    prenom: str
    email: str
    role: UserRole


class UpdateProfileRequest(BaseModel):
    nom: str = Field(min_length=1, max_length=120)
    prenom: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=255)


class UpdatePasswordRequest(BaseModel):
    currentPassword: str = Field(min_length=1, max_length=255)
    newPassword: str = Field(min_length=8, max_length=255)
    confirmPassword: str = Field(min_length=8, max_length=255)


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    user: AuthUser
    sessionExpiresAt: datetime


class ClaimCategory(str, Enum):
    ACCOUNT = "ACCOUNT"
    CHATBOT = "CHATBOT"
    DOCUMENT = "DOCUMENT"
    OTHER = "OTHER"


class ClaimStatus(str, Enum):
    SUBMITTED = "SUBMITTED"


class ClaimCreateRequest(BaseModel):
    category: ClaimCategory
    subject: str = Field(min_length=3, max_length=160)
    description: str = Field(min_length=10, max_length=3000)


class ClaimOut(BaseModel):
    id: str
    userId: str
    userEmail: str
    category: ClaimCategory
    subject: str
    description: str
    status: ClaimStatus
    createdAt: datetime
    updatedAt: datetime


class AuditLogStatus(str, Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    WARNING = "WARNING"


class AuditLogLevel(str, Enum):
    INFO = "INFO"
    CRITICAL = "CRITICAL"


class AuditLogDetailsOut(BaseModel):
    message: str
    endpoint: str | None = None
    payload: dict | None = None
    userAgent: str | None = None
    metadata: dict | None = None


class AuditLogOut(BaseModel):
    id: str
    user: str
    action: str
    resource: str
    status: AuditLogStatus
    level: AuditLogLevel
    ip: str
    timestamp: datetime
    details: AuditLogDetailsOut
