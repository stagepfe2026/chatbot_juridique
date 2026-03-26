from fastapi import HTTPException, status

from app.models import ClaimModel
from app.repositories import ClaimsRepository
from app.schemas import (
    ClaimAttachmentOut,
    ClaimCategory,
    ClaimCreateRequest,
    ClaimOut,
    ClaimPriority,
    ClaimReplyRequest,
    ClaimStatus,
)

_claims_repo = ClaimsRepository()


def ensure_claim_indexes() -> None:
    _claims_repo.ensure_indexes()


def _to_claim_out(saved: ClaimModel) -> ClaimOut:
    category = ClaimCategory(saved.category) if saved.category in ClaimCategory._value2member_map_ else ClaimCategory.OTHER
    priority = ClaimPriority(saved.priority) if saved.priority in ClaimPriority._value2member_map_ else ClaimPriority.NORMAL
    status = ClaimStatus(saved.status) if saved.status in ClaimStatus._value2member_map_ else ClaimStatus.SUBMITTED
    return ClaimOut(
        id=saved.id or "",
        userId=saved.user_id,
        userEmail=saved.user_email,
        category=category,
        priority=priority,
        subject=saved.subject,
        description=saved.description,
        status=status,
        attachments=[
            ClaimAttachmentOut(
                name=str(item.get("name", "piece-jointe")),
                mimeType=str(item.get("mimeType", "image/png")),
                size=int(item.get("size", 0)),
                dataUrl=str(item.get("dataUrl", "")),
            )
            for item in saved.attachments
        ],
        adminReply=saved.admin_reply,
        adminReplyAt=saved.admin_reply_at,
        adminReplyBy=saved.admin_reply_by,
        isReplyReadByUser=saved.is_reply_read_by_user,
        createdAt=saved.created_at,
        updatedAt=saved.updated_at,
    )


def create_claim_for_user(*, user_id: str, user_email: str, payload: ClaimCreateRequest) -> ClaimOut:
    model = ClaimModel.new(
        user_id=user_id,
        user_email=user_email,
        category=payload.category.value,
        priority=payload.priority.value,
        subject=payload.subject,
        description=payload.description,
        attachments=[
            {
                "name": item.name,
                "mimeType": item.mimeType,
                "size": item.size,
                "dataUrl": item.dataUrl,
            }
            for item in payload.attachments
        ],
    )
    saved = _claims_repo.create_claim(model)
    return _to_claim_out(saved)


def list_claims_for_user(*, user_id: str) -> list[ClaimOut]:
    return [_to_claim_out(model) for model in _claims_repo.list_claims_for_user(user_id)]


def list_claims_for_admin() -> list[ClaimOut]:
    return [_to_claim_out(model) for model in _claims_repo.list_claims(limit=500)]


def reply_to_claim_as_admin(*, claim_id: str, admin_email: str, payload: ClaimReplyRequest) -> ClaimOut:
    updated = _claims_repo.reply_to_claim(claim_id, admin_email=admin_email, message=payload.message)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reclamation introuvable.")
    return _to_claim_out(updated)


def mark_user_claim_replies_as_read(*, user_id: str) -> int:
    return _claims_repo.mark_replies_as_read_by_user(user_id)


def count_user_unread_claim_replies(*, user_id: str) -> int:
    return _claims_repo.count_unread_replies_for_user(user_id)
