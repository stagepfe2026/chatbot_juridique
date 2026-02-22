from fastapi import APIRouter, File, Form, UploadFile

from app.schemas import DocumentCategory, ImportDocumentResponse
from app.services.documents import list_documents, save_uploaded_document

router = APIRouter(prefix="/admin/documents", tags=["admin-documents"])


@router.get("")
def get_documents():
    return list_documents()


@router.post("/import", response_model=ImportDocumentResponse)
def import_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    category: DocumentCategory = Form(...),
    description: str = Form(default=""),
):
    record = save_uploaded_document(
        file=file,
        title=title,
        category=category.value,
        description=description,
    )
    return ImportDocumentResponse(
        documentId=record["id"],
        filename=file.filename or "",
        status=record["documentStatus"],
    )
