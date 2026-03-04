from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import ChatOllama
import re

from app.core.config import settings
from app.models import MessageModel
from app.rag.prompts import UPDATE_SUMMARY_PROMPT_FR
from app.repositories import ConversationsRepository, MessagesRepository

_conversations_repo = ConversationsRepository()
_messages_repo = MessagesRepository()
_llm = None


def _get_llm():
    global _llm
    if _llm is None:
        _llm = ChatOllama(
            model=settings.ollama_model,
            base_url=settings.ollama_url,
            temperature=0.0,
        )
    return _llm


def ensure_conversation(conversation_id: str | None, user_id: str | None = None) -> str:
    return _conversations_repo.ensure_exists(conversation_id, user_id=user_id)


def save_message(conversation_id: str, role: str, content: str) -> str:
    if role not in {"user", "assistant"}:
        raise ValueError("role invalide")

    model = MessageModel.new(conversation_id=conversation_id, role=role, content=content)
    message_id = _messages_repo.create_message(model)
    _conversations_repo.touch(conversation_id)
    return message_id


def get_last_messages(conversation_id: str, limit: int) -> list[dict[str, str]]:
    items = _messages_repo.list_last_messages(conversation_id, limit=max(1, limit))
    return [{"role": item.role, "content": item.content} for item in items]


def get_conversation_summary(conversation_id: str) -> str:
    conversation = _conversations_repo.get_conversation_by_id(conversation_id)
    if not conversation:
        return ""
    return conversation.summary


def _format_recent_messages(messages: list[dict[str, str]]) -> str:
    rendered = "\n".join([f"{m['role']}: {m['content']}" for m in messages])
    max_chars = max(500, settings.memory_recent_messages_max_chars)
    if len(rendered) <= max_chars:
        return rendered
    return rendered[-max_chars:]


def _build_coverage_hints(messages: list[dict[str, str]]) -> str:
    user_questions = [m["content"].strip() for m in messages if m.get("role") == "user" and m.get("content")]
    if not user_questions:
        return "- Aucun point utilisateur recent."
    recent = user_questions[-4:]
    return "\n".join([f"- {item}" for item in recent])


def _clean_summary_text(raw: str) -> str:
    text = raw.strip()
    if not text:
        return ""

    lines = [line.strip() for line in text.splitlines()]
    cleaned: list[str] = []
    for line in lines:
        if not line:
            continue
        lowered = line.lower()
        if lowered.startswith("voici le resume"):
            continue
        if lowered.startswith("voici le résumé"):
            continue
        if lowered.startswith("resume mis a jour"):
            continue
        if lowered.startswith("résumé mis à jour"):
            continue
        cleaned.append(line)

    deduped: list[str] = []
    seen = set()
    for line in cleaned:
        key = re.sub(r"\s+", " ", line.lower())
        if key in seen:
            continue
        seen.add(key)
        deduped.append(line)

    return "\n".join(deduped[:10]).strip()


def update_conversation_summary(conversation_id: str) -> str:
    previous_summary = get_conversation_summary(conversation_id)
    recent_messages = get_last_messages(conversation_id, settings.summary_recent_messages_limit)
    if not recent_messages:
        return previous_summary

    prompt = ChatPromptTemplate.from_template(UPDATE_SUMMARY_PROMPT_FR).format_messages(
        previous_summary=previous_summary or "(vide)",
        coverage_hints=_build_coverage_hints(recent_messages),
        recent_messages=_format_recent_messages(recent_messages),
    )

    try:
        raw = _get_llm().invoke(prompt).content
        new_summary = _clean_summary_text(str(raw))
        if not new_summary:
            return previous_summary
        _conversations_repo.set_summary(conversation_id, new_summary)
        return new_summary
    except Exception:
        # Ne pas bloquer le flow: on garde l'ancien summary.
        return previous_summary


def ensure_conversation_memory_indexes() -> None:
    _conversations_repo.ensure_indexes()
    _messages_repo.ensure_indexes()
