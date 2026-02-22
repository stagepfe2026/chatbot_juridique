from pathlib import Path

from bson import ObjectId
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

from app.db import get_documents_collection
from app.schemas import AskQuestionRequest, AskQuestionResponse, SourceItem
from app.services.rag import ask_question, get_sources_for_question

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/questions", response_model=AskQuestionResponse)
def create_question(payload: AskQuestionRequest):
    question_id, answer, _, source_file = ask_question(payload.question)
    return AskQuestionResponse(questionId=question_id, answer=answer, sourceFile=source_file)


@router.get("/questions/{question_id}/sources", response_model=list[SourceItem])
def get_question_sources(question_id: str):
    return get_sources_for_question(question_id)


@router.get("/documents/{document_id}/download")
def download_source_document(document_id: str):
    try:
        oid = ObjectId(document_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="documentId invalide.") from exc

    doc = get_documents_collection().find_one({"_id": oid}, {"filePath": 1})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document introuvable.")

    file_path = Path(str(doc.get("filePath", ""))).resolve()
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fichier source introuvable.")

    return FileResponse(path=str(file_path), filename=file_path.name)
