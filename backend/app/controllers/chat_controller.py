from app.schemas import AskQuestionRequest
from app.services.chat_service import create_chat_question, download_document_file, list_question_sources


def create_question_controller(payload: AskQuestionRequest):
    return create_chat_question(payload.question)


def get_question_sources_controller(question_id: str):
    return list_question_sources(question_id)


def download_source_document_controller(document_id: str):
    return download_document_file(document_id)
