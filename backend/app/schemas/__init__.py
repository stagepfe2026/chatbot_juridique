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
    fileType: str = ""
    documentStatus: DocumentStatus = DocumentStatus.INDEXED
    createdAt: datetime | None = None
    realizedAt: datetime | None = None


class DocumentSearchResponse(BaseModel):
    items: list[DocumentSearchResult] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    limit: int = 20


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


class ResponseMode(str, Enum):
    SHORT = "SHORT"
    DETAILED = "DETAILED"


class AskQuestionRequest(BaseModel):
    conversationId: str | None = None
    question: str
    responseMode: ResponseMode = ResponseMode.DETAILED


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


class ConversationRenameRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)


class ConversationRenameOut(BaseModel):
    conversationId: str
    title: str
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


class LoginHistoryEntry(BaseModel):
    device: str
    browser: str
    location: str
    lastSeenAt: datetime
    isCurrent: bool = False
    isSuspicious: bool = False


class AuthUser(BaseModel):
    id: str
    nom: str
    prenom: str
    email: str
    role: UserRole
    telephone: str = ""
    profileImageUrl: str = ""
    adresse: str = ""
    dateNaissance: str = ""
    direction: str = ""
    service: str = ""
    poste: str = ""
    matricule: str = ""
    bureau: str = ""
    responsable: str = ""
    membreDepuis: str = ""
    languePreferee: str = "fr"
    themePrefere: str = "light"
    notificationsEmail: bool = True
    notificationsSms: bool = False
    twoFactorEnabled: bool = False
    passwordUpdatedAt: datetime | None = None
    activeSessionsCount: int = 0
    loginHistory: list[LoginHistoryEntry] = Field(default_factory=list)


class UpdateProfileRequest(BaseModel):
    nom: str = Field(min_length=1, max_length=120)
    prenom: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=255)
    telephone: str = Field(min_length=1, max_length=60)
    adresse: str = Field(min_length=1, max_length=255)
    dateNaissance: str = Field(min_length=4, max_length=30)
    direction: str = Field(min_length=1, max_length=180)
    service: str = Field(min_length=1, max_length=180)
    poste: str = Field(min_length=1, max_length=180)
    matricule: str = Field(min_length=1, max_length=80)
    bureau: str = Field(min_length=1, max_length=180)
    responsable: str = Field(min_length=1, max_length=180)
    membreDepuis: str = Field(min_length=4, max_length=30)
    languePreferee: str = Field(min_length=2, max_length=10)
    themePrefere: str = Field(min_length=4, max_length=10)
    notificationsEmail: bool
    notificationsSms: bool
    twoFactorEnabled: bool


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


class DisconnectDevicesResponse(BaseModel):
    closedSessions: int


class ClaimCategory(str, Enum):
    ACCOUNT = "ACCOUNT"
    CHATBOT = "CHATBOT"
    DOCUMENT = "DOCUMENT"
    OTHER = "OTHER"


class ClaimStatus(str, Enum):
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    PROCESSING = "PROCESSING"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class ClaimPriority(str, Enum):
    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    URGENT = "URGENT"


class ClaimAttachmentIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    mimeType: str = Field(min_length=6, max_length=80, pattern=r"^image\/")
    size: int = Field(ge=1, le=5 * 1024 * 1024)
    dataUrl: str = Field(min_length=30, max_length=8_000_000)


class ClaimAttachmentOut(BaseModel):
    name: str
    mimeType: str
    size: int
    dataUrl: str


class ClaimCreateRequest(BaseModel):
    category: ClaimCategory
    priority: ClaimPriority = ClaimPriority.NORMAL
    subject: str = Field(min_length=3, max_length=160)
    description: str = Field(min_length=10, max_length=3000)
    attachments: list[ClaimAttachmentIn] = Field(default_factory=list, max_length=4)


class ClaimReplyRequest(BaseModel):
    message: str = Field(min_length=3, max_length=4000)


class ClaimActivityLogEntryOut(BaseModel):
    id: str
    description: str
    actorName: str
    createdAt: datetime


class ClaimOut(BaseModel):
    id: str
    ticketNumber: str
    userId: str
    userEmail: str
    category: ClaimCategory
    priority: ClaimPriority = ClaimPriority.NORMAL
    subject: str
    description: str
    status: ClaimStatus
    attachments: list[ClaimAttachmentOut] = Field(default_factory=list)
    adminReply: str | None = None
    adminReplyAt: datetime | None = None
    adminReplyBy: str | None = None
    isReplyReadByUser: bool = True
    createdAt: datetime
    updatedAt: datetime
    activityLog: list[ClaimActivityLogEntryOut] = Field(default_factory=list)


class ClaimUnreadCountOut(BaseModel):
    count: int


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


