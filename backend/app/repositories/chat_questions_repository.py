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

    @staticmethod
    def _parse_question_id(question_id: str) -> ObjectId:
        try:
            return ObjectId(question_id)
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="questionId invalide.") from exc
