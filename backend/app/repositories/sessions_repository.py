from datetime import datetime, timezone

from pymongo.collection import Collection

from app.database.connections import get_sessions_collection


class SessionsRepository:
    @staticmethod
    def _collection() -> Collection:
        return get_sessions_collection()

    def create_session(self, *, user_id: str, token_hash: str, expires_at: datetime) -> str:
        inserted = self._collection().insert_one(
            {
                "userId": user_id,
                "tokenHash": token_hash,
                "expiresAt": expires_at,
                "createdAt": datetime.now(timezone.utc),
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

    def ensure_indexes(self) -> None:
        sessions = self._collection()
        expires_at_index = sessions.index_information().get("expiresAt_1")
        if expires_at_index and "expireAfterSeconds" in expires_at_index:
            sessions.drop_index("expiresAt_1")

        sessions.create_index("tokenHash", unique=True)
        sessions.create_index("expiresAt")
        sessions.create_index("closedAt")
        sessions.create_index([("userId", 1), ("createdAt", -1)])
