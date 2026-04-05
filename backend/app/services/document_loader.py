from pathlib import Path

import docx2txt
import pdfplumber
from fastapi import HTTPException, status


# Detecte le type du fichier et lance l'extracteur de texte approprie.
def extract_text_from_path(file_path: str) -> str:
    # Détecte le type de fichier et délègue à l'extracteur adapté.
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


# Extrait puis concatene le texte de toutes les pages d'un PDF.
def _extract_pdf(path: Path) -> str:
    # Concatène le texte extrait de chaque page PDF.
    pages: list[str] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            pages.append(page.extract_text() or "")
    return "\n".join(pages).strip()


# Extrait le texte brut d'un document Word DOCX.
def _extract_docx(path: Path) -> str:
    return docx2txt.process(str(path)).strip()
