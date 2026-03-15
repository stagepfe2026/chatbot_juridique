from fastapi import APIRouter, Depends

from app.auth import get_current_user_from_request, require_role
from app.controllers.chat_controller import (
    create_question_with_user_controller,
    download_source_document_controller,
    get_question_sources_controller,
    get_question_suggestions_controller,
)
from app.controllers.conversations_controller import list_user_conversations_controller, list_user_conversation_messages_controller
from app.models import UserRole
from app.schemas import AskQuestionRequest, AskQuestionResponse, AuthUser, ConversationMessageOut, ConversationSummaryOut, SourceItem

router = APIRouter(
    prefix="/chat",
    tags=["chat"],
    dependencies=[Depends(require_role(UserRole.FINANCE_USER))],
)


@router.post("/questions", response_model=AskQuestionResponse)
def create_question(payload: AskQuestionRequest, current_user: AuthUser = Depends(get_current_user_from_request)):
    return create_question_with_user_controller(payload, current_user.id)


@router.get("/questions/{question_id}/sources", response_model=list[SourceItem])
def get_question_sources(question_id: str):
    return get_question_sources_controller(question_id)


@router.get("/documents/{document_id}/download")
def download_source_document(document_id: str):
    return download_source_document_controller(document_id)


@router.get("/conversations", response_model=list[ConversationSummaryOut])
def list_my_conversations(
    limit: int = 100,
    current_user: AuthUser = Depends(get_current_user_from_request),
):
    return list_user_conversations_controller(current_user.id, limit=limit)


@router.get("/conversations/{conversation_id}/messages", response_model=list[ConversationMessageOut])
def list_conversation_messages(
    conversation_id: str,
    limit: int = 500,
    current_user: AuthUser = Depends(get_current_user_from_request),
):
    return list_user_conversation_messages_controller(current_user.id, conversation_id, limit=limit)


@router.get("/suggestions", response_model=list[str])
def get_suggestions(
    query: str,
    limit: int = 5,
    current_user: AuthUser = Depends(get_current_user_from_request),
):
    return get_question_suggestions_controller(query, user_id=current_user.id, limit=limit)

