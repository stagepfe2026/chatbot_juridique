from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

from datetime import datetime, timezone

from pathlib import Path

import logging

import re

import threading

import unicodedata

from typing import Any



from fastapi import HTTPException, status


from langchain_core.documents import Document

from langchain_core.prompts import ChatPromptTemplate

from langchain_ollama import ChatOllama

from langchain_qdrant import QdrantVectorStore



from app.core.config import settings

from app.database.connections import qdrant_client

from app.models import ChatQuestionModel
from app.rag.embeddings import get_embeddings

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

_RETRIEVAL_STOPWORDS = {

    "le", "la", "les", "de", "des", "du", "d", "un", "une", "et", "ou", "a", "au", "aux",

    "dans", "sur", "pour", "par", "avec", "sans", "en", "est", "sont", "quel", "quels",

    "quelle", "quelles", "que", "qui", "quoi", "comment", "entre", "versus", "vs",

}

_COMPARATIVE_TRIGGERS = (

    "compare",

    "comparaison",

    "difference",

    "differences",

    "differe",

    "differente",

    "differents",

    "versus",

    " vs ",

    "par rapport a",

    "plutot que",

    "avantage",

    "inconvenient",

)

_PROMPT_LEAK_MARKERS = (

    "tu es un verificateur juridique",

    "ta mission:",

    "regles obligatoires",

    "rag_context:",

    "user_question:",

    "draft_answer:",

    "last_messages:",

    "summary:",

)

_COVERAGE_SIGNAL_STOPWORDS = {
    "article", "articles", "point", "points", "alin?a", "alinea", "loi", "code", "present", "pr?sent",
    "ajoute", "ajout?", "ajoutee", "ajoutees", "ajout?es", "relatif", "relative", "portant", "titre",
    "beneficiaires", "b?n?ficiaires", "beneficiaire", "b?n?ficiaire", "fonds", "protection", "sociale",
    "travailleuses", "agricoles", "travailleurs", "agricoles", "sont", "dans", "pour", "leurs", "leurs",
    "cette", "ces", "ainsi", "meme", "m?me", "ladite", "audit", "dudit", "prevues", "pr?vues",
    "prevu", "pr?vu", "ainsi", "telle", "telles", "comme", "toute", "toutes"
}

_LLM_EXECUTOR = ThreadPoolExecutor(max_workers=4)

logger = logging.getLogger(__name__)





class LLMTimeoutError(Exception):

    pass





LLM_TIMEOUT_ANSWER_FR = "La generation de la reponse a depasse le delai autorise. Veuillez reessayer ou reformuler votre question."





def _get_embeddings():
    return get_embeddings()





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

        fetch_k = settings.retriever_comparative_fetch_k if _is_comparative_question(question) else settings.retriever_fetch_k

        scored = _get_vector_store().similarity_search_with_score(question, k=max(fetch_k, settings.retriever_k))

    except Exception:

        retriever = _get_vector_store().as_retriever(

            search_kwargs={"k": max(settings.retriever_fetch_k, settings.retriever_k)}

        )

        docs = retriever.invoke(question)

        return _select_relevant_docs(question, [(doc, 1.0) for doc in docs])



    return _select_relevant_docs(question, scored)





def _normalize_retrieval_text(value: str) -> str:

    return re.sub(r"\s+", " ", str(value or "").strip().lower())





def _tokenize_retrieval_text(value: str) -> list[str]:

    return re.findall(r"\w+", _normalize_retrieval_text(value), flags=re.UNICODE)





def _extract_query_keywords(question: str) -> list[str]:

    return [

        token for token in _tokenize_retrieval_text(question)

        if len(token) > 2 and token not in _RETRIEVAL_STOPWORDS

    ]





def _extract_query_focus_groups(question: str) -> list[set[str]]:

    raw_parts = [part.strip() for part in re.split(r"\?|,|;| et | ou ", str(question or ""), flags=re.IGNORECASE) if part.strip()]

    groups: list[set[str]] = []

    for part in raw_parts:

        tokens = {token for token in _extract_query_keywords(part) if len(token) > 3}

        if tokens:

            groups.append(tokens)



    if not groups:

        fallback = {token for token in _extract_query_keywords(question) if len(token) > 3}

        if fallback:

            groups.append(fallback)

    return groups





def _group_coverage_score(doc_text: str, focus_groups: list[set[str]]) -> float:

    if not focus_groups:

        return 0.0

    tokens = set(_tokenize_retrieval_text(doc_text))

    covered = 0

    partial = 0.0

    for group in focus_groups:

        overlap = len(group & tokens)

        if overlap > 0:

            covered += 1

            partial += overlap / max(1, len(group))

    return (covered * 0.12) + (partial * 0.08)





def _is_comparative_question(question: str) -> bool:

    normalized = f" {_normalize_retrieval_text(question)} "

    return any(trigger in normalized for trigger in _COMPARATIVE_TRIGGERS)





def _document_key(doc: Document) -> str:

    metadata = doc.metadata or {}

    document_id = str(metadata.get("document_id", "")).strip()

    if document_id:

        return document_id

    return str(metadata.get("title", "")).strip() or "unknown-document"





def _chunk_key(doc: Document) -> str:

    normalized_content = _normalize_retrieval_text(doc.page_content[:220])

    articles = ",".join(sorted(_extract_article_numbers(doc.page_content)))

    return f"{articles}::{normalized_content}"





def _extract_article_numbers(text: str) -> set[str]:

    return set(re.findall(r"\barticle\s+(\d+)\b", str(text or ""), flags=re.IGNORECASE))





def _cosine_similarity(left: list[float], right: list[float]) -> float:

    if not left or not right or len(left) != len(right):

        return 0.0

    dot = sum(a * b for a, b in zip(left, right))

    norm_left = sum(a * a for a in left) ** 0.5

    norm_right = sum(b * b for b in right) ** 0.5

    if norm_left == 0 or norm_right == 0:

        return 0.0

    return dot / (norm_left * norm_right)





def _build_rerank_features(question: str, doc: Document, base_score: float) -> dict[str, float]:

    query_keywords = _extract_query_keywords(question)

    doc_text = f"{doc.metadata.get('title', '')} {doc.page_content}"

    doc_tokens = set(_tokenize_retrieval_text(doc_text))

    overlap = sum(1 for token in query_keywords if token in doc_tokens)

    overlap_score = (overlap / max(1, len(query_keywords))) if query_keywords else 0.0



    query_articles = _extract_article_numbers(question)

    doc_articles = _extract_article_numbers(doc_text)

    article_bonus = 0.25 if query_articles and query_articles.intersection(doc_articles) else 0.0

    comparative_bonus = 0.05 if _is_comparative_question(question) and len(doc_articles) > 0 else 0.0

    focus_bonus = _group_coverage_score(doc_text, _extract_query_focus_groups(question))



    return {

        "base_score": base_score,

        "lexical_overlap": overlap_score,

        "article_bonus": article_bonus,

        "comparative_bonus": comparative_bonus,

        "focus_bonus": focus_bonus,

    }





def _embed_candidate_texts(question: str, docs: list[Document]) -> tuple[list[float] | None, list[list[float]]]:

    if not settings.retriever_use_semantic_rerank:

        return None, []

    try:

        embeddings = _get_embeddings()

        query_embedding = embeddings.embed_query(question)

        doc_embeddings = embeddings.embed_documents([doc.page_content for doc in docs])

        return list(query_embedding), [list(vector) for vector in doc_embeddings]

    except Exception:

        return None, []





def _select_relevant_docs(question: str, scored_candidates: list[tuple[Document, float | int | Any]]) -> list[Document]:

    filtered: list[tuple[Document, float]] = []

    seen_chunks: set[str] = set()

    for doc, score in scored_candidates:

        try:

            numeric_score = float(score)

        except Exception:

            continue

        if numeric_score < settings.retriever_min_score:

            continue

        key = _chunk_key(doc)

        if key in seen_chunks:

            continue

        seen_chunks.add(key)

        filtered.append((doc, numeric_score))



    if not filtered:

        return []



    docs = [doc for doc, _ in filtered]

    query_embedding, doc_embeddings = _embed_candidate_texts(question, docs)

    comparative = _is_comparative_question(question)



    candidates: list[dict[str, Any]] = []

    for index, (doc, base_score) in enumerate(filtered):

        features = _build_rerank_features(question, doc, base_score)

        semantic_bonus = 0.0

        if query_embedding is not None and index < len(doc_embeddings):

            semantic_bonus = max(0.0, _cosine_similarity(query_embedding, doc_embeddings[index])) * 0.2

        rerank_score = (

            features["base_score"]

            + (features["lexical_overlap"] * 0.35)

            + features["article_bonus"]

            + features["comparative_bonus"]

            + features["focus_bonus"]

            + semantic_bonus

        )

        candidates.append(

            {

                "doc": doc,

                "document_key": _document_key(doc),

                "rerank_score": rerank_score,

                "embedding": doc_embeddings[index] if index < len(doc_embeddings) else None,

            }

        )



    candidates.sort(key=lambda item: item["rerank_score"], reverse=True)

    target_k = max(1, int(settings.retriever_k))

    max_per_document = max(1, int(settings.retriever_max_per_document))



    selected: list[dict[str, Any]] = []

    document_counts: dict[str, int] = {}



    def _can_add(candidate: dict[str, Any]) -> bool:

        current = document_counts.get(candidate["document_key"], 0)

        return current < max_per_document



    if comparative:

        for candidate in candidates:

            if len(selected) >= min(target_k, 2):

                break

            if document_counts.get(candidate["document_key"], 0) > 0:

                continue

            selected.append(candidate)

            document_counts[candidate["document_key"]] = 1



    while len(selected) < target_k:

        best_candidate: dict[str, Any] | None = None

        best_score = float("-inf")



        for candidate in candidates:

            if candidate in selected or not _can_add(candidate):

                continue



            mmr_penalty = 0.0

            if candidate["embedding"] is not None and selected:

                similarities = [

                    _cosine_similarity(candidate["embedding"], chosen["embedding"])

                    for chosen in selected

                    if chosen["embedding"] is not None

                ]

                mmr_penalty = max(similarities) if similarities else 0.0



            same_doc_penalty = settings.retriever_same_document_penalty * document_counts.get(candidate["document_key"], 0)

            mmr_score = (

                (settings.retriever_mmr_lambda * candidate["rerank_score"])

                - ((1 - settings.retriever_mmr_lambda) * mmr_penalty)

                - same_doc_penalty

            )

            if comparative and document_counts.get(candidate["document_key"], 0) == 0:

                mmr_score += 0.08



            if mmr_score > best_score:

                best_score = mmr_score

                best_candidate = candidate



        if best_candidate is None:

            break



        selected.append(best_candidate)

        document_counts[best_candidate["document_key"]] = document_counts.get(best_candidate["document_key"], 0) + 1



    return [candidate["doc"] for candidate in selected]





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





def _is_single_article_legal_block(content: str) -> bool:

    clean = re.sub(r"\s+", " ", str(content or "")).strip()

    if not clean:

        return False

    has_heading = bool(re.search(r"\b(?:article|art\.)\s+\d+\b", clean, flags=re.IGNORECASE))

    article_refs = _extract_article_numbers(clean)

    return has_heading and len(article_refs) <= 1





def _truncate_legal_block(content: str, max_chars: int) -> str:

    clean = re.sub(r"\s+", " ", str(content or "")).strip()

    if len(clean) <= max_chars:

        return clean

    return clean[:max_chars].rstrip() + "..."





def _build_context_excerpt(question: str, content: str, max_chars: int = 1100) -> str:

    clean = re.sub(r"\s+", " ", str(content or "")).strip()

    if len(clean) <= max_chars:

        return clean



    full_article_cap = max(max_chars, 5000)

    if _is_single_article_legal_block(clean) and len(clean) <= full_article_cap:

        return clean



    keywords = sorted(_extract_query_keywords(question)[:10], key=len, reverse=True)

    matches: list[tuple[int, int]] = []

    lowered = clean.lower()

    for keyword in keywords:

        idx = lowered.find(keyword.lower())

        if idx != -1:

            matches.append((idx, idx + len(keyword)))



    if not matches:

        article_match = re.search(r"article\s+\d+", clean, flags=re.IGNORECASE)

        if article_match:

            matches.append((article_match.start(), article_match.end()))



    if not matches:

        snippet = clean[:max_chars]

        return snippet + ("..." if len(clean) > max_chars else "")



    windows: list[tuple[int, int]] = []

    for start_idx, end_idx in sorted(matches)[:3]:

        window_start = max(0, start_idx - 120)

        window_end = min(len(clean), end_idx + 320)

        if windows and window_start <= windows[-1][1] + 40:

            windows[-1] = (windows[-1][0], max(windows[-1][1], window_end))

        else:

            windows.append((window_start, window_end))



    parts: list[str] = []

    total = 0

    for start_idx, end_idx in windows:

        piece = clean[start_idx:end_idx].strip()

        if not piece:

            continue

        if start_idx > 0:

            piece = f"...{piece}"

        if end_idx < len(clean):

            piece = f"{piece}..."

        projected = total + len(piece) + (5 if parts else 0)

        if projected > max_chars and parts:

            break

        parts.append(piece)

        total = projected



    return " ".join(parts) if parts else clean[:max_chars]





def _build_rag_context(docs: list[Document], question: str = "") -> str:

    if not docs:

        return ""

    blocks: list[str] = []

    for index, doc in enumerate(docs, start=1):

        metadata = doc.metadata or {}

        title = str(metadata.get("title", "Document juridique"))

        page = metadata.get("page")

        page_label = str(page) if page is not None else "n/a"

        excerpt = _build_context_excerpt(question, doc.page_content)

        blocks.append(

            "\n".join(

                [

                    f"[Source {index}]",

                    f"document: {title}",

                    f"page: {page_label}",

                    f"content: {excerpt}",

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





def _contains_prompt_leakage(answer: str) -> bool:

    normalized = _normalize_retrieval_text(answer)

    return any(marker in normalized for marker in _PROMPT_LEAK_MARKERS)





def _parse_rag_context_blocks(rag_context: str) -> list[dict[str, str]]:

    blocks: list[dict[str, str]] = []

    current: dict[str, str] | None = None

    for raw_line in str(rag_context or "").splitlines():

        line = raw_line.strip()

        if not line:

            continue

        if line.startswith("[Source "):

            if current:

                blocks.append(current)

            current = {"source": line, "document": "", "page": "", "content": ""}

            continue

        if current is None:

            continue

        if line.startswith("document:"):

            current["document"] = line

        elif line.startswith("page:"):

            current["page"] = line

        elif line.startswith("content:"):

            current["content"] = line[len("content:"):].strip()

        elif current.get("content"):

            current["content"] = f"{current['content']} {line}".strip()

    if current:

        blocks.append(current)

    return blocks





def _render_rag_context_blocks(blocks: list[dict[str, str]]) -> str:

    rendered: list[str] = []

    for index, block in enumerate(blocks, start=1):

        content = str(block.get("content", "")).strip()

        if not content:

            continue

        rendered.append(

            "\n".join(

                [

                    f"[Source {index}]",

                    block.get("document", "document: Document juridique") or "document: Document juridique",

                    block.get("page", "page: n/a") or "page: n/a",

                    f"content: {content}",

                ]

            )

        )

    return "\n\n".join(rendered)





def _reduce_rag_context(rag_context: str) -> str:

    blocks = _parse_rag_context_blocks(rag_context)

    if not blocks:

        return rag_context



    reduced: list[dict[str, str]] = []

    max_sources = max(1, int(settings.llm_retry_max_sources))

    max_chars = max(180, int(settings.llm_retry_excerpt_chars))

    single_article_cap = max(max_chars, 3500)

    for block in blocks[:max_sources]:

        content = str(block.get("content", "")).strip()

        if _is_single_article_legal_block(content):

            content = _truncate_legal_block(content, single_article_cap)

        elif len(content) > max_chars:

            content = content[:max_chars].rstrip() + "..."

        reduced.append(

            {

                "document": block.get("document", "document: Document juridique"),

                "page": block.get("page", "page: n/a"),

                "content": content,

            }

        )

    return _render_rag_context_blocks(reduced) or rag_context





def _generate_answer_once(*, summary: str, last_messages: list[dict[str, str]], rag_context: str, user_question: str, extra_requirements: str = "") -> str:

    prompt = ChatPromptTemplate.from_template(FINAL_ANSWER_PROMPT_FR).format_messages(

        answer_requirements=_build_answer_requirements(user_question, rag_context) + (("\n" + extra_requirements) if extra_requirements else ""),

        summary=summary or "(vide)",

        last_messages=_serialize_messages(last_messages),

        rag_context=rag_context,

        user_question=user_question,

    )

    rendered = _invoke_llm_content(prompt)

    if not rendered:

        return NO_INFO_ANSWER_FR

    if not settings.answer_review_enabled:

        sanitized = _sanitize_answer_references(rendered, rag_context)

        sanitized = _sanitize_legal_style(sanitized, rag_context)

        if _contains_prompt_leakage(sanitized):

            return NO_INFO_ANSWER_FR

        return sanitized or NO_INFO_ANSWER_FR

    reviewed = _review_answer_grounding(

        rag_context=rag_context,

        user_question=user_question,

        draft_answer=rendered,

    )

    if reviewed == NO_INFO_ANSWER_FR:

        return reviewed

    sanitized = _sanitize_answer_references(reviewed, rag_context)

    sanitized = _sanitize_legal_style(sanitized, rag_context)

    if _contains_prompt_leakage(sanitized):

        return NO_INFO_ANSWER_FR

    return sanitized or NO_INFO_ANSWER_FR





def _extract_structured_measures_from_content(content: str) -> list[str]:

    clean = re.sub(r"\s+", " ", str(content or "")).strip()

    if not clean:

        return []

    matches = list(re.finditer(r"(?<!\w)(\d+\))", clean))

    if len(matches) < 2:

        return []

    measures: list[str] = []

    for index, match in enumerate(matches):

        start = match.start()

        end = matches[index + 1].start() if index + 1 < len(matches) else len(clean)

        measure = clean[start:end].strip(" -;,.\n\t")

        if measure:

            measures.append(measure)

    return measures



def _is_list_seeking_question(user_question: str) -> bool:

    normalized = _normalize_retrieval_text(user_question)

    triggers = (

        "quels", "quelles", "liste", "lister", "enumer", "enumere", "avantage", "condition", "exclusion",

        "beneficiaire", "beneficiaires", "mesure", "mesures", "difference", "differences", "compare",

    )

    return any(trigger in normalized for trigger in triggers) or _is_comparative_question(user_question)



def _extract_measure_signal_tokens(measure: str, question_tokens: set[str], token_counts: dict[str, int]) -> list[str]:

    tokens = _tokenize_retrieval_text(measure)

    signals: list[str] = []

    for token in tokens:

        if len(token) <= 4 or token in question_tokens or token in _RETRIEVAL_STOPWORDS or token in _COVERAGE_SIGNAL_STOPWORDS:

            continue

        if token_counts.get(token, 0) == 1 or token in {"revenus", "taxe", "vehicules", "vehicules", "transport", "exoneres", "exoneres", "exoneres", "exoneration", "duree", "duree"}:

            if token not in signals:

                signals.append(token)

    return signals[:6]



def _extract_measure_phrases(measure: str) -> list[str]:

    normalized = _normalize_retrieval_text(measure)

    phrases: list[str] = []

    duration_match = re.search(r"\d+\s+ans?", normalized)

    if duration_match:

        phrases.append(duration_match.group(0))

    for pattern in (

        r"revenus[^\.\,;]{0,80}exoner",

        r"vehicul[^\.\,;]{0,80}exoner",

        r"vehicul[^\.\,;]{0,80}taxe",

        r"taxe[^\.\,;]{0,80}vehicul",

    ):

        match = re.search(pattern, normalized)

        if match:

            phrase = match.group(0).strip()

            if phrase not in phrases:

                phrases.append(phrase)

    return phrases[:4]



def _extract_structured_measure_specs(rag_context: str, user_question: str) -> list[dict[str, object]]:

    blocks = _parse_rag_context_blocks(rag_context)

    measure_texts: list[str] = []

    for block in blocks:

        measure_texts.extend(_extract_structured_measures_from_content(block.get("content", "")))

    if len(measure_texts) < 2:

        return []

    question_tokens = set(_extract_query_keywords(user_question))

    token_counts: dict[str, int] = {}

    for measure in measure_texts:

        for token in set(_tokenize_retrieval_text(measure)):

            token_counts[token] = token_counts.get(token, 0) + 1

    specs: list[dict[str, object]] = []

    for measure in measure_texts:

        specs.append(

            {

                "text": measure,

                "signals": _extract_measure_signal_tokens(measure, question_tokens, token_counts),

                "phrases": _extract_measure_phrases(measure),

            }

        )

    return specs



def _is_measure_covered_in_answer(answer: str, spec: dict[str, object]) -> bool:

    normalized_answer = _normalize_retrieval_text(answer)

    phrases = [str(item) for item in spec.get("phrases", [])]

    if any(phrase and phrase in normalized_answer for phrase in phrases):

        return True

    signals = [str(item) for item in spec.get("signals", [])]

    return any(signal and signal in normalized_answer for signal in signals)



def _find_uncovered_structured_measures(answer: str, rag_context: str, user_question: str) -> list[dict[str, object]]:

    if not _is_list_seeking_question(user_question):

        return []

    specs = _extract_structured_measure_specs(rag_context, user_question)

    if not specs:

        return []

    uncovered = [spec for spec in specs if not _is_measure_covered_in_answer(answer, spec)]

    return uncovered if len(uncovered) < len(specs) else uncovered



def _build_coverage_retry_requirements(uncovered: list[dict[str, object]]) -> str:

    if not uncovered:

        return ""

    lines = [

        "- La reponse precedente etait incomplete: couvre explicitement chaque mesure distincte encore omise.",

        "- Restitue les mesures separement, de facon breve mais exhaustive.",

    ]

    for index, spec in enumerate(uncovered[:4], start=1):

        snippet = re.sub(r"^\d+\)\s*", "", str(spec.get("text", "")).strip())

        snippet = snippet[:220].rstrip()

        lines.append(f"- Mesure a couvrir {index}: {snippet}")

    return "\n".join(lines)



def _normalize_ascii_text(value: str) -> str:

    decomposed = unicodedata.normalize("NFD", str(value or ""))

    return "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")



def _is_bareme_table_question(user_question: str) -> bool:

    normalized = _normalize_ascii_text(_normalize_retrieval_text(user_question))

    has_tax_schedule_topic = any(token in normalized for token in ("bareme", "tranche", "tranches", "taux"))

    asks_for_structured_render = any(token in normalized for token in ("tableau", "structuree", "structure", "presente", "indiquant"))

    return has_tax_schedule_topic and asks_for_structured_render



def _format_bareme_tranche(raw_tranche: str) -> str:

    tranche = re.sub(r"\s+", " ", str(raw_tranche or "").strip())

    match = re.match(r"^(?P<start>\d[\d .]*(?:,\d+)?)\s+a\s+(?P<end>\d[\d .]*(?:,\d+)?)\s+dinars?$", tranche, flags=re.IGNORECASE)

    if match:

        return f"{match.group('start')} a {match.group('end')} Dinars"

    match = re.match(r"^0\s+a\s+(?P<end>\d[\d .]*(?:,\d+)?)\s+dinars?$", tranche, flags=re.IGNORECASE)

    if match:

        return f"0 a {match.group('end')} Dinars"

    match = re.match(r"^au[- ]?dela\s+de\s+(?P<start>\d[\d .]*(?:,\d+)?)\s+dinars?$", tranche, flags=re.IGNORECASE)

    if match:

        return f"Au-dela de {match.group('start')} Dinars"

    tranche = tranche.replace(" a ", " a ")

    tranche = tranche.replace(" dinars", " Dinars")

    return tranche[:1].upper() + tranche[1:] if tranche else tranche



def _extract_bareme_rows(rag_context: str) -> list[dict[str, str]]:

    ascii_text = _normalize_ascii_text(str(rag_context or "")).replace("\r", " ").replace("\n", " ")

    flattened = re.sub(r"\s+", " ", ascii_text)

    pattern = re.compile(

        r"(?P<tranche>(?:0\s+a\s+\d[\d .]*(?:,\d+)?|\d[\d .]*(?:,\d+)?\s+a\s+\d[\d .]*(?:,\d+)?|au[- ]?dela\s+de\s+\d[\d .]*(?:,\d+)?)\s+dinars?)\s+(?P<taux>\d{1,2}(?:,\d+)?%)\s+(?P<effectif>\d{1,2}(?:,\d+)?%|-)"

        , flags=re.IGNORECASE,

    )

    matches = [

        {

            "tranche": _format_bareme_tranche(match.group("tranche")),

            "taux": match.group("taux"),

            "effectif": match.group("effectif"),

        }

        for match in pattern.finditer(flattened)

    ]

    if not matches:

        return []

    groups: list[list[dict[str, str]]] = []

    current: list[dict[str, str]] = []

    for row in matches:

        starts_new_schedule = row["tranche"].lower().startswith("0 a ") and any(existing["tranche"].lower().startswith("0 a ") for existing in current)

        if starts_new_schedule and current:

            groups.append(current)

            current = []

        current.append(row)

    if current:

        groups.append(current)

    selected_group = max(enumerate(groups), key=lambda item: (len(item[1]), item[0]))[1]

    deduped: dict[str, dict[str, str]] = {}

    for row in selected_group:

        deduped[row["tranche"]] = row

    return list(deduped.values())



def _extract_bareme_application_date(rag_context: str) -> str:

    ascii_text = _normalize_ascii_text(str(rag_context or ""))

    if re.search(r"revenus\s+realises\s+a\s+partir\s+du\s+1er\s+janvier\s+2025", ascii_text, flags=re.IGNORECASE):

        return "Date d'application : les nouvelles dispositions s'appliquent aux revenus realises a partir du 1er janvier 2025."

    return ""



def _build_bareme_table_fallback(rag_context: str, user_question: str) -> str:

    if not _is_bareme_table_question(user_question) or not _rag_context_has_table_like_content(rag_context):

        return ""

    rows = _extract_bareme_rows(rag_context)

    if len(rows) < 2:

        return ""

    lines = [

        "Nouveau bareme de l'impot sur le revenu :",

        "",

        "| Tranche | Taux | Taux effectif a la limite superieure |",

        "| --- | ---: | ---: |",

    ]

    for row in rows:

        lines.append(f"| {row['tranche']} | {row['taux']} | {row['effectif']} |")

    application_date = _extract_bareme_application_date(rag_context)

    if application_date:

        lines.extend(["", application_date])

    return "\n".join(lines)



def _build_structured_measure_fallback(rag_context: str, user_question: str) -> str:

    specs = _extract_structured_measure_specs(rag_context, user_question)

    if len(specs) < 2:

        return ""

    articles = _extract_article_refs_from_context(rag_context)

    intro = "Les extraits indiquent les mesures suivantes"

    if articles:

        intro += f" (article {articles[-1]})"

    intro += ":"

    lines = [intro]

    for spec in specs[:5]:

        snippet = re.sub(r"^\d+\)\s*", "", str(spec.get("text", "")).strip())

        lines.append(f"- {snippet}")

    return "\n".join(lines)


def _rag_context_has_multiple_structured_measures(rag_context: str) -> bool:
    text = str(rag_context or "")
    numbered = len(re.findall(r"(?m)\b\d+\)", text))
    bullets = len(re.findall(r"(?m)^\s*[-*]\s+", text))
    return numbered >= 2 or bullets >= 2


def _rag_context_has_table_like_content(rag_context: str) -> bool:

    normalized = _normalize_retrieval_text(rag_context)

    return (

        ("tranches" in normalized and "taux" in normalized)

        or len(re.findall(r"\b\d+[.,]?\d*%", normalized)) >= 3

        or len(re.findall(r"\b\d{1,3}(?:[ .]\d{3})*(?:,\d+)?\s+dinars?", normalized)) >= 4

    )



def _rag_context_has_bullet_like_content(rag_context: str) -> bool:

    if _rag_context_has_multiple_structured_measures(rag_context):

        return True

    return len(re.findall(r"(?m)^\s*[-*]\s+", str(rag_context or ""))) >= 2


def _build_answer_requirements(user_question: str, rag_context: str) -> str:

    normalized_question = _normalize_retrieval_text(user_question)

    requirements = [

        "- Repondre uniquement a partir des extraits fournis.",

        "- Structurer la reponse avec des intitul?s courts si plusieurs points doivent etre distingues.",

        "- Citer les articles exacts identifies dans rag_context plutot que des references vagues.",

    ]



    legal_markers = ("avantage", "fiscal", "deduction", "beneficiaire", "condition", "exclusion", "reinvest", "exoner")

    if any(marker in normalized_question for marker in legal_markers):

        requirements.extend(

            [

                "- Identifier separement, lorsqu'ils existent dans les extraits: beneficiaires, nature de l'avantage, taux ou duree, conditions, exclusions ou limites.",

                "- Si plusieurs avantages, exonerations, conditions ou mesures distinctes apparaissent dans les extraits, les enumerer tous au lieu de les regrouper dans une formule generale.",

                "- Nommer la nature exacte de l'avantage lorsqu'elle est explicite dans les extraits (exoneration, deduction, taux, duree, etc.) et ne pas la remplacer par l'expression vague 'avantages fiscaux'.",

                "- Si un element important n'apparait pas dans les extraits recuperes, indiquer explicitement qu'il n'est pas precise par les passages fournis.",

            ]

        )



    if _is_comparative_question(user_question):

        requirements.extend(

            [

                "- Organiser la reponse en comparaison explicite par criteres communs.",

                "- Pour chaque difference, indiquer clairement quel regime ou quel cas est concerne.",

            ]

        )

    if _rag_context_has_table_like_content(rag_context):

        requirements.extend(

            [

                "- Si les extraits contiennent un bareme, des tranches, des taux ou un tableau, restituer la reponse sous forme de tableau markdown simple ou, a defaut, de liste ligne par ligne.",

                "- Conserver une ligne distincte par tranche, taux ou categorie importante au lieu d'une phrase generale.",

            ]

        )

    elif _rag_context_has_bullet_like_content(rag_context) and _is_list_seeking_question(user_question):

        requirements.extend(

            [

                "- Restituer la reponse sous forme de puces, avec une puce par condition, avantage, exclusion ou mesure distincte.",

                "- Chaque puce doit contenir une information complete et autonome.",

            ]

        )



    if "entreprise nouvellement" in normalized_question or "nouvellement cree" in normalized_question:

        requirements.append(

            "- Si les extraits mentionnent des secteurs exclus ou des conditions supplementaires d'eligibilite, les inclure explicitement."

        )



    if re.search(r"\bet suivants\b", rag_context, flags=re.IGNORECASE):

        requirements.append(

            "- Ne pas reprendre l'expression 'et suivants' si les articles cites peuvent etre nommes plus precisement."

        )



    return "\n".join(requirements)





def _sanitize_legal_style(answer: str, rag_context: str) -> str:

    rendered = answer.strip()

    if not rendered:

        return rendered



    articles = _extract_article_refs_from_context(rag_context)

    if articles:

        rendered = re.sub(

            r"\barticles?\s+(\d+)\s+et\s+suivants\b",

            lambda match: f"article {match.group(1)}" if match.group(1) in articles else match.group(0),

            rendered,

            flags=re.IGNORECASE,

        )



    rendered = re.sub(r"\*+\s*", "- ", rendered)

    rendered = re.sub(r"\s{2,}", " ", rendered).strip()

    return rendered





def _invoke_llm_content(prompt: object) -> str:

    def _runner() -> object:

        return _get_llm().invoke(prompt).content



    future = _LLM_EXECUTOR.submit(_runner)

    try:

        raw = future.result(timeout=max(1.0, float(settings.llm_request_timeout_seconds)))

    except FuturesTimeoutError as exc:

        future.cancel()

        logger.warning("LLM timeout after %ss", max(1.0, float(settings.llm_request_timeout_seconds)))

        raise LLMTimeoutError from exc

    except Exception:

        return ""



    rendered = str(raw).strip()

    return rendered





def _review_answer_grounding(*, rag_context: str, user_question: str, draft_answer: str) -> str:

    prompt = ChatPromptTemplate.from_template(LEGAL_ANSWER_REVIEW_PROMPT_FR).format_messages(

        rag_context=rag_context,

        user_question=user_question,

        draft_answer=draft_answer,

    )

    try:

        rendered = _invoke_llm_content(prompt)

    except LLMTimeoutError:

        return draft_answer

    if not rendered:

        return draft_answer

    if _contains_prompt_leakage(rendered):

        return draft_answer



    return rendered







def _generate_answer(*, summary: str, last_messages: list[dict[str, str]], rag_context: str, user_question: str) -> str:

    if not rag_context.strip():

        return NO_INFO_ANSWER_FR



    bareme_fallback = _build_bareme_table_fallback(rag_context, user_question)

    if bareme_fallback:

        return bareme_fallback



    answer = ""

    try:

        answer = _generate_answer_once(

            summary=summary,

            last_messages=last_messages,

            rag_context=rag_context,

            user_question=user_question,

        )

    except LLMTimeoutError:

        if not settings.llm_retry_with_reduced_context:

            return LLM_TIMEOUT_ANSWER_FR

    else:

        uncovered = _find_uncovered_structured_measures(answer, rag_context, user_question)

        if not uncovered:

            return answer

        logger.info("Coverage fallback triggered for %s uncovered structured measures", len(uncovered))

        fallback = _build_structured_measure_fallback(rag_context, user_question)

        return fallback or answer or NO_INFO_ANSWER_FR



    reduced_context = _reduce_rag_context(rag_context)

    logger.info("Retrying LLM generation with reduced context: original_len=%s reduced_len=%s", len(rag_context), len(reduced_context))

    try:

        answer = _generate_answer_once(

            summary="",

            last_messages=[],

            rag_context=reduced_context,

            user_question=user_question,

        )

    except LLMTimeoutError:

        return LLM_TIMEOUT_ANSWER_FR

    uncovered = _find_uncovered_structured_measures(answer, reduced_context, user_question)

    if not uncovered:

        return answer

    logger.info("Coverage fallback triggered after reduced-context generation for %s uncovered structured measures", len(uncovered))

    fallback = _build_structured_measure_fallback(reduced_context, user_question)

    return fallback or answer or NO_INFO_ANSWER_FR





def ask_question(

    question: str,

    user_id: str | None = None,

    conversation_id: str | None = None,

    llm_question: str | None = None,

) -> tuple[str, str, list[SourceItem], SourceFile | None, str]:

    plain_question = question.strip()

    prompt_question = (llm_question or plain_question).strip()

    if not plain_question:

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Question vide.")



    asked_at = datetime.now(timezone.utc)

    resolved_conversation_id = ensure_conversation(conversation_id, user_id=user_id)



    save_message(resolved_conversation_id, "user", plain_question)

    last_messages = get_last_messages(resolved_conversation_id, settings.memory_last_messages_limit)

    summary = get_conversation_summary(resolved_conversation_id)



    docs: list[Document] = []

    sources: list[SourceItem] = []

    source_file: SourceFile | None = None

    if _is_summary_request(plain_question):

        answer = _build_memory_only_answer(summary, last_messages)

    elif _is_small_talk(plain_question):

        answer = _build_small_talk_answer(plain_question)

    else:

        docs = _retrieve_relevant_docs(plain_question)

        sources = _to_source_items(docs)

        source_file = _build_source_file(sources)

        rag_context = _build_rag_context(docs, plain_question)



        answer = _generate_answer(

            summary=summary,

            last_messages=last_messages,

            rag_context=rag_context,

            user_question=prompt_question,

        )



    used_document_context = bool(sources) and answer.strip() != NO_INFO_ANSWER_FR

    if not used_document_context:

        sources = []

        source_file = None

    answered_at = datetime.now(timezone.utc)

    question_model = ChatQuestionModel.new(

        question=plain_question,

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





# Unused helper kept only as commented reference.
# def get_source_file_for_question(question_id: str) -> SourceFile | None:
#
#     doc = _chat_questions_repo.get_question_record_by_id(question_id)
#
#     if not doc:
#
#         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question introuvable.")
#
#
#
#     raw = doc.get("sourceFile")
#
#     if not isinstance(raw, dict):
#
#         return None
#
#     return SourceFile(**raw)
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#

def _normalize_suggestion_text(value: str) -> str:

    return re.sub(r"\s+", " ", str(value or "").strip().lower())





def _tokenize_suggestion_text(value: str) -> list[str]:

    return re.findall(r"\w+", _normalize_suggestion_text(value), flags=re.UNICODE)





def _extract_meaningful_query_tokens(query: str) -> list[str]:

    stopwords = {

        "le", "la", "les", "de", "des", "du", "d", "un", "une", "et", "ou", "a", "au", "aux",

        "dans", "sur", "pour", "par", "avec", "sans", "en", "est", "sont", "quel", "quels",

        "quelle", "quelles", "je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles",

        "que", "quoi", "comment", "puis", "puisje", "peut", "peux", "avoir", "connaitre", "savoir",

    }

    return [token for token in _tokenize_suggestion_text(query) if token not in stopwords and len(token) > 2]





def _extract_article_reference(text: str) -> str | None:

    matches = re.findall(r"articles?\s+\d+(?:\s*(?:a|et|-|,)\s*\d+)*(?:\s+et\s+suivants?)?", text, flags=re.IGNORECASE)

    if not matches:

        return None

    return re.sub(r"\s+", " ", matches[0]).strip()





def _clean_document_title(title: str) -> str:

    cleaned = re.sub(r"\bCOMPLET\b", "", str(title or ""), flags=re.IGNORECASE)

    cleaned = re.sub(r"\s+", " ", cleaned).strip(" -:,.\n\t")

    return cleaned





def _build_subject_from_doc(query: str, doc: Document) -> str:

    metadata = doc.metadata or {}

    title = _clean_document_title(str(metadata.get("title", "")))

    if title and not re.match(r"^articles?\s+\d+", title, flags=re.IGNORECASE):

        return title



    query_tokens = _extract_meaningful_query_tokens(query)

    if query_tokens:

        return " ".join(query_tokens[:8])



    excerpt = re.sub(r"\s+", " ", doc.page_content[:160]).strip(" -:,.\n\t")

    return excerpt





def _build_doc_based_candidates(query: str, docs: list[Document]) -> list[str]:

    query_text = " ".join(_extract_meaningful_query_tokens(query)) or query.strip()

    candidates: list[str] = []



    for doc in docs[:8]:

        metadata = doc.metadata or {}

        title = _clean_document_title(str(metadata.get("title", "")))

        article_ref = _extract_article_reference(f"{title} {doc.page_content[:240]}")

        subject = _build_subject_from_doc(query, doc)

        if not subject:

            continue



        candidates.append(f"Quels sont les points essentiels concernant {subject} ?")

        candidates.append(f"Quelles sont les conditions relatives a {subject} ?")

        if article_ref and query_text:

            candidates.append(f"Que prevoit {article_ref} concernant {query_text} ?")

        elif query_text:

            candidates.append(f"Que prevoit le document {subject} concernant {query_text} ?")



        if title and title != subject:

            candidates.append(f"Comment s'applique {title} ?")



    return candidates





def _score_suggestion_candidate(query: str, candidate: str) -> float:

    normalized_query = _normalize_suggestion_text(query)

    normalized_candidate = _normalize_suggestion_text(candidate)

    if not normalized_query or not normalized_candidate:

        return -1.0



    query_tokens = _extract_meaningful_query_tokens(normalized_query) or _tokenize_suggestion_text(normalized_query)

    candidate_tokens = _tokenize_suggestion_text(normalized_candidate)

    if len(query_tokens) < 2:

        return -1.0



    overlap = sum(1 for token in query_tokens if token in candidate_tokens)

    if overlap == 0:

        return -1.0



    score = overlap * 12

    if normalized_query in normalized_candidate:

        score += 20

    if normalized_candidate.startswith("que prevoit"):

        score += 4

    if normalized_candidate.startswith("quels sont") or normalized_candidate.startswith("quelles sont"):

        score += 3

    score -= max(0, len(candidate_tokens) - len(query_tokens) - 6) * 0.35

    return score





def _rank_question_suggestions(query: str, candidates: list[str], limit: int) -> list[str]:

    ranked: list[tuple[float, str]] = []

    seen: set[str] = set()

    for candidate in candidates:

        rendered = str(candidate or "").strip()

        if not rendered:

            continue

        key = rendered.lower()

        if key in seen:

            continue

        seen.add(key)



        score = _score_suggestion_candidate(query, rendered)

        if score < 0:

            continue

        ranked.append((score, rendered))



    ranked.sort(key=lambda item: (-item[0], len(item[1]), item[1].lower()))

    return [item[1] for item in ranked[: max(1, int(limit))]]





def suggest_question_suggestions(query: str, user_id: str | None = None, limit: int = 5) -> list[str]:

    del user_id

    q = str(query or "").strip()

    words = [w for w in re.split(r"\s+", q) if w]

    if len(words) < 3:

        return []



    try:

        docs = _retrieve_relevant_docs(q)

    except Exception:

        return []

    if not docs:

        return []



    candidates = _build_doc_based_candidates(q, docs)

    return _rank_question_suggestions(q, candidates, limit=limit)
















