from app.schemas import AskQuestionRequest
from app.services.chat_service import create_chat_question, download_document_file, list_question_sources, list_question_suggestions


async def create_question_controller(payload: AskQuestionRequest):
    return await create_chat_question(payload.question, conversation_id=payload.conversationId)


async def create_question_with_user_controller(payload: AskQuestionRequest, user_id: str | None):
    return await create_chat_question(payload.question, user_id=user_id, conversation_id=payload.conversationId)


async def get_question_sources_controller(question_id: str):
    return await list_question_sources(question_id)


async def download_source_document_controller(document_id: str):
    return await download_document_file(document_id)


async def get_question_suggestions_controller(query: str, user_id: str | None = None, limit: int = 5):
    return await list_question_suggestions(query, user_id=user_id, limit=limit)
