from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


@dataclass
class ConversationModel:
    summary: str
    created_at: datetime
    updated_at: datetime
    user_id: str | None = None
    id: str | None = None

    @classmethod
    def new(cls, summary: str = "") -> "ConversationModel":
        now = datetime.now(timezone.utc)
        return cls(summary=summary.strip(), created_at=now, updated_at=now)

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
        )

    def to_mongo_insert(self) -> dict[str, Any]:
        return {
            "summary": self.summary,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
            "userId": self.user_id,
        }


@dataclass
class MessageModel:
    conversation_id: str
    role: str
    content: str
    created_at: datetime
    id: str | None = None

    @classmethod
    def new(cls, *, conversation_id: str, role: str, content: str) -> "MessageModel":
        return cls(
            conversation_id=conversation_id,
            role=role,
            content=content.strip(),
            created_at=datetime.now(timezone.utc),
        )

    @classmethod
    def from_mongo(cls, raw: dict[str, Any]) -> "MessageModel":
        return cls(
            id=str(raw.get("_id")) if raw.get("_id") is not None else None,
            conversation_id=str(raw.get("conversationId", "")),
            role=str(raw.get("role", "")),
            content=str(raw.get("content", "")),
            created_at=raw.get("createdAt") or datetime.now(timezone.utc),
        )

    def to_mongo_insert(self) -> dict[str, Any]:
        return {
            "conversationId": self.conversation_id,
            "role": self.role,
            "content": self.content,
            "createdAt": self.created_at,
        }
