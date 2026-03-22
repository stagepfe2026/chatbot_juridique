from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


@dataclass
class ClaimModel:
    user_id: str
    user_email: str
    category: str
    subject: str
    description: str
    status: str
    created_at: datetime
    updated_at: datetime
    id: str | None = None

    @classmethod
    def new(cls, *, user_id: str, user_email: str, category: str, subject: str, description: str) -> "ClaimModel":
        now = datetime.now(timezone.utc)
        return cls(
            user_id=user_id,
            user_email=user_email.strip().lower(),
            category=category.strip(),
            subject=subject.strip(),
            description=description.strip(),
            status="SUBMITTED",
            created_at=now,
            updated_at=now,
        )

    @classmethod
    def from_mongo(cls, raw: dict[str, Any]) -> "ClaimModel":
        created_at = raw.get("createdAt") or datetime.now(timezone.utc)
        return cls(
            id=str(raw.get("_id")) if raw.get("_id") is not None else None,
            user_id=str(raw.get("userId", "")),
            user_email=str(raw.get("userEmail", "")),
            category=str(raw.get("category", "OTHER")),
            subject=str(raw.get("subject", "")),
            description=str(raw.get("description", "")),
            status=str(raw.get("status", "SUBMITTED")),
            created_at=created_at,
            updated_at=raw.get("updatedAt") or created_at,
        )

    def to_mongo_insert(self) -> dict[str, Any]:
        return {
            "userId": self.user_id,
            "userEmail": self.user_email,
            "category": self.category,
            "subject": self.subject,
            "description": self.description,
            "status": self.status,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        }
