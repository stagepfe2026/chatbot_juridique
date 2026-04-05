from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


def _generate_ticket_number(now: datetime) -> str:
    return f"REC-{now.strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}"


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
    activity_log: list[dict[str, Any]]
    ticket_number: str | None = None
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
        normalized_email = user_email.strip().lower()
        return cls(
            user_id=user_id,
            user_email=normalized_email,
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
            activity_log=[
                {
                    "id": uuid4().hex,
                    "description": "Reclamation creee",
                    "actorName": normalized_email,
                    "createdAt": now,
                }
            ],
            ticket_number=_generate_ticket_number(now),
        )

    @classmethod
    def from_mongo(cls, raw: dict[str, Any]) -> "ClaimModel":
        created_at = raw.get("createdAt") or datetime.now(timezone.utc)
        attachments_raw = raw.get("attachments")
        activity_log_raw = raw.get("activityLog")
        attachments = [item for item in attachments_raw if isinstance(item, dict)] if isinstance(attachments_raw, list) else []
        activity_log = [item for item in activity_log_raw if isinstance(item, dict)] if isinstance(activity_log_raw, list) else []
        return cls(
            id=str(raw.get("_id")) if raw.get("_id") is not None else None,
            ticket_number=str(raw.get("ticketNumber", "")).strip() or None,
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
            activity_log=activity_log,
        )

    def to_mongo_insert(self) -> dict[str, Any]:
        return {
            "ticketNumber": self.ticket_number,
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
            "activityLog": self.activity_log,
        }
