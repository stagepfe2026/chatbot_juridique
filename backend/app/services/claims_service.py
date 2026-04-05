from fastapi import HTTPException, status

from app.models import ClaimModel
from app.repositories import ClaimsRepository
from app.schemas import (
    ClaimActivityLogEntryOut,
    ClaimAttachmentOut,
    ClaimCategory,
    ClaimCreateRequest,
    ClaimOut,
    ClaimPriority,
    ClaimReplyRequest,
    ClaimStatus,
)

_claims_repo = ClaimsRepository()


# Cree les index necessaires au stockage et au tri des reclamations.
def ensure_claim_indexes() -> None:
    _claims_repo.ensure_indexes()


# Convertit les anciens statuts vers le format de statut actuellement expose.
def _normalize_claim_status(raw_status: str) -> ClaimStatus:
    legacy = "RESOLVED" if raw_status == "ANSWERED" else raw_status
    return ClaimStatus(legacy) if legacy in ClaimStatus._value2member_map_ else ClaimStatus.SUBMITTED


# Genere un numero de ticket lisible quand aucun numero n'est encore stocke.
def _build_ticket_number_fallback(saved: ClaimModel) -> str:
    if saved.ticket_number:
        return saved.ticket_number
    year = saved.created_at.year
    raw = f"{saved.id or ''}{saved.created_at.isoformat()}"
    serial = str(sum(ord(char) for char in raw) % 10000).zfill(4)
    return f"REC-{year}-{serial}"


# Transforme le modele persiste en schema API complet pour le frontend.
def _to_claim_out(saved: ClaimModel) -> ClaimOut:
    category = ClaimCategory(saved.category) if saved.category in ClaimCategory._value2member_map_ else ClaimCategory.OTHER
    priority = ClaimPriority(saved.priority) if saved.priority in ClaimPriority._value2member_map_ else ClaimPriority.NORMAL
    status = _normalize_claim_status(saved.status)
    return ClaimOut(
        id=saved.id or "",
        ticketNumber=_build_ticket_number_fallback(saved),
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
        activityLog=[
            ClaimActivityLogEntryOut(
                id=str(item.get("id", "")),
                description=str(item.get("description", "")),
                actorName=str(item.get("actorName", "Systeme")),
                createdAt=item.get("createdAt") or saved.updated_at,
            )
            for item in saved.activity_log
        ],
    )


# Cree une nouvelle reclamation utilisateur puis la renvoie au format API.
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


# Liste les reclamations appartenant a un utilisateur donne.
def list_claims_for_user(*, user_id: str) -> list[ClaimOut]:
    return [_to_claim_out(model) for model in _claims_repo.list_claims_for_user(user_id)]


# Retourne une reclamation precise si elle appartient bien a l'utilisateur.
def get_claim_for_user(*, claim_id: str, user_id: str) -> ClaimOut:
    claim = _claims_repo.find_claim_by_id(claim_id)
    if not claim or claim.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reclamation introuvable.")
    return _to_claim_out(claim)


# Retourne la liste des reclamations pour le back-office admin.
def list_claims_for_admin() -> list[ClaimOut]:
    return [_to_claim_out(model) for model in _claims_repo.list_claims(limit=500)]


# Enregistre la reponse admin a une reclamation et met son statut a jour.
def reply_to_claim_as_admin(*, claim_id: str, admin_email: str, payload: ClaimReplyRequest) -> ClaimOut:
    updated = _claims_repo.reply_to_claim(claim_id, admin_email=admin_email, message=payload.message)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reclamation introuvable.")
    return _to_claim_out(updated)


# Marque comme lues les reponses admin visibles par un utilisateur.
def mark_user_claim_replies_as_read(*, user_id: str) -> int:
    return _claims_repo.mark_replies_as_read_by_user(user_id)


# Compte le nombre de reponses admin non lues par un utilisateur.
def count_user_unread_claim_replies(*, user_id: str) -> int:
    return _claims_repo.count_unread_replies_for_user(user_id)
