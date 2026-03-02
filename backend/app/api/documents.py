from fastapi import APIRouter, File, Form, UploadFile

from app.controllers.documents_controller import (
    document_points_controller,
    import_document_controller,
    index_existing_documents_controller,
    index_one_document_controller,
    list_documents_controller,
    qdrant_health_controller,
    qdrant_stats_controller,
)
from app.schemas import DocumentCategory, ImportDocumentResponse, IndexManyResponse

router = APIRouter(prefix="/admin/documents", tags=["documents"])


@router.get("")
def list_documents():
    return list_documents_controller()


@router.post("/import", response_model=ImportDocumentResponse)
def import_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    category: DocumentCategory = Form(...),
    description: str = Form(default=""),
):
    return import_document_controller(
        file=file,
        title=title,
        category=category,
        description=description,
    )


@router.post("/index-existing", response_model=IndexManyResponse)
def index_existing_documents():
    return index_existing_documents_controller()


@router.post("/{document_id}/index")
def index_one_document(document_id: str):
    return index_one_document_controller(document_id)


@router.get("/qdrant/health")
def get_qdrant_health():
    return qdrant_health_controller()


@router.get("/qdrant/stats")
def get_qdrant_stats():
    return qdrant_stats_controller()


@router.get("/{document_id}/points")
def get_document_points(document_id: str, limit: int = 100):
    return document_points_controller(document_id=document_id, limit=limit)
