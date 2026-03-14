from fastapi import APIRouter, Depends, File, Form, UploadFile, status

from app.auth import require_role
from app.controllers.documents_controller import (
    delete_document_controller,
    document_points_controller,
    import_document_controller,
    index_existing_documents_controller,
    index_one_document_controller,
    list_documents_controller,
    qdrant_health_controller,
    qdrant_stats_controller,
)
from app.models import UserRole
from app.schemas import DocumentCategory, ImportDocumentResponse, IndexManyResponse

router = APIRouter(
    prefix="/admin/documents",
    tags=["documents"],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)


@router.get("")
def list_documents():
    return list_documents_controller()


@router.post("/import", response_model=ImportDocumentResponse)
def import_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    category: DocumentCategory = Form(...),
    description: str = Form(default=""),
    realizedAt: str = Form(...),
):
    return import_document_controller(
        file=file,
        title=title,
        category=category,
        description=description,
        realized_at=realizedAt,
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: str):
    return delete_document_controller(document_id)


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
