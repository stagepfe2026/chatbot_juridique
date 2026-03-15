from fastapi import HTTPException, status

from app.repositories import ChatQuestionsRepository, ConversationsRepository, MessagesRepository
from app.schemas import ConversationMessageOut, ConversationOut, ConversationSummaryOut

_chat_repo = ChatQuestionsRepository()
_conversations_repo = ConversationsRepository()
_messages_repo = MessagesRepository()


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
            questionId=model.question_id,
            sourceFile=model.source_file,
            userId=model.user_id,
        )
        for model in records
    ]


def _shorten(value: str, max_len: int) -> str:
    text = value.strip()
    if not text:
        return ""
    if len(text) <= max_len:
        return text
    return text[: max_len - 3].rstrip() + "..."


def list_recent_conversations_by_user(user_id: str, limit: int = 100) -> list[ConversationSummaryOut]:
    conversations = _conversations_repo.list_recent_by_user(user_id=user_id, limit=limit)
    items: list[ConversationSummaryOut] = []
    for conversation in conversations:
        if not conversation.id:
            continue

        messages = _messages_repo.list_messages(conversation.id, limit=500)
        if not messages:
            title = _shorten(conversation.summary or "Conversation", 80) or "Conversation"
            preview = _shorten(conversation.summary, 140)
        else:
            first_user = next((m for m in messages if m.role == "user"), None)
            last_message = messages[-1]
            title = _shorten(first_user.content if first_user else conversation.summary or "Conversation", 80) or "Conversation"
            preview = _shorten(last_message.content, 140)

        items.append(
            ConversationSummaryOut(
                id=conversation.id,
                title=title,
                preview=preview,
                summary=conversation.summary,
                createdAt=conversation.created_at,
                updatedAt=conversation.updated_at,
                messageCount=_messages_repo.count_messages(conversation.id),
            )
        )

    return items


def list_conversation_messages_for_user(user_id: str, conversation_id: str, limit: int = 500) -> list[ConversationMessageOut]:
    if not _conversations_repo.can_access(conversation_id, user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation introuvable.")
    models = _messages_repo.list_messages(conversation_id, limit=limit)
    items: list[ConversationMessageOut] = []
    for model in models:
        question_id = getattr(model, "question_id", None)
        source_file = getattr(model, "source_file", None)
        # Backward-compat: older message records did not store questionId/sourceFile.
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
                content=model.content,
                createdAt=model.created_at,
                questionId=question_id,
                sourceFile=source_file,
            )
        )
    return items

