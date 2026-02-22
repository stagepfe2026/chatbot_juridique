from datetime import datetime, timezone
from pathlib import Path

from bson import ObjectId
from fastapi import HTTPException, status
from langchain_community.embeddings import FastEmbedEmbeddings
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import ChatOllama
from langchain_qdrant import QdrantVectorStore

from app.config import settings
from app.db import get_chat_questions_collection, get_documents_collection, qdrant_client
from app.schemas import SourceFile, SourceItem

_embeddings = None
_vector_store = None
_llm = None


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


def _build_prompt() -> ChatPromptTemplate:
    return ChatPromptTemplate.from_template(
        "Tu es un assistant juridique. Reponds uniquement a partir du CONTEXTE fourni.\n"
        "Si l'information n'est pas dans le contexte, dis clairement que tu ne sais pas.\n"
        "Reponse concise, structuree et en francais.\n\n"
        "QUESTION:\n{question}\n\n"
        "CONTEXTE:\n{context}\n"
    )


def _to_source_items(docs: list[Document]) -> list[SourceItem]:
    items: list[SourceItem] = []
    for doc in docs:
        metadata = doc.metadata or {}
        items.append(
            SourceItem(
                documentId=str(metadata.get("document_id", "")),
                title=str(metadata.get("title", "Document juridique")),
                excerpt=doc.page_content[:500],
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
        oid = ObjectId(first.documentId)
    except Exception:
        return None
    doc = get_documents_collection().find_one({"_id": oid}, {"filePath": 1, "title": 1})
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


def ask_question(question: str) -> tuple[str, str, list[SourceItem], SourceFile | None]:
    if not question.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Question vide.")

    retriever = _get_vector_store().as_retriever(search_kwargs={"k": settings.retriever_k})
    docs = retriever.invoke(question.strip())
    sources = _to_source_items(docs)
    source_file = _build_source_file(sources)

    if not docs:
        answer = "Je ne trouve pas d'information pertinente dans les documents indexes."
    else:
        context = "\n\n".join([doc.page_content for doc in docs])
        prompt = _build_prompt().format_messages(question=question.strip(), context=context)
        answer = _get_llm().invoke(prompt).content
        if not isinstance(answer, str):
            answer = str(answer)

    record = {
        "question": question.strip(),
        "answer": answer,
        "sources": [item.model_dump() for item in sources],
        "sourceFile": source_file.model_dump() if source_file else None,
        "createdAt": datetime.now(timezone.utc),
    }
    inserted = get_chat_questions_collection().insert_one(record)
    return str(inserted.inserted_id), answer, sources, source_file


def get_sources_for_question(question_id: str) -> list[SourceItem]:
    try:
        oid = ObjectId(question_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="questionId invalide.") from exc

    doc = get_chat_questions_collection().find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question introuvable.")

    raw_sources = doc.get("sources", [])
    if not isinstance(raw_sources, list):
        return []
    return [SourceItem(**item) for item in raw_sources if isinstance(item, dict)]


def get_source_file_for_question(question_id: str) -> SourceFile | None:
    try:
        oid = ObjectId(question_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="questionId invalide.") from exc

    doc = get_chat_questions_collection().find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question introuvable.")

    raw = doc.get("sourceFile")
    if not isinstance(raw, dict):
        return None
    return SourceFile(**raw)
