from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


@dataclass
class ClaimModel:
    user_id: str
    user_email: str
    category: str
    priority: str
    subject: str
    description: str
    status: str
    attachments: list[dict[str, Any]]
    admin_reply: str | None
    admin_reply_at: datetime | None
    admin_reply_by: str | None
    is_reply_read_by_user: bool
    created_at: datetime
    updated_at: datetime
    id: str | None = None

    @classmethod
    def new(
        cls,
        *,
        user_id: str,
        user_email: str,
        category: str,
        priority: str,
        subject: str,
        description: str,
        attachments: list[dict[str, Any]],
    ) -> "ClaimModel":
        now = datetime.now(timezone.utc)
        return cls(
            user_id=user_id,
            user_email=user_email.strip().lower(),
            category=category.strip(),
            priority=priority.strip() or "NORMAL",
            subject=subject.strip(),
            description=description.strip(),
            status="SUBMITTED",
            attachments=attachments,
            admin_reply=None,
            admin_reply_at=None,
            admin_reply_by=None,
            is_reply_read_by_user=True,
            created_at=now,
            updated_at=now,
        )

    @classmethod
    def from_mongo(cls, raw: dict[str, Any]) -> "ClaimModel":
        created_at = raw.get("createdAt") or datetime.now(timezone.utc)
        attachments_raw = raw.get("attachments")
        attachments = [item for item in attachments_raw if isinstance(item, dict)] if isinstance(attachments_raw, list) else []
        return cls(
            id=str(raw.get("_id")) if raw.get("_id") is not None else None,
            user_id=str(raw.get("userId", "")),
            user_email=str(raw.get("userEmail", "")),
            category=str(raw.get("category", "OTHER")),
            priority=str(raw.get("priority", "NORMAL")),
            subject=str(raw.get("subject", "")),
            description=str(raw.get("description", "")),
            status=str(raw.get("status", "SUBMITTED")),
            attachments=attachments,
            admin_reply=raw.get("adminReply") if isinstance(raw.get("adminReply"), str) else None,
            admin_reply_at=raw.get("adminReplyAt"),
            admin_reply_by=raw.get("adminReplyBy") if isinstance(raw.get("adminReplyBy"), str) else None,
            is_reply_read_by_user=bool(raw.get("isReplyReadByUser", True)),
            created_at=created_at,
            updated_at=raw.get("updatedAt") or created_at,
        )

    def to_mongo_insert(self) -> dict[str, Any]:
        return {
            "userId": self.user_id,
            "userEmail": self.user_email,
            "category": self.category,
            "priority": self.priority,
            "subject": self.subject,
            "description": self.description,
            "status": self.status,
            "attachments": self.attachments,
            "adminReply": self.admin_reply,
            "adminReplyAt": self.admin_reply_at,
            "adminReplyBy": self.admin_reply_by,
            "isReplyReadByUser": self.is_reply_read_by_user,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        }
