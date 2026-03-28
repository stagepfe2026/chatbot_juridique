from datetime import datetime, timezone

from pymongo.collection import Collection

from app.database.connections import get_sessions_collection


class SessionsRepository:
    @staticmethod
    def _collection() -> Collection:
        return get_sessions_collection()

    def create_session(self, *, user_id: str, token_hash: str, expires_at: datetime, user_agent: str, ip_address: str) -> str:
        inserted = self._collection().insert_one(
            {
                "userId": user_id,
                "tokenHash": token_hash,
                "expiresAt": expires_at,
                "createdAt": datetime.now(timezone.utc),
                "userAgent": user_agent,
                "ipAddress": ip_address,
                "closedAt": None,
                "closeReason": None,
                "closedBeforeExpiry": False,
            }
        )
        return str(inserted.inserted_id)

    def get_active_session_by_token_hash(self, token_hash: str) -> dict | None:
        now = datetime.now(timezone.utc)
        return self._collection().find_one(
            {
                "tokenHash": token_hash,
                "expiresAt": {"$gt": now},
                "closedAt": None,
            }
        )

    def list_recent_sessions_by_user_id(self, *, user_id: str, limit: int = 6) -> list[dict]:
        cursor = (
            self._collection()
            .find({"userId": user_id})
            .sort("createdAt", -1)
            .limit(limit)
        )
        return list(cursor)

    def count_active_sessions_by_user_id(self, *, user_id: str) -> int:
        now = datetime.now(timezone.utc)
        return self._collection().count_documents(
            {
                "userId": user_id,
                "expiresAt": {"$gt": now},
                "closedAt": None,
            }
        )

    def close_session_by_token_hash(self, token_hash: str, *, close_reason: str) -> None:
        now = datetime.now(timezone.utc)
        self._collection().update_one(
            {
                "tokenHash": token_hash,
                "closedAt": None,
            },
            {
                "$set": {
                    "closedAt": now,
                    "closeReason": close_reason,
                    "closedBeforeExpiry": True,
                }
            },
        )

    def close_all_sessions_by_user_id(self, *, user_id: str, close_reason: str) -> int:
        now = datetime.now(timezone.utc)
        result = self._collection().update_many(
            {
                "userId": user_id,
                "closedAt": None,
                "expiresAt": {"$gt": now},
            },
            {
                "$set": {
                    "closedAt": now,
                    "closeReason": close_reason,
                    "closedBeforeExpiry": True,
                }
            },
        )
        return int(result.modified_count)

    def ensure_indexes(self) -> None:
        sessions = self._collection()
        expires_at_index = sessions.index_information().get("expiresAt_1")
        if expires_at_index and "expireAfterSeconds" in expires_at_index:
            sessions.drop_index("expiresAt_1")

        sessions.create_index("tokenHash", unique=True)
        sessions.create_index("expiresAt")
        sessions.create_index("closedAt")
        sessions.create_index([("userId", 1), ("createdAt", -1)])
