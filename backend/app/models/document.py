from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from app.schemas import DocumentCategory, DocumentOut, DocumentStatus


@dataclass
class DocumentModel:
    title: str
    category: str
    description: str
    document_status: str
    realized_at: datetime | None
    file_path: str
    file_size: int
    file_type: str
    created_at: datetime
    is_favored: bool = False
    deleted_at: datetime | None = None
    indexed_at: datetime | None = None
    chunks_count: int | None = None
    index_error: str | None = None
    id: str | None = None
    content: str | None = None

    @classmethod
    def new_processing(
        cls,
        *,
        title: str,
        category: str,
        description: str,
        realized_at: datetime | None = None,
        file_path: str,
        file_size: int,
        file_type: str,
    ) -> "DocumentModel":
        return cls(
            title=title.strip(),
            category=category,
            description=description.strip(),
            document_status=DocumentStatus.PROCESSING.value,
            realized_at=realized_at,
            file_path=file_path,
            file_size=file_size,
            file_type=file_type,
            created_at=datetime.now(timezone.utc),
            is_favored=False,
        )

    @classmethod
    def from_mongo(cls, raw: dict[str, Any]) -> "DocumentModel":
        return cls(
            id=str(raw.get("_id")) if raw.get("_id") is not None else None,
            title=str(raw.get("title", "")),
            category=str(raw.get("category", "")),
            description=str(raw.get("description", "")),
            document_status=str(raw.get("documentStatus", DocumentStatus.PROCESSING.value)),
            realized_at=raw.get("realizedAt"),
            file_path=str(raw.get("filePath", "")),
            file_size=int(raw.get("fileSize", 0)),
            file_type=str(raw.get("fileType", "application/octet-stream")),
            created_at=raw.get("createdAt") or datetime.now(timezone.utc),
            is_favored=bool(raw.get("isFavored", False)),
            deleted_at=raw.get("deletedAt"),
            indexed_at=raw.get("indexedAt"),
            chunks_count=raw.get("chunksCount"),
            index_error=raw.get("indexError"),
            content=raw.get("content"),
        )

    def to_mongo_insert(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "category": self.category,
            "description": self.description,
            "documentStatus": self.document_status,
            "realizedAt": self.realized_at,
            "filePath": self.file_path,
            "fileSize": self.file_size,
            "fileType": self.file_type,
            "isFavored": self.is_favored,
            "createdAt": self.created_at,
            "deletedAt": self.deleted_at,
            "indexedAt": self.indexed_at,
            "chunksCount": self.chunks_count,
            "indexError": self.index_error,
        }

    def to_out_schema(self) -> DocumentOut:
        return DocumentOut(
            id=self.id or "",
            title=self.title,
            category=DocumentCategory(self.category),
            description=self.description,
            documentStatus=DocumentStatus(self.document_status),
            realizedAt=self.realized_at,
            filePath=self.file_path,
            fileSize=self.file_size,
            fileType=self.file_type,
            isFavored=self.is_favored,
            createdAt=self.created_at,
            deletedAt=self.deleted_at,
            indexedAt=self.indexed_at,
            chunksCount=self.chunks_count,
            indexError=self.index_error,
        )
