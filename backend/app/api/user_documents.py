from fastapi import APIRouter, Depends

from app.auth import require_role
from app.controllers.user_documents_controller import (
    count_favorite_documents_controller,
    list_favorite_documents_controller,
    search_documents_controller,
    set_document_favorite_controller,
)
from app.models import UserRole
from app.schemas import DocumentFavoriteResponse, DocumentFavoriteUpdate, DocumentSearchResult, FavoritesCountOut

router = APIRouter(
    prefix="/user/documents",
    tags=["user-documents"],
    dependencies=[Depends(require_role(UserRole.FINANCE_USER))],
)


@router.get("/search", response_model=list[DocumentSearchResult])
def search_documents(query: str = "", limit: int = 20):
    return search_documents_controller(query=query, limit=limit)


@router.get("/favorites", response_model=list[DocumentSearchResult])
def list_favorite_documents(limit: int = 50):
    return list_favorite_documents_controller(limit=limit)


@router.get("/favorites/count", response_model=FavoritesCountOut)
def count_favorite_documents():
    return FavoritesCountOut(count=count_favorite_documents_controller())


@router.patch("/{document_id}/favorite", response_model=DocumentFavoriteResponse)
def set_document_favorite(document_id: str, payload: DocumentFavoriteUpdate):
    return set_document_favorite_controller(document_id, payload.isFavored)
