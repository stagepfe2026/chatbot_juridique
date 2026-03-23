from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


@dataclass
class ConversationModel:
    summary: str
    created_at: datetime
    updated_at: datetime
    user_id: str | None = None
    custom_title: str | None = None
    is_archived: bool = False
    archived_at: datetime | None = None
    id: str | None = None

    @classmethod
    def new(cls, summary: str = "") -> "ConversationModel":
        now = datetime.now(timezone.utc)
        return cls(summary=summary.strip(), created_at=now, updated_at=now, is_archived=False, archived_at=None)

    @classmethod
    def from_mongo(cls, raw: dict[str, Any]) -> "ConversationModel":
        created_at = raw.get("createdAt") or datetime.now(timezone.utc)
        updated_at = raw.get("updatedAt") or created_at
        return cls(
            id=str(raw.get("_id")) if raw.get("_id") is not None else None,
            summary=str(raw.get("summary", "")),
            created_at=created_at,
            updated_at=updated_at,
            user_id=str(raw.get("userId")) if raw.get("userId") is not None else None,
            custom_title=str(raw.get("customTitle")) if raw.get("customTitle") is not None else None,
            is_archived=bool(raw.get("isArchived", False)),
            archived_at=raw.get("archivedAt"),
        )

    def to_mongo_insert(self) -> dict[str, Any]:
        return {
            "summary": self.summary,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
            "userId": self.user_id,
            "customTitle": self.custom_title,
            "isArchived": self.is_archived,
            "archivedAt": self.archived_at,
        }


@dataclass
class MessageModel:
    conversation_id: str
    role: str
    content: str
    created_at: datetime
    question_id: str | None = None
    source_file: dict[str, Any] | None = None
    id: str | None = None

    @classmethod
    def new(
        cls,
        *,
        conversation_id: str,
        role: str,
        content: str,
        question_id: str | None = None,
        source_file: dict[str, Any] | None = None,
    ) -> "MessageModel":
        return cls(
            conversation_id=conversation_id,
            role=role,
            content=content.strip(),
            created_at=datetime.now(timezone.utc),
            question_id=question_id,
            source_file=source_file if isinstance(source_file, dict) else None,
        )

    @classmethod
    def from_mongo(cls, raw: dict[str, Any]) -> "MessageModel":
        source_file = raw.get("sourceFile")
        return cls(
            id=str(raw.get("_id")) if raw.get("_id") is not None else None,
            conversation_id=str(raw.get("conversationId", "")),
            role=str(raw.get("role", "")),
            content=str(raw.get("content", "")),
            created_at=raw.get("createdAt") or datetime.now(timezone.utc),
            question_id=str(raw.get("questionId")) if raw.get("questionId") is not None else None,
            source_file=source_file if isinstance(source_file, dict) else None,
        )

    def to_mongo_insert(self) -> dict[str, Any]:
        doc: dict[str, Any] = {
            "conversationId": self.conversation_id,
            "role": self.role,
            "content": self.content,
            "createdAt": self.created_at,
        }
        if self.question_id:
            doc["questionId"] = self.question_id
        if self.source_file:
            doc["sourceFile"] = self.source_file
        return doc
