from fastapi import APIRouter

from app.controllers.chat_controller import (
    create_question_controller,
    download_source_document_controller,
    get_question_sources_controller,
)
from app.schemas import AskQuestionRequest, AskQuestionResponse, SourceItem

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/questions", response_model=AskQuestionResponse)
def create_question(payload: AskQuestionRequest):
    return create_question_controller(payload)


@router.get("/questions/{question_id}/sources", response_model=list[SourceItem])
def get_question_sources(question_id: str):
    return get_question_sources_controller(question_id)


@router.get("/documents/{document_id}/download")
def download_source_document(document_id: str):
    return download_source_document_controller(document_id)
