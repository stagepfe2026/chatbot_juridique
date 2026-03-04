from pathlib import Path

from fastapi import HTTPException, status
from fastapi.responses import FileResponse

from app.repositories import DocumentsRepository
from app.rag.pipeline import ask_question, get_sources_for_question
from app.schemas import AskQuestionResponse, SourceItem

_documents_repo = DocumentsRepository()


def create_chat_question(
    question: str,
    user_id: str | None = None,
    conversation_id: str | None = None,
) -> AskQuestionResponse:
    question_id, answer, sources, source_file, resolved_conversation_id = ask_question(
        question,
        user_id=user_id,
        conversation_id=conversation_id,
    )
    return AskQuestionResponse(
        questionId=question_id,
        conversationId=resolved_conversation_id,
        answer=answer,
        sources=sources,
        sourceFile=source_file,
    )


def list_question_sources(question_id: str) -> list[SourceItem]:
    return get_sources_for_question(question_id)


def download_document_file(document_id: str) -> FileResponse:
    doc = _documents_repo.get_active_document_fields_by_id(document_id, {"filePath": 1})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document introuvable.")

    file_path = Path(str(doc.get("filePath", ""))).resolve()
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fichier source introuvable.")

    return FileResponse(path=str(file_path), filename=file_path.name)
