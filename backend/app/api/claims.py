from fastapi import APIRouter, Depends, Request

from app.auth import get_current_user_from_request, require_role
from app.models import UserRole
from app.schemas import AuditLogLevel, AuditLogStatus, AuthUser, ClaimCreateRequest, ClaimOut
from app.services.audit_logs_service import record_audit_event
from app.services.claims_service import create_claim_for_user

router = APIRouter(
    prefix="/claims",
    tags=["claims"],
    dependencies=[Depends(require_role(UserRole.FINANCE_USER))],
)


@router.post("", response_model=ClaimOut)
def create_claim(
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
    return claim
