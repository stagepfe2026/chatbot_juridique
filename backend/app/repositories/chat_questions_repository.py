from bson import ObjectId
from fastapi import HTTPException, status

from app.database.connections import get_chat_questions_collection
from app.models import ChatQuestionModel


class ChatQuestionsRepository:
    def create_question_record(self, model: ChatQuestionModel) -> str:
        inserted = get_chat_questions_collection().insert_one(model.to_mongo_insert())
        return str(inserted.inserted_id)

    def get_question_record_by_id(self, question_id: str) -> dict | None:
        return get_chat_questions_collection().find_one({"_id": self._parse_question_id(question_id)})

    def list_recent_question_records(self, limit: int = 200) -> list[ChatQuestionModel]:
        cursor = (
            get_chat_questions_collection()
            .find({})
            .sort("createdAt", -1)
            .limit(limit)
        )
        return [ChatQuestionModel.from_mongo(item) for item in cursor]

    def list_recent_question_records_by_user(self, user_id: str, limit: int = 200) -> list[ChatQuestionModel]:
        cursor = (
            get_chat_questions_collection()
            .find({"userId": user_id})
            .sort("createdAt", -1)
            .limit(limit)
        )
        return [ChatQuestionModel.from_mongo(item) for item in cursor]

    @staticmethod
    def _parse_question_id(question_id: str) -> ObjectId:
        try:
            return ObjectId(question_id)
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="questionId invalide.") from exc
