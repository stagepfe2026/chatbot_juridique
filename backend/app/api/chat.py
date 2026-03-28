from fastapi import APIRouter, Depends, Request, status

from app.auth import get_current_user_from_request, require_role
from app.controllers.chat_controller import (
    create_question_with_user_controller,
    download_source_document_controller,
    get_question_sources_controller,
    get_question_suggestions_controller,
)
from app.controllers.conversations_controller import (
    archive_user_conversation_controller,
    list_user_conversation_messages_controller,
    list_user_conversations_controller,
    restore_user_conversation_controller,
    rename_user_conversation_controller,
    delete_user_conversation_controller,
)
from app.models import UserRole
from app.schemas import (
    AskQuestionRequest,
    AskQuestionResponse,
    AuditLogLevel,
    AuditLogStatus,
    AuthUser,
    ConversationArchiveStateOut,
    ConversationMessageOut,
    ConversationRenameOut,
    ConversationRenameRequest,
    ConversationSummaryOut,
    SourceItem,
)
from app.services.audit_logs_service import record_audit_event

router = APIRouter(
    prefix="/chat",
    tags=["chat"],
    dependencies=[Depends(require_role(UserRole.FINANCE_USER))],
)


def _preview_text(value: str, max_len: int = 80) -> str:
    text = value.strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 3].rstrip() + "..."


@router.post("/questions", response_model=AskQuestionResponse)
async def create_question(
    payload: AskQuestionRequest,
    request: Request,
    current_user: AuthUser = Depends(get_current_user_from_request),
):
    response = await create_question_with_user_controller(payload, current_user.id)
    record_audit_event(
        request=request,
        action="CHAT_QUESTION",
        user=current_user.email,
        resource=response.conversationId,
        status=AuditLogStatus.SUCCESS,
        level=AuditLogLevel.INFO,
        message="Question envoyee au chatbot.",
        payload={
            "conversationId": response.conversationId,
            "questionId": response.questionId,
            "questionPreview": _preview_text(payload.question, 120),
            "sourcesCount": len(response.sources),
            "hasSourceFile": response.sourceFile is not None,
            "responseMode": payload.responseMode.value,
        },
    )
    return response


@router.get("/questions/{question_id}/sources", response_model=list[SourceItem])
async def get_question_sources(
    question_id: str,
    request: Request,
    current_user: AuthUser = Depends(get_current_user_from_request),
):
    sources = await get_question_sources_controller(question_id)
    record_audit_event(
        request=request,
        action="VIEW_SOURCES",
        user=current_user.email,
        resource=question_id,
        status=AuditLogStatus.SUCCESS,
        level=AuditLogLevel.INFO,
        message="Consultation des sources d'une reponse.",
        payload={"questionId": question_id, "sourcesCount": len(sources)},
    )
    return sources


@router.get("/documents/{document_id}/download")
async def download_source_document(
    document_id: str,
    request: Request,
    current_user: AuthUser = Depends(get_current_user_from_request),
):
    response = await download_source_document_controller(document_id)
    record_audit_event(
        request=request,
        action="DOWNLOAD_DOC",
        user=current_user.email,
        resource=document_id,
        status=AuditLogStatus.SUCCESS,
        level=AuditLogLevel.INFO,
        message="Telechargement d'un document source.",
        payload={"documentId": document_id},
    )
    return response


@router.get("/conversations", response_model=list[ConversationSummaryOut])
def list_my_conversations(
    request: Request,
    limit: int = 100,
    current_user: AuthUser = Depends(get_current_user_from_request),
):
    conversations = list_user_conversations_controller(current_user.id, limit=limit)
    record_audit_event(
        request=request,
        action="VIEW_CONVERSATIONS",
        user=current_user.email,
        resource="conversation-list",
        status=AuditLogStatus.SUCCESS,
        level=AuditLogLevel.INFO,
        message="Consultation de la liste des conversations.",
        payload={"count": len(conversations), "limit": limit},
    )
    return conversations


@router.get("/conversations/{conversation_id}/messages", response_model=list[ConversationMessageOut])
def list_conversation_messages(
    conversation_id: str,
    request: Request,
    limit: int = 500,
    current_user: AuthUser = Depends(get_current_user_from_request),
):
    messages = list_user_conversation_messages_controller(current_user.id, conversation_id, limit=limit)
    record_audit_event(
        request=request,
        action="VIEW_CONVERSATION",
        user=current_user.email,
        resource=conversation_id,
        status=AuditLogStatus.SUCCESS,
        level=AuditLogLevel.INFO,
        message="Consultation d'une conversation.",
        payload={"conversationId": conversation_id, "messageCount": len(messages), "limit": limit},
    )
    return messages


@router.post("/conversations/{conversation_id}/archive", response_model=ConversationArchiveStateOut)
def archive_conversation(
    conversation_id: str,
    request: Request,
    current_user: AuthUser = Depends(get_current_user_from_request),
):
    result = archive_user_conversation_controller(current_user.id, conversation_id)
    record_audit_event(
        request=request,
        action="ARCHIVE_CONVERSATION",
        user=current_user.email,
        resource=conversation_id,
        status=AuditLogStatus.SUCCESS,
        level=AuditLogLevel.INFO,
        message="Archivage d'une conversation utilisateur.",
        payload={"conversationId": conversation_id},
    )
    return result


@router.post("/conversations/{conversation_id}/restore", response_model=ConversationArchiveStateOut)
def restore_conversation(
    conversation_id: str,
    request: Request,
    current_user: AuthUser = Depends(get_current_user_from_request),
):
    result = restore_user_conversation_controller(current_user.id, conversation_id)
    record_audit_event(
        request=request,
        action="RESTORE_CONVERSATION",
        user=current_user.email,
        resource=conversation_id,
        status=AuditLogStatus.SUCCESS,
        level=AuditLogLevel.INFO,
        message="Restauration d'une conversation utilisateur.",
        payload={"conversationId": conversation_id},
    )
    return result


@router.get("/suggestions", response_model=list[str])
async def get_suggestions(
    query: str,
    request: Request,
    limit: int = 5,
    current_user: AuthUser = Depends(get_current_user_from_request),
):
    suggestions = await get_question_suggestions_controller(query, user_id=current_user.id, limit=limit)
    record_audit_event(
        request=request,
        action="CHAT_SUGGESTIONS",
        user=current_user.email,
        resource="chat-suggestions",
        status=AuditLogStatus.SUCCESS,
        level=AuditLogLevel.INFO,
        message="Generation de suggestions de questions.",
        payload={"queryPreview": _preview_text(query, 80), "count": len(suggestions), "limit": limit},
    )
    return suggestions


@router.post('/conversations/{conversation_id}/rename', response_model=ConversationRenameOut)
def rename_conversation(
    conversation_id: str,
    payload: ConversationRenameRequest,
    request: Request,
    current_user: AuthUser = Depends(get_current_user_from_request),
):
    result = rename_user_conversation_controller(current_user.id, conversation_id, payload.title)
    record_audit_event(
        request=request,
        action='RENAME_CONVERSATION',
        user=current_user.email,
        resource=conversation_id,
        status=AuditLogStatus.SUCCESS,
        level=AuditLogLevel.INFO,
        message="Renommage conversation utilisateur.",
        payload={'conversationId': conversation_id, 'title': _preview_text(payload.title, 120)},
    )
    return result


@router.delete('/conversations/{conversation_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: str,
    request: Request,
    current_user: AuthUser = Depends(get_current_user_from_request),
):
    delete_user_conversation_controller(current_user.id, conversation_id)
    record_audit_event(
        request=request,
        action='DELETE_CONVERSATION',
        user=current_user.email,
        resource=conversation_id,
        status=AuditLogStatus.SUCCESS,
        level=AuditLogLevel.INFO,
        message="Suppression conversation utilisateur.",
        payload={'conversationId': conversation_id},
    )
    return None
