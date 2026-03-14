from pathlib import Path
import mimetypes
import subprocess
import logging

from fastapi import HTTPException, status
from fastapi.responses import FileResponse

from app.core.config import settings
from app.repositories import DocumentsRepository
from app.rag.pipeline import ask_question, get_sources_for_question, suggest_question_suggestions
from app.schemas import AskQuestionResponse, SourceItem

logger = logging.getLogger(__name__)

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


def _ensure_soffice_available() -> None:
    try:
        result = subprocess.run(
            ["soffice", "--version"],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        logger.info("LibreOffice disponible: %s", (result.stdout or result.stderr).strip())
    except FileNotFoundError as exc:
        logger.error("LibreOffice (soffice) introuvable dans le PATH.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="LibreOffice (soffice) introuvable pour la conversion PDF.",
        ) from exc
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or exc.stdout or "").strip()
        logger.error("Erreur lors de la verification de soffice: %s", detail)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail or "Erreur lors de la verification de LibreOffice.",
        ) from exc


def _convert_word_to_pdf(source_path: Path) -> Path:
    settings.pdf_cache_path.mkdir(parents=True, exist_ok=True)
    target_path = settings.pdf_cache_path / f"{source_path.stem}.pdf"

    if target_path.exists() and target_path.stat().st_mtime >= source_path.stat().st_mtime:
        return target_path

    _ensure_soffice_available()

    logger.info("Conversion Word->PDF: source=%s target=%s", source_path, target_path)
    try:
        result = subprocess.run(
            [
                "soffice",
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                str(settings.pdf_cache_path),
                str(source_path),
            ],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        stdout = (result.stdout or "").strip()
        stderr = (result.stderr or "").strip()
        if stdout:
            logger.info("soffice stdout: %s", stdout)
        if stderr:
            logger.warning("soffice stderr: %s", stderr)
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or exc.stdout or "").strip()
        logger.error("Conversion Word->PDF echouee: %s", detail)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail or "Conversion Word vers PDF echouee.",
        ) from exc

    if not target_path.exists():
        logger.error("PDF non genere. Attendu: %s", target_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Conversion Word vers PDF echouee (PDF introuvable apres conversion).",
        )
    return target_path


def download_document_file(document_id: str) -> FileResponse:
    doc = _documents_repo.get_active_document_fields_by_id(document_id, {"filePath": 1})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document introuvable.")

    file_path = Path(str(doc.get("filePath", ""))).resolve()
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fichier source introuvable.")

    suffix = file_path.suffix.lower()
    if suffix in {".doc", ".docx"}:
        file_path = _convert_word_to_pdf(file_path)

    media_type, _ = mimetypes.guess_type(str(file_path))
    return FileResponse(
        path=str(file_path),
        filename=file_path.name,
        media_type=media_type or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{file_path.name}"'},
    )



def list_question_suggestions(query: str, limit: int = 5) -> list[str]:
    return suggest_question_suggestions(query, limit=limit)


