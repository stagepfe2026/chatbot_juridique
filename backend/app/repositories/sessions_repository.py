from datetime import datetime, timezone

from app.database.connections import get_sessions_collection


class SessionsRepository:
    def create_session(self, *, user_id: str, token_hash: str, expires_at: datetime) -> str:
        inserted = get_sessions_collection().insert_one(
            {
                "userId": user_id,
                "tokenHash": token_hash,
                "expiresAt": expires_at,
                "createdAt": datetime.now(timezone.utc),
            }
        )
        return str(inserted.inserted_id)

    def get_active_session_by_token_hash(self, token_hash: str) -> dict | None:
        now = datetime.now(timezone.utc)
        return get_sessions_collection().find_one({"tokenHash": token_hash, "expiresAt": {"$gt": now}})

    def delete_session_by_token_hash(self, token_hash: str) -> None:
        get_sessions_collection().delete_many({"tokenHash": token_hash})

    def ensure_indexes(self) -> None:
        sessions = get_sessions_collection()
        sessions.create_index("tokenHash", unique=True)
        sessions.create_index("expiresAt", expireAfterSeconds=0)
