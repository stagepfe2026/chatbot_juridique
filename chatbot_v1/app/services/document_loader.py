from pathlib import Path

import docx2txt
import pdfplumber
from fastapi import HTTPException, status


def extract_text_from_path(file_path: str) -> str:
    path = Path(file_path)
    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Fichier introuvable: {file_path}",
        )

    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return _extract_pdf(path)
    if suffix == ".docx":
        return _extract_docx(path)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Extension non supportee: {suffix}",
    )


def _extract_pdf(path: Path) -> str:
    pages: list[str] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            pages.append(page.extract_text() or "")
    return "\n".join(pages).strip()


def _extract_docx(path: Path) -> str:
    return docx2txt.process(str(path)).strip()
