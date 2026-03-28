from datetime import datetime, timezone

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from app.database.connections import get_users_collection
from app.models import UserModel


class UsersRepository:
    def find_active_by_email(self, email: str) -> UserModel | None:
        normalized = email.strip().lower()
        raw = get_users_collection().find_one({"email": normalized, "deletedAt": None})
        if not raw:
            return None
        return UserModel.from_mongo(raw)

    def find_active_by_id(self, user_id: str) -> UserModel | None:
        object_id = self._parse_user_id(user_id)
        if not object_id:
            return None

        raw = get_users_collection().find_one({"_id": object_id, "deletedAt": None})
        if not raw:
            return None
        return UserModel.from_mongo(raw)

    def update_profile(
        self,
        *,
        user_id: str,
        nom: str,
        prenom: str,
        email: str,
        telephone: str,
        adresse: str,
        date_naissance: str,
        direction: str,
        service: str,
        poste: str,
        matricule: str,
        bureau: str,
        responsable: str,
        membre_depuis: str,
        langue_preferee: str,
        theme_prefere: str,
        notifications_email: bool,
        notifications_sms: bool,
        two_factor_enabled: bool,
    ) -> UserModel | None:
        object_id = self._parse_user_id(user_id)
        if not object_id:
            return None

        normalized = email.strip().lower()
        collection = get_users_collection()

        try:
            result = collection.update_one(
                {"_id": object_id, "deletedAt": None},
                {
                    "$set": {
                        "nom": nom,
                        "prenom": prenom,
                        "email": normalized,
                        "telephone": telephone,
                        "adresse": adresse,
                        "dateNaissance": date_naissance,
                        "direction": direction,
                        "service": service,
                        "poste": poste,
                        "matricule": matricule,
                        "bureau": bureau,
                        "responsable": responsable,
                        "membreDepuis": membre_depuis,
                        "languePreferee": langue_preferee,
                        "themePrefere": theme_prefere,
                        "notificationsEmail": notifications_email,
                        "notificationsSms": notifications_sms,
                        "twoFactorEnabled": two_factor_enabled,
                    }
                },
            )
        except DuplicateKeyError:
            raise ValueError("EMAIL_ALREADY_USED") from None

        if result.matched_count == 0:
            return None

        raw = collection.find_one({"_id": object_id, "deletedAt": None})
        if not raw:
            return None
        return UserModel.from_mongo(raw)

    def update_password(self, *, user_id: str, password_hash: str) -> UserModel | None:
        object_id = self._parse_user_id(user_id)
        if not object_id:
            return None

        result = get_users_collection().update_one(
            {"_id": object_id, "deletedAt": None},
            {
                "$set": {
                    "password": password_hash,
                    "passwordUpdatedAt": datetime.now(timezone.utc),
                }
            },
        )
        if result.matched_count == 0:
            return None

        raw = get_users_collection().find_one({"_id": object_id, "deletedAt": None})
        if not raw:
            return None
        return UserModel.from_mongo(raw)

    def upsert_user(
        self,
        *,
        nom: str,
        prenom: str,
        email: str,
        password_hash: str,
        role: str,
        telephone: str,
        profile_image_url: str,
        adresse: str,
        date_naissance: str,
        direction: str,
        service: str,
        poste: str,
        matricule: str,
        bureau: str,
        responsable: str,
        membre_depuis: str,
        langue_preferee: str,
        theme_prefere: str,
        notifications_email: bool,
        notifications_sms: bool,
        two_factor_enabled: bool,
        password_updated_at: datetime,
    ) -> str:
        normalized = email.strip().lower()
        collection = get_users_collection()
        collection.update_one(
            {"email": normalized},
            {
                "$set": {
                    "nom": nom,
                    "prenom": prenom,
                    "email": normalized,
                    "password": password_hash,
                    "role": role,
                    "telephone": telephone,
                    "profileImageUrl": profile_image_url,
                    "adresse": adresse,
                    "dateNaissance": date_naissance,
                    "direction": direction,
                    "service": service,
                    "poste": poste,
                    "matricule": matricule,
                    "bureau": bureau,
                    "responsable": responsable,
                    "membreDepuis": membre_depuis,
                    "languePreferee": langue_preferee,
                    "themePrefere": theme_prefere,
                    "notificationsEmail": notifications_email,
                    "notificationsSms": notifications_sms,
                    "twoFactorEnabled": two_factor_enabled,
                    "passwordUpdatedAt": password_updated_at,
                    "deletedAt": None,
                },
                "$unset": {
                    "activeSessionsCount": "",
                    "loginHistory": "",
                },
                "$setOnInsert": {"createdAt": datetime.now(timezone.utc)},
            },
            upsert=True,
        )
        raw = collection.find_one({"email": normalized}, {"_id": 1})
        return str(raw["_id"])

    def ensure_indexes(self) -> None:
        get_users_collection().create_index("email", unique=True)

    @staticmethod
    def _parse_user_id(user_id: str) -> ObjectId | None:
        try:
            return ObjectId(user_id)
        except Exception:
            return None
