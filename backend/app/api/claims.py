from fastapi import APIRouter, Depends, Request

from app.auth import get_current_user_from_request, require_role
from app.models import UserRole
from app.schemas import (
    AuditLogLevel,
    AuditLogStatus,
    AuthUser,
    ClaimCreateRequest,
    ClaimOut,
    ClaimReplyRequest,
    ClaimUnreadCountOut,
)
from app.services.audit_logs_service import record_audit_event
from app.services.claims_notifications import claims_notifications_hub
from app.services.claims_service import (
    count_user_unread_claim_replies,
    create_claim_for_user,
    list_claims_for_admin,
    list_claims_for_user,
    mark_user_claim_replies_as_read,
    reply_to_claim_as_admin,
)

router = APIRouter(
    prefix="/claims",
    tags=["claims"],
    dependencies=[Depends(require_role(UserRole.FINANCE_USER))],
)

admin_router = APIRouter(
    prefix="/admin/claims",
    tags=["admin-claims"],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)


@router.post("", response_model=ClaimOut)
async def create_claim(
    payload: ClaimCreateRequest,
    request: Request,
    current_user: AuthUser = Depends(get_current_user_from_request),
):
    claim = create_claim_for_user(user_id=current_user.id, user_email=current_user.email, payload=payload)
    record_audit_event(
        request=request,
        action="CREATE_CLAIM",
        user=current_user.email,
        resource=claim.id,
        status=AuditLogStatus.SUCCESS,
        level=AuditLogLevel.INFO,
        message="Envoi d'une reclamation utilisateur.",
        payload={
            "claimId": claim.id,
            "category": claim.category.value,
            "subject": claim.subject,
        },
    )

    await claims_notifications_hub.notify_admins(
        {
            "type": "CLAIM_CREATED",
            "claimId": claim.id,
            "subject": claim.subject,
            "category": claim.category.value,
            "createdAt": claim.createdAt.isoformat(),
            "userEmail": claim.userEmail,
        }
    )
    return claim


@router.get("/me", response_model=list[ClaimOut])
def list_my_claims(
    current_user: AuthUser = Depends(get_current_user_from_request),
):
    return list_claims_for_user(user_id=current_user.id)


@router.get("/me/unread-count", response_model=ClaimUnreadCountOut)
def get_my_unread_claim_replies(
    current_user: AuthUser = Depends(get_current_user_from_request),
):
    return ClaimUnreadCountOut(count=count_user_unread_claim_replies(user_id=current_user.id))


@router.post("/me/mark-read", response_model=ClaimUnreadCountOut)
def mark_my_claim_replies_read(
    current_user: AuthUser = Depends(get_current_user_from_request),
):
    mark_user_claim_replies_as_read(user_id=current_user.id)
    return ClaimUnreadCountOut(count=count_user_unread_claim_replies(user_id=current_user.id))


@admin_router.get("", response_model=list[ClaimOut])
def list_all_claims_for_admin():
    return list_claims_for_admin()


@admin_router.post("/{claim_id}/reply", response_model=ClaimOut)
async def reply_to_claim(
    claim_id: str,
    payload: ClaimReplyRequest,
    request: Request,
    current_user: AuthUser = Depends(get_current_user_from_request),
):
    claim = reply_to_claim_as_admin(claim_id=claim_id, admin_email=current_user.email, payload=payload)
    record_audit_event(
        request=request,
        action="REPLY_CLAIM",
        user=current_user.email,
        resource=claim.id,
        status=AuditLogStatus.SUCCESS,
        level=AuditLogLevel.INFO,
        message="Reponse admin envoyee sur reclamation utilisateur.",
        payload={"claimId": claim.id, "status": claim.status.value},
    )

    unread_count = count_user_unread_claim_replies(user_id=claim.userId)
    await claims_notifications_hub.notify_user(
        claim.userId,
        {
            "type": "CLAIM_REPLY",
            "claimId": claim.id,
            "unreadCount": unread_count,
            "repliedAt": claim.adminReplyAt.isoformat() if claim.adminReplyAt else None,
        },
    )
    await claims_notifications_hub.notify_admins(
        {
            "type": "CLAIM_UPDATED",
            "claimId": claim.id,
            "status": claim.status.value,
            "updatedAt": claim.updatedAt.isoformat(),
        }
    )
    return claim
