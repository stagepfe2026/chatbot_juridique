from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    FINANCE_USER = "FINANCE_USER"


@dataclass
class UserModel:
    nom: str
    prenom: str
    email: str
    password_hash: str
    role: UserRole
    created_at: datetime
    deleted_at: datetime | None = None
    id: str | None = None

    @classmethod
    def from_mongo(cls, raw: dict[str, Any]) -> "UserModel":
        role_value = str(raw.get("role", UserRole.FINANCE_USER.value))
        role = UserRole(role_value) if role_value in UserRole._value2member_map_ else UserRole.FINANCE_USER
        return cls(
            id=str(raw.get("_id")) if raw.get("_id") is not None else None,
            nom=str(raw.get("nom", "")),
            prenom=str(raw.get("prenom", "")),
            email=str(raw.get("email", "")).lower().strip(),
            password_hash=str(raw.get("password", "")),
            role=role,
            created_at=raw.get("createdAt") or datetime.now(timezone.utc),
            deleted_at=raw.get("deletedAt"),
        )

    def to_mongo_insert(self) -> dict[str, Any]:
        return {
            "nom": self.nom,
            "prenom": self.prenom,
            "email": self.email.lower().strip(),
            "password": self.password_hash,
            "role": self.role.value,
            "createdAt": self.created_at,
            "deletedAt": self.deleted_at,
        }

    def to_public_dict(self) -> dict[str, str]:
        return {
            "id": self.id or "",
            "nom": self.nom,
            "prenom": self.prenom,
            "email": self.email,
            "role": self.role.value,
        }
