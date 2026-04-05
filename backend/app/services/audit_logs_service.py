from datetime import datetime, timezone
from typing import Any

from fastapi import Request

from app.models import AuditLogModel
from app.repositories import AuditLogsRepository
from app.schemas import AuditLogDetailsOut, AuditLogLevel, AuditLogOut, AuditLogStatus

_audit_logs_repo = AuditLogsRepository()


# Cree les index utiles aux journaux d'audit.
def ensure_audit_log_indexes() -> None:
    _audit_logs_repo.ensure_indexes()


# Extrait l'IP cliente reelle depuis la requete ou le proxy inverse.
def _client_ip_from_request(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").strip()
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


# Enregistre un evenement d'audit structure avec contexte HTTP et metadonnees.
def record_audit_event(
    *,
    request: Request,
    action: str,
    user: str,
    resource: str,
    status: AuditLogStatus,
    level: AuditLogLevel,
    message: str,
    payload: dict[str, Any] | None = None,
    metadata: dict[str, Any] | None = None,
) -> str:
    details = {
        "message": message,
        "endpoint": request.url.path,
        "payload": payload or {},
        "userAgent": request.headers.get("user-agent"),
        "metadata": metadata or {},
    }
    model = AuditLogModel(
        user=user,
        action=action,
        resource=resource,
        status=status.value,
        level=level.value,
        ip=_client_ip_from_request(request),
        timestamp=datetime.now(timezone.utc),
        details=details,
    )
    return _audit_logs_repo.create_log(model)


# Retourne les logs d'audit sous un format pret pour l'API.
def list_audit_logs(limit: int = 200) -> list[AuditLogOut]:
    items = _audit_logs_repo.list_logs(limit=limit)
    result: list[AuditLogOut] = []
    for item in items:
        result.append(
            AuditLogOut(
                id=item.id or "",
                user=item.user,
                action=item.action,
                resource=item.resource,
                status=AuditLogStatus(item.status),
                level=AuditLogLevel(item.level),
                ip=item.ip,
                timestamp=item.timestamp,
                details=AuditLogDetailsOut(
                    message=str(item.details.get("message", "")),
                    endpoint=item.details.get("endpoint"),
                    payload=item.details.get("payload"),
                    userAgent=item.details.get("userAgent"),
                    metadata=item.details.get("metadata"),
                ),
            )
        )
    return result
