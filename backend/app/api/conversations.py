from fastapi import APIRouter, Depends

from app.auth import require_role
from app.controllers.conversations_controller import list_recent_conversations_controller
from app.models import UserRole
from app.schemas import ConversationOut

router = APIRouter(
    prefix="/admin/conversations",
    tags=["conversations"],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)


@router.get("", response_model=list[ConversationOut])
def list_conversations(limit: int = 200):
    return list_recent_conversations_controller(limit=limit)
