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

    def update_profile(self, *, user_id: str, nom: str, prenom: str, email: str) -> UserModel | None:
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
                }
            },
        )
        if result.matched_count == 0:
            return None

        raw = get_users_collection().find_one({"_id": object_id, "deletedAt": None})
        if not raw:
            return None
        return UserModel.from_mongo(raw)

    def upsert_user(self, *, nom: str, prenom: str, email: str, password_hash: str, role: str) -> str:
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
                    "deletedAt": None,
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
