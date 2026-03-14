from datetime import datetime, timezone
from pathlib import Path
import re
import threading

from fastapi import HTTPException, status
from langchain_community.embeddings import FastEmbedEmbeddings
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import ChatOllama
from langchain_qdrant import QdrantVectorStore

from app.core.config import settings
from app.database.connections import qdrant_client
from app.models import ChatQuestionModel
from app.rag.prompts import FINAL_ANSWER_PROMPT_FR, LEGAL_ANSWER_REVIEW_PROMPT_FR, NO_INFO_ANSWER_FR
from app.repositories import ChatQuestionsRepository, DocumentsRepository
from app.schemas import SourceFile, SourceItem
from app.services.conversation_memory_service import (
    ensure_conversation,
    get_conversation_summary,
    get_last_messages,
    save_message,
    update_conversation_summary,
)

_embeddings = None
_vector_store = None
_llm = None
_chat_questions_repo = ChatQuestionsRepository()
_documents_repo = DocumentsRepository()


def _get_embeddings():
    global _embeddings
    if _embeddings is None:
        _embeddings = FastEmbedEmbeddings(model_name=settings.embedding_model)
    return _embeddings


def _get_vector_store():
    global _vector_store
    if _vector_store is None:
        _vector_store = QdrantVectorStore(
            client=qdrant_client,
            collection_name=settings.qdrant_collection_name,
            embedding=_get_embeddings(),
        )
    return _vector_store


def _get_llm():
    global _llm
    if _llm is None:
        _llm = ChatOllama(
            model=settings.ollama_model,
            base_url=settings.ollama_url,
            temperature=0.0,
        )
    return _llm


def _retrieve_relevant_docs(question: str) -> list[Document]:
    try:
        scored = _get_vector_store().similarity_search_with_score(question, k=settings.retriever_k)
    except Exception:
        retriever = _get_vector_store().as_retriever(search_kwargs={"k": settings.retriever_k})
        return retriever.invoke(question)

    docs: list[Document] = []
    for doc, score in scored:
        try:
            numeric_score = float(score)
        except Exception:
            continue
        if numeric_score >= settings.retriever_min_score:
            docs.append(doc)
    return docs


def _to_source_items(docs: list[Document]) -> list[SourceItem]:
    items: list[SourceItem] = []
    for doc in docs:
        metadata = doc.metadata or {}
        page = metadata.get("page")
        items.append(
            SourceItem(
                documentId=str(metadata.get("document_id", "")),
                title=str(metadata.get("title", "Document juridique")),
                excerpt=doc.page_content[:500],
                page=str(page) if page is not None else None,
            )
        )
    return items


def _build_source_file(sources: list[SourceItem]) -> SourceFile | None:
    if not sources:
        return None
    first = sources[0]
    if not first.documentId:
        return None
    try:
        doc = _documents_repo.get_active_document_fields_by_id(first.documentId, {"filePath": 1})
    except HTTPException:
        return None
    if not doc:
        return None

    file_path = str(doc.get("filePath", "")).strip()
    if not file_path:
        return None
    filename = Path(file_path).name or f"{first.documentId}.bin"
    return SourceFile(
        documentId=first.documentId,
        filename=filename,
        downloadUrl=f"/api/chat/documents/{first.documentId}/download",
    )


def _to_plain_dict(data: object) -> dict:
    if hasattr(data, "model_dump"):
        return data.model_dump()
    return data.dict()  # type: ignore[attr-defined]


def _serialize_messages(messages: list[dict[str, str]]) -> str:
    rendered = "\n".join([f"{item['role']}: {item['content']}" for item in messages])
    max_chars = max(1000, settings.memory_recent_messages_max_chars)
    if len(rendered) <= max_chars:
        return rendered
    return rendered[-max_chars:]


def _is_summary_request(question: str) -> bool:
    normalized = question.lower().strip()
    triggers = (
        "resumer",
        "résumer",
        "resume",
        "résumé",
        "depuis le debut",
        "depuis le début",
        "ce que tu m'as deja explique",
        "ce que tu m'as déjà expliqué",
    )
    return any(token in normalized for token in triggers)


def _is_small_talk(question: str) -> bool:
    normalized = " ".join(question.lower().strip().split())
    if not normalized:
        return False

    exact_triggers = {
        "bonjour",
        "bonsoir",
        "salut",
        "hello",
        "hey",
        "coucou",
        "merci",
        "merci beaucoup",
        "ok",
        "ok merci",
        "d'accord",
        "ca va",
        "ca va ?",
        "comment ca va",
        "comment vas tu",
        "qui es tu",
        "qui es-tu",
    }
    if normalized in exact_triggers:
        return True

    small_talk_starts = (
        "bonjour",
        "bonsoir",
        "salut",
        "hello",
        "merci",
        "qui es",
        "comment ca va",
        "comment vas",
    )
    if any(normalized.startswith(prefix) for prefix in small_talk_starts):
        return True

    legal_terms = (
        "article",
        "loi",
        "code",
        "impot",
        "fiscal",
        "taxe",
        "tva",
        "societe",
        "contrat",
        "succession",
        "divorce",
        "bail",
        "export",
        "deduction",
    )
    if any(term in normalized for term in legal_terms):
        return False

    # Very short conversational messages should not trigger RAG retrieval.
    words = [word for word in normalized.replace("?", " ").replace("!", " ").split(" ") if word]
    return len(words) <= 3


def _build_small_talk_answer(question: str) -> str:
    normalized = question.lower().strip()
    if "merci" in normalized:
        return "Avec plaisir. Si vous avez une question juridique precise, je suis la pour vous aider."
    if "qui es" in normalized:
        return "Je suis votre assistant juridique. Je reponds aux questions a partir des documents disponibles."
    if "ca va" in normalized or "vas tu" in normalized:
        return "Je vais bien, merci. Quelle question juridique souhaitez-vous traiter ?"
    return "Bonjour. Je peux vous aider sur vos questions juridiques basees sur vos documents."


def _build_memory_only_answer(summary: str, last_messages: list[dict[str, str]]) -> str:
    if summary.strip():
        return "Voici le resume de notre conversation jusqu'ici :\n\n" + summary.strip()

    user_messages = [m["content"] for m in last_messages if m.get("role") == "user"][-5:]
    if not user_messages:
        return "Je n'ai pas encore assez d'elements pour faire un resume de la conversation."

    lines = "\n".join([f"- {msg}" for msg in user_messages])
    return "Je n'ai pas encore de resume consolide. Voici les derniers points abordes :\n" + lines


def _update_summary_async(conversation_id: str) -> None:
    def _runner():
        try:
            update_conversation_summary(conversation_id)
        except Exception:
            # Non bloquant: on ignore les erreurs de resume.
            return

    threading.Thread(target=_runner, daemon=True).start()


def _build_rag_context(docs: list[Document]) -> str:
    if not docs:
        return ""
    blocks: list[str] = []
    for index, doc in enumerate(docs, start=1):
        metadata = doc.metadata or {}
        title = str(metadata.get("title", "Document juridique"))
        document_id = str(metadata.get("document_id", ""))
        page = metadata.get("page")
        page_label = str(page) if page is not None else "n/a"
        blocks.append(
            "\n".join(
                [
                    f"[Source {index}]",
                    f"document: {title}",
                    f"page: {page_label}",
                    f"content: {doc.page_content}",
                ]
            )
        )
    return "\n\n".join(blocks)


def _extract_article_refs_from_context(rag_context: str) -> list[str]:
    found = re.findall(r"\barticle\s+(\d+)\b", rag_context, flags=re.IGNORECASE)
    unique: list[str] = []
    for value in found:
        if value not in unique:
            unique.append(value)
    return unique


def _sanitize_answer_references(answer: str, rag_context: str) -> str:
    rendered = answer.strip()
    if not rendered:
        return rendered

    # Avoid vague references like "sources 1, 2 et 3" in legal answers.
    if re.search(r"\bsources?\s*\d", rendered, flags=re.IGNORECASE):
        articles = _extract_article_refs_from_context(rag_context)
        if articles:
            rendered = re.sub(
                r"\bsources?\s*[\d,\set]+",
                f"articles {', '.join(articles[:6])}",
                rendered,
                flags=re.IGNORECASE,
            )

    # Remove technical chunk identifiers if the LLM echoes them.
    rendered = re.sub(r"\bchunk_\d+\b", "", rendered, flags=re.IGNORECASE)
    # Clean up dangling punctuation after removal.
    rendered = re.sub(r"\s*:\s*(?=[)\]])", "", rendered)
    rendered = re.sub(r"\s+et\s+(?=[)\],;\.])", " ", rendered, flags=re.IGNORECASE)
    rendered = re.sub(r"\(\s*\)", "", rendered)
    rendered = re.sub(r"\s{2,}", " ", rendered).strip()
    rendered = re.sub(r"\s+([,;:.])", r"\1", rendered)

    return rendered


def _review_answer_grounding(*, rag_context: str, user_question: str, draft_answer: str) -> str:
    prompt = ChatPromptTemplate.from_template(LEGAL_ANSWER_REVIEW_PROMPT_FR).format_messages(
        rag_context=rag_context,
        user_question=user_question,
        draft_answer=draft_answer,
    )
    try:
        reviewed = _get_llm().invoke(prompt).content
    except Exception:
        return draft_answer

    rendered = str(reviewed).strip()
    if not rendered:
        return draft_answer


    return rendered



def _generate_answer(*, summary: str, last_messages: list[dict[str, str]], rag_context: str, user_question: str) -> str:
    if not rag_context.strip():
        return NO_INFO_ANSWER_FR

    prompt = ChatPromptTemplate.from_template(FINAL_ANSWER_PROMPT_FR).format_messages(
        summary=summary or "(vide)",
        last_messages=_serialize_messages(last_messages),
        rag_context=rag_context,
        user_question=user_question,
    )
    try:
        answer = _get_llm().invoke(prompt).content
    except Exception:
        return NO_INFO_ANSWER_FR

    rendered = str(answer).strip()
    if not rendered:
        return NO_INFO_ANSWER_FR
    reviewed = _review_answer_grounding(
        rag_context=rag_context,
        user_question=user_question,
        draft_answer=rendered,
    )
    if reviewed == NO_INFO_ANSWER_FR:
        return reviewed
    sanitized = _sanitize_answer_references(reviewed, rag_context)
    return sanitized or NO_INFO_ANSWER_FR


def ask_question(
    question: str,
    user_id: str | None = None,
    conversation_id: str | None = None,
) -> tuple[str, str, list[SourceItem], SourceFile | None, str]:
    if not question.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Question vide.")

    asked_at = datetime.now(timezone.utc)
    resolved_conversation_id = ensure_conversation(conversation_id, user_id=user_id)

    save_message(resolved_conversation_id, "user", question.strip())
    last_messages = get_last_messages(resolved_conversation_id, settings.memory_last_messages_limit)
    summary = get_conversation_summary(resolved_conversation_id)

    docs: list[Document] = []
    sources: list[SourceItem] = []
    source_file: SourceFile | None = None
    if _is_summary_request(question):
        answer = _build_memory_only_answer(summary, last_messages)
    elif _is_small_talk(question):
        answer = _build_small_talk_answer(question)
    else:
        docs = _retrieve_relevant_docs(question.strip())
        sources = _to_source_items(docs)
        source_file = _build_source_file(sources)
        rag_context = _build_rag_context(docs)

        answer = _generate_answer(
            summary=summary,
            last_messages=last_messages,
            rag_context=rag_context,
            user_question=question.strip(),
        )

    used_document_context = bool(sources) and answer.strip() != NO_INFO_ANSWER_FR
    if not used_document_context:
        sources = []
        source_file = None
    answered_at = datetime.now(timezone.utc)
    question_model = ChatQuestionModel.new(
        question=question.strip(),
        answer=answer,
        sources=[_to_plain_dict(source) for source in sources],
        source_file=_to_plain_dict(source_file) if source_file else None,
        asked_at=asked_at,
        answered_at=answered_at,
        user_id=user_id,
        conversation_id=resolved_conversation_id,
    )
    question_id = _chat_questions_repo.create_question_record(question_model)

    save_message(
        resolved_conversation_id,
        "assistant",
        answer,
        question_id=question_id,
        source_file=_to_plain_dict(source_file) if source_file else None,
    )
    _update_summary_async(resolved_conversation_id)
    return question_id, answer, sources, source_file, resolved_conversation_id


def get_sources_for_question(question_id: str) -> list[SourceItem]:
    doc = _chat_questions_repo.get_question_record_by_id(question_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question introuvable.")

    raw_sources = doc.get("sources", [])
    if not isinstance(raw_sources, list):
        return []
    return [SourceItem(**item) for item in raw_sources if isinstance(item, dict)]


def get_source_file_for_question(question_id: str) -> SourceFile | None:
    doc = _chat_questions_repo.get_question_record_by_id(question_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question introuvable.")

    raw = doc.get("sourceFile")
    if not isinstance(raw, dict):
        return None
    return SourceFile(**raw)







def suggest_question_suggestions(query: str, limit: int = 5) -> list[str]:
    q = str(query or "").strip()
    if not q:
        return []
    # Only start suggesting after 3 typed words.
    words = [w for w in re.split(r"\s+", q) if w]
    if len(words) < 3:
        return []
    try:
        docs = _retrieve_relevant_docs(q)
    except Exception:
        return []

    suggestions: list[str] = []
    seen: set[str] = set()
    for doc in docs:
        meta = doc.metadata or {}
        title = str(meta.get("title") or "").strip()
        if not title:
            continue
        key = title.lower()
        if key in seen:
            continue
        seen.add(key)
        suggestions.append(title)
        if len(suggestions) >= max(1, int(limit)):
            break
    return suggestions

