from bson import ObjectId

from app.database.connections import get_messages_collection
from app.models.conversation_memory import MessageModel


class MessagesRepository:
    def create_message(self, model: MessageModel) -> str:
        object_id = self._parse_conversation_id(model.conversation_id)
        if not object_id:
            raise ValueError("conversationId invalide")

        inserted = get_messages_collection().insert_one(
            {
                "conversationId": object_id,
                "role": model.role,
                "content": model.content,
                "createdAt": model.created_at,
            }
        )
        return str(inserted.inserted_id)

    def list_last_messages(self, conversation_id: str, limit: int) -> list[MessageModel]:
        object_id = self._parse_conversation_id(conversation_id)
        if not object_id:
            return []

        cursor = (
            get_messages_collection()
            .find({"conversationId": object_id})
            .sort("createdAt", -1)
            .limit(limit)
        )
        items = [
            MessageModel(
                id=str(raw.get("_id")) if raw.get("_id") is not None else None,
                conversation_id=str(raw.get("conversationId")),
                role=str(raw.get("role", "")),
                content=str(raw.get("content", "")),
                created_at=raw.get("createdAt"),
            )
            for raw in cursor
        ]
        # Return chronologically as requested.
        return list(reversed(items))

    def list_messages(self, conversation_id: str, limit: int = 500) -> list[MessageModel]:
        object_id = self._parse_conversation_id(conversation_id)
        if not object_id:
            return []

        cursor = (
            get_messages_collection()
            .find({"conversationId": object_id})
            .sort("createdAt", 1)
            .limit(max(1, limit))
        )
        return [
            MessageModel(
                id=str(raw.get("_id")) if raw.get("_id") is not None else None,
                conversation_id=str(raw.get("conversationId")),
                role=str(raw.get("role", "")),
                content=str(raw.get("content", "")),
                created_at=raw.get("createdAt"),
            )
            for raw in cursor
        ]

    def count_messages(self, conversation_id: str) -> int:
        object_id = self._parse_conversation_id(conversation_id)
        if not object_id:
            return 0
        return int(get_messages_collection().count_documents({"conversationId": object_id}))

    def ensure_indexes(self) -> None:
        messages = get_messages_collection()
        messages.create_index([("conversationId", 1), ("createdAt", 1)])

    @staticmethod
    def _parse_conversation_id(conversation_id: str) -> ObjectId | None:
        try:
            return ObjectId(conversation_id)
        except Exception:
            return None
