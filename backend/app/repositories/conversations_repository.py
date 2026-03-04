from datetime import datetime, timezone

from bson import ObjectId

from app.database.connections import get_conversations_collection
from app.models.conversation_memory import ConversationModel


class ConversationsRepository:
    def create_conversation(self, summary: str = "", user_id: str | None = None) -> str:
        model = ConversationModel.new(summary=summary)
        model.user_id = user_id
        inserted = get_conversations_collection().insert_one(model.to_mongo_insert())
        return str(inserted.inserted_id)

    def get_conversation_by_id(self, conversation_id: str) -> ConversationModel | None:
        object_id = self._parse_id(conversation_id)
        if not object_id:
            return None
        raw = get_conversations_collection().find_one({"_id": object_id})
        if not raw:
            return None
        return ConversationModel.from_mongo(raw)

    def set_summary(self, conversation_id: str, summary: str) -> None:
        object_id = self._parse_id(conversation_id)
        if not object_id:
            return
        get_conversations_collection().update_one(
            {"_id": object_id},
            {
                "$set": {
                    "summary": summary.strip(),
                    "updatedAt": datetime.now(timezone.utc),
                }
            },
        )

    def touch(self, conversation_id: str) -> None:
        object_id = self._parse_id(conversation_id)
        if not object_id:
            return
        get_conversations_collection().update_one(
            {"_id": object_id},
            {"$set": {"updatedAt": datetime.now(timezone.utc)}},
        )

    def list_recent_by_user(self, user_id: str, limit: int = 100) -> list[ConversationModel]:
        cursor = (
            get_conversations_collection()
            .find({"userId": user_id})
            .sort("updatedAt", -1)
            .limit(limit)
        )
        return [ConversationModel.from_mongo(raw) for raw in cursor]

    def can_access(self, conversation_id: str, user_id: str) -> bool:
        conversation = self.get_conversation_by_id(conversation_id)
        if not conversation:
            return False
        return conversation.user_id == user_id

    def ensure_exists(self, conversation_id: str | None, user_id: str | None = None) -> str:
        if conversation_id:
            existing = self.get_conversation_by_id(conversation_id)
            if existing and existing.id:
                if existing.user_id is None and user_id:
                    object_id = self._parse_id(conversation_id)
                    if object_id:
                        get_conversations_collection().update_one(
                            {"_id": object_id},
                            {"$set": {"userId": user_id, "updatedAt": datetime.now(timezone.utc)}},
                        )
                    return existing.id
                if user_id is None or existing.user_id == user_id:
                    return existing.id
                # Conversation d'un autre utilisateur: on crée une nouvelle conversation.
                return self.create_conversation(summary="", user_id=user_id)
        return self.create_conversation(summary="", user_id=user_id)

    def ensure_indexes(self) -> None:
        conversations = get_conversations_collection()
        conversations.create_index("updatedAt")
        conversations.create_index([("userId", 1), ("updatedAt", -1)])

    @staticmethod
    def _parse_id(raw_id: str) -> ObjectId | None:
        try:
            return ObjectId(raw_id)
        except Exception:
            return None
