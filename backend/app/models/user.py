from dataclasses import dataclass, field
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
    telephone: str = ""
    profile_image_url: str = ""
    adresse: str = ""
    date_naissance: str = ""
    direction: str = ""
    service: str = ""
    poste: str = ""
    matricule: str = ""
    bureau: str = ""
    responsable: str = ""
    membre_depuis: str = ""
    langue_preferee: str = "fr"
    theme_prefere: str = "light"
    notifications_email: bool = True
    notifications_sms: bool = False
    two_factor_enabled: bool = False
    password_updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
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
            telephone=str(raw.get("telephone", "")),
            profile_image_url=str(raw.get("profileImageUrl", "")),
            adresse=str(raw.get("adresse", "")),
            date_naissance=str(raw.get("dateNaissance", "")),
            direction=str(raw.get("direction", "")),
            service=str(raw.get("service", "")),
            poste=str(raw.get("poste", "")),
            matricule=str(raw.get("matricule", "")),
            bureau=str(raw.get("bureau", "")),
            responsable=str(raw.get("responsable", "")),
            membre_depuis=str(raw.get("membreDepuis", "")),
            langue_preferee=str(raw.get("languePreferee", "fr")),
            theme_prefere=str(raw.get("themePrefere", "light")),
            notifications_email=bool(raw.get("notificationsEmail", True)),
            notifications_sms=bool(raw.get("notificationsSms", False)),
            two_factor_enabled=bool(raw.get("twoFactorEnabled", False)),
            password_updated_at=raw.get("passwordUpdatedAt") or datetime.now(timezone.utc),
            deleted_at=raw.get("deletedAt"),
        )

    def to_mongo_insert(self) -> dict[str, Any]:
        return {
            "nom": self.nom,
            "prenom": self.prenom,
            "email": self.email.lower().strip(),
            "password": self.password_hash,
            "role": self.role.value,
            "telephone": self.telephone,
            "profileImageUrl": self.profile_image_url,
            "adresse": self.adresse,
            "dateNaissance": self.date_naissance,
            "direction": self.direction,
            "service": self.service,
            "poste": self.poste,
            "matricule": self.matricule,
            "bureau": self.bureau,
            "responsable": self.responsable,
            "membreDepuis": self.membre_depuis,
            "languePreferee": self.langue_preferee,
            "themePrefere": self.theme_prefere,
            "notificationsEmail": self.notifications_email,
            "notificationsSms": self.notifications_sms,
            "twoFactorEnabled": self.two_factor_enabled,
            "passwordUpdatedAt": self.password_updated_at,
            "createdAt": self.created_at,
            "deletedAt": self.deleted_at,
        }

    def to_public_dict(self) -> dict[str, Any]:
        return {
            "id": self.id or "",
            "nom": self.nom,
            "prenom": self.prenom,
            "email": self.email,
            "role": self.role.value,
            "telephone": self.telephone,
            "profileImageUrl": self.profile_image_url,
            "adresse": self.adresse,
            "dateNaissance": self.date_naissance,
            "direction": self.direction,
            "service": self.service,
            "poste": self.poste,
            "matricule": self.matricule,
            "bureau": self.bureau,
            "responsable": self.responsable,
            "membreDepuis": self.membre_depuis,
            "languePreferee": self.langue_preferee,
            "themePrefere": self.theme_prefere,
            "notificationsEmail": self.notifications_email,
            "notificationsSms": self.notifications_sms,
            "twoFactorEnabled": self.two_factor_enabled,
            "passwordUpdatedAt": self.password_updated_at.isoformat(),
        }
