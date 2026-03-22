from app.models import ClaimModel
from app.repositories import ClaimsRepository
from app.schemas import ClaimCreateRequest, ClaimOut, ClaimStatus

_claims_repo = ClaimsRepository()


def ensure_claim_indexes() -> None:
    _claims_repo.ensure_indexes()


def create_claim_for_user(*, user_id: str, user_email: str, payload: ClaimCreateRequest) -> ClaimOut:
    model = ClaimModel.new(
        user_id=user_id,
        user_email=user_email,
        category=payload.category.value,
        subject=payload.subject,
        description=payload.description,
    )
    saved = _claims_repo.create_claim(model)
    return ClaimOut(
        id=saved.id or "",
        userId=saved.user_id,
        userEmail=saved.user_email,
        category=payload.category,
        subject=saved.subject,
        description=saved.description,
        status=ClaimStatus(saved.status),
        createdAt=saved.created_at,
        updatedAt=saved.updated_at,
    )
