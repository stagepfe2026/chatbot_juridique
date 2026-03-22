from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


@dataclass
class AuditLogModel:
    user: str
    action: str
    resource: str
    status: str
    level: str
    ip: str
    timestamp: datetime
    details: dict[str, Any]
    id: str | None = None

    @classmethod
    def from_mongo(cls, raw: dict[str, Any]) -> "AuditLogModel":
        return cls(
            id=str(raw.get("_id")) if raw.get("_id") is not None else None,
            user=str(raw.get("user", "system")),
            action=str(raw.get("action", "UNKNOWN")),
            resource=str(raw.get("resource", "-")),
            status=str(raw.get("status", "SUCCESS")),
            level=str(raw.get("level", "INFO")),
            ip=str(raw.get("ip", "unknown")),
            timestamp=raw.get("timestamp") or datetime.now(timezone.utc),
            details=dict(raw.get("details") or {}),
        )

    def to_mongo_insert(self) -> dict[str, Any]:
        return {
            "user": self.user,
            "action": self.action,
            "resource": self.resource,
            "status": self.status,
            "level": self.level,
            "ip": self.ip,
            "timestamp": self.timestamp,
            "details": self.details,
        }
