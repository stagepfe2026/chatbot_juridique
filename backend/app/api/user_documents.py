from fastapi import APIRouter, Depends, Request

from app.auth import get_current_user_from_request, require_role
from app.controllers.user_documents_controller import (
    count_favorite_documents_controller,
    list_favorite_documents_controller,
    search_documents_controller,
    set_document_favorite_controller,
)
from app.models import UserRole
from app.schemas import (
    AuditLogLevel,
    AuditLogStatus,
    AuthUser,
    DocumentFavoriteResponse,
    DocumentFavoriteUpdate,
    DocumentSearchResult,
    FavoritesCountOut,
)
from app.services.audit_logs_service import record_audit_event

router = APIRouter(
    prefix="/user/documents",
    tags=["user-documents"],
    dependencies=[Depends(require_role(UserRole.FINANCE_USER))],
)


def _preview_text(value: str, max_len: int = 80) -> str:
    text = value.strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 3].rstrip() + "..."


@router.get("/search", response_model=list[DocumentSearchResult])
def search_documents(
    request: Request,
    query: str = "",
    limit: int = 20,
    current_user: AuthUser = Depends(get_current_user_from_request),
):
    results = search_documents_controller(query=query, limit=limit)
    record_audit_event(
        request=request,
        action="SEARCH",
        user=current_user.email,
        resource="documents",
        status=AuditLogStatus.SUCCESS,
        level=AuditLogLevel.INFO,
        message="Recherche de documents effectuee.",
        payload={"queryPreview": _preview_text(query, 120), "count": len(results), "limit": limit},
    )
    return results


@router.get("/favorites", response_model=list[DocumentSearchResult])
def list_favorite_documents(
    request: Request,
    limit: int = 50,
    current_user: AuthUser = Depends(get_current_user_from_request),
):
    favorites = list_favorite_documents_controller(limit=limit)
    record_audit_event(
        request=request,
        action="VIEW_FAVORITES",
        user=current_user.email,
        resource="favorite-documents",
        status=AuditLogStatus.SUCCESS,
        level=AuditLogLevel.INFO,
        message="Consultation des documents favoris.",
        payload={"count": len(favorites), "limit": limit},
    )
    return favorites


@router.get("/favorites/count", response_model=FavoritesCountOut)
def count_favorite_documents(
    request: Request,
    current_user: AuthUser = Depends(get_current_user_from_request),
):
    count = count_favorite_documents_controller()
    record_audit_event(
        request=request,
        action="COUNT_FAVORITES",
        user=current_user.email,
        resource="favorite-documents",
        status=AuditLogStatus.SUCCESS,
        level=AuditLogLevel.INFO,
        message="Consultation du nombre de favoris.",
        payload={"count": count},
    )
    return FavoritesCountOut(count=count)


@router.patch("/{document_id}/favorite", response_model=DocumentFavoriteResponse)
def set_document_favorite(
    document_id: str,
    payload: DocumentFavoriteUpdate,
    request: Request,
    current_user: AuthUser = Depends(get_current_user_from_request),
):
    result = set_document_favorite_controller(document_id, payload.isFavored)
    record_audit_event(
        request=request,
        action="FAVORITE_DOCUMENT",
        user=current_user.email,
        resource=document_id,
        status=AuditLogStatus.SUCCESS,
        level=AuditLogLevel.INFO,
        message="Mise a jour du statut favori d'un document.",
        payload={"documentId": document_id, "isFavored": payload.isFavored},
    )
    return result
