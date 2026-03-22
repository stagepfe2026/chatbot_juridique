from fastapi import APIRouter, Depends, Query

from app.auth import require_role
from app.models import UserRole
from app.schemas import AuditLogOut
from app.services.audit_logs_service import list_audit_logs

router = APIRouter(
    prefix="/admin/audit-logs",
    tags=["audit-logs"],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)


@router.get("", response_model=list[AuditLogOut])
def get_audit_logs(limit: int = Query(default=200, ge=1, le=1000)):
    return list_audit_logs(limit=limit)
