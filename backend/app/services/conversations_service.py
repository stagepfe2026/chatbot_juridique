import re

from fastapi import HTTPException, status

from app.repositories import ChatQuestionsRepository, ConversationsRepository, MessagesRepository
from app.schemas import ConversationArchiveStateOut, ConversationMessageOut, ConversationOut, ConversationRenameOut, ConversationSummaryOut

_chat_repo = ChatQuestionsRepository()
_conversations_repo = ConversationsRepository()
_messages_repo = MessagesRepository()


# Retourne les dernieres questions/reponses historisees pour l'administration ou le debug.
def list_recent_conversations(limit: int = 200) -> list[ConversationOut]:
    records = _chat_repo.list_recent_question_records(limit=limit)
    return [
        ConversationOut(
            id=model.id or "",
            question=model.question,
            answer=model.answer,
            askedAt=model.asked_at,
            answeredAt=model.answered_at,
            createdAt=model.created_at,
            userId=model.user_id,
        )
        for model in records
    ]


# Tronque proprement un texte pour produire un titre ou un apercu court.
def _shorten(value: str, max_len: int) -> str:
    text = value.strip()
    if not text:
        return ""
    if len(text) <= max_len:
        return text
    return text[: max_len - 3].rstrip() + "..."


def _clean_legacy_user_message(content: str) -> str:
    text = str(content or "").strip()
    if not text:
        return ""

    match = re.search(r"question\s+utilisateur\s*:\s*(.+)$", text, flags=re.IGNORECASE | re.DOTALL)
    if match and re.search(r"instruction\s+de\s+re(?:s|p)onse\s*:", text, flags=re.IGNORECASE):
        return match.group(1).strip()
    return text


def _display_message_content(role: str, content: str) -> str:
    if role == "user":
        return _clean_legacy_user_message(content)
    return str(content or "").strip()


# Construit la liste resumee des conversations visibles par un utilisateur.
def list_recent_conversations_by_user(user_id: str, limit: int = 100) -> list[ConversationSummaryOut]:
    conversations = _conversations_repo.list_recent_by_user(user_id=user_id, limit=limit)
    items: list[ConversationSummaryOut] = []
    for conversation in conversations:
        if not conversation.id:
            continue

        messages = _messages_repo.list_messages(conversation.id, limit=500)
        if not messages:
            title = _shorten(conversation.custom_title or conversation.summary or "Conversation", 80) or "Conversation"
            preview = _shorten(conversation.summary, 140)
        else:
            first_user = next((m for m in messages if m.role == "user"), None)
            last_message = messages[-1]
            title_source = conversation.custom_title or (_display_message_content(first_user.role, first_user.content) if first_user else conversation.summary or "Conversation")
            title = _shorten(title_source, 80) or "Conversation"
            preview = _shorten(_display_message_content(last_message.role, last_message.content), 140)

        items.append(
            ConversationSummaryOut(
                id=conversation.id,
                title=title,
                preview=preview,
                summary=conversation.summary,
                createdAt=conversation.created_at,
                updatedAt=conversation.updated_at,
                messageCount=_messages_repo.count_messages(conversation.id),
                isArchived=conversation.is_archived,
                archivedAt=conversation.archived_at,
            )
        )

    return items


# Retourne les messages d'une conversation avec rattachement des sources si necessaire.
def list_conversation_messages_for_user(user_id: str, conversation_id: str, limit: int = 500) -> list[ConversationMessageOut]:
    if not _conversations_repo.can_access(conversation_id, user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation introuvable.")
    models = _messages_repo.list_messages(conversation_id, limit=limit)
    items: list[ConversationMessageOut] = []
    for model in models:
        question_id = getattr(model, "question_id", None)
        source_file = getattr(model, "source_file", None)
        if model.role == "assistant" and (not question_id or not source_file):
            record = _chat_repo.find_question_record_by_conversation_and_answer(conversation_id, model.content)
            if record:
                if record.get("_id") is not None:
                    question_id = str(record.get("_id"))
                raw_sf = record.get("sourceFile")
                if isinstance(raw_sf, dict):
                    source_file = raw_sf

        items.append(
            ConversationMessageOut(
                id=model.id or "",
                conversationId=conversation_id,
                role=model.role,
                content=_display_message_content(model.role, model.content),
                createdAt=model.created_at,
                questionId=question_id,
                sourceFile=source_file,
            )
        )
    return items


# Archive une conversation pour la masquer des listes actives de l'utilisateur.
def archive_conversation_for_user(user_id: str, conversation_id: str) -> ConversationArchiveStateOut:
    updated = _conversations_repo.set_archived_state(conversation_id=conversation_id, user_id=user_id, is_archived=True)
    if not updated or not updated.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation introuvable.")
    return ConversationArchiveStateOut(
        conversationId=updated.id,
        isArchived=True,
        archivedAt=updated.archived_at,
        updatedAt=updated.updated_at,
    )


# Restaure une conversation archivee dans les conversations actives.
def restore_conversation_for_user(user_id: str, conversation_id: str) -> ConversationArchiveStateOut:
    updated = _conversations_repo.set_archived_state(conversation_id=conversation_id, user_id=user_id, is_archived=False)
    if not updated or not updated.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation introuvable.")
    return ConversationArchiveStateOut(
        conversationId=updated.id,
        isArchived=False,
        archivedAt=updated.archived_at,
        updatedAt=updated.updated_at,
    )


# Renomme une conversation avec un titre personnalise par l'utilisateur.
def rename_conversation_for_user(user_id: str, conversation_id: str, title: str) -> ConversationRenameOut:
    updated = _conversations_repo.rename_conversation(conversation_id=conversation_id, user_id=user_id, title=title)
    if not updated or not updated.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation introuvable.")
    return ConversationRenameOut(conversationId=updated.id, title=(updated.custom_title or "Conversation"), updatedAt=updated.updated_at)


# Supprime la conversation et tous ses messages pour l'utilisateur concerne.
def delete_conversation_for_user(user_id: str, conversation_id: str) -> None:
    if not _conversations_repo.delete_conversation(conversation_id=conversation_id, user_id=user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation introuvable.")
    _messages_repo.delete_by_conversation(conversation_id)
