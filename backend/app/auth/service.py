from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, Response, status

from app.core.config import settings
from app.core.security import generate_session_token, hash_password, hash_session_token, verify_password
from app.models import UserRole
from app.repositories import SessionsRepository, UsersRepository
from app.schemas import AuditLogLevel, AuditLogStatus
from app.schemas import AuthUser, LoginResponse, UpdatePasswordRequest, UpdateProfileRequest
from app.services.audit_logs_service import record_audit_event

_users_repo = UsersRepository()
_sessions_repo = SessionsRepository()
_USER_LOGOUT_REASON = "USER_LOGOUT"
_USER_DISCONNECT_ALL_REASON = "USER_DISCONNECT_ALL"


def ensure_auth_indexes() -> None:
    _users_repo.ensure_indexes()
    _sessions_repo.ensure_indexes()


def _normalize_datetime(value: datetime | None) -> datetime:
    if value is None:
        return datetime.now(timezone.utc)
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "").strip()
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    client = getattr(request, "client", None)
    return getattr(client, "host", None) or "Adresse IP indisponible"


def _parse_user_agent(user_agent: str) -> tuple[str, str]:
    lowered = (user_agent or "").lower()

    if "android" in lowered:
        device = "Android"
    elif "iphone" in lowered or "ipad" in lowered or "ios" in lowered:
        device = "iPhone"
    elif "windows" in lowered:
        device = "Windows"
    elif "mac os" in lowered or "macintosh" in lowered:
        device = "macOS"
    elif "linux" in lowered:
        device = "Linux"
    else:
        device = "Appareil inconnu"

    if "edg/" in lowered:
        browser = "Microsoft Edge"
    elif "chrome/" in lowered and "edg/" not in lowered:
        browser = "Chrome"
    elif "firefox/" in lowered:
        browser = "Firefox"
    elif "safari/" in lowered and "chrome/" not in lowered:
        browser = "Safari"
    else:
        browser = "Navigateur inconnu"

    return device, browser


def _build_login_history(*, user_id: str, current_token_hash: str | None) -> list[dict]:
    history: list[dict] = []
    for session in _sessions_repo.list_recent_sessions_by_user_id(user_id=user_id, limit=6):
        user_agent = str(session.get("userAgent", ""))
        device, browser = _parse_user_agent(user_agent)
        token_hash = str(session.get("tokenHash", ""))
        created_at = _normalize_datetime(session.get("createdAt"))
        location = str(session.get("ipAddress") or "Adresse IP indisponible")
        is_current = bool(current_token_hash and token_hash == current_token_hash)
        is_suspicious = not is_current and bool(session.get("closedBeforeExpiry"))
        if location == "Adresse IP indisponible" and not user_agent:
            is_suspicious = True

        history.append(
            {
                "device": device,
                "browser": browser,
                "location": location,
                "lastSeenAt": created_at,
                "isCurrent": is_current,
                "isSuspicious": is_suspicious,
            }
        )
    return history


def _build_auth_user(*, user, current_token_hash: str | None = None) -> AuthUser:
    payload = user.to_public_dict()
    payload["activeSessionsCount"] = _sessions_repo.count_active_sessions_by_user_id(user_id=user.id or "")
    payload["loginHistory"] = _build_login_history(user_id=user.id or "", current_token_hash=current_token_hash)
    return AuthUser(**payload)


def login_user(*, email: str, password: str, response: Response, request: Request) -> LoginResponse:
    normalized_email = email.lower().strip()
    user = _users_repo.find_active_by_email(normalized_email)
    if not user or not verify_password(password, user.password_hash):
        record_audit_event(
            request=request,
            action="FAILED_LOGIN",
            user=normalized_email,
            resource="Portail d'administration",
            status=AuditLogStatus.FAILED,
            level=AuditLogLevel.CRITICAL,
            message="Tentative de connexion echouee.",
            payload={"email": normalized_email},
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email ou mot de passe invalide.")

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.auth_session_minutes)
    raw_token = generate_session_token()
    token_hash = hash_session_token(raw_token)

    _sessions_repo.create_session(
        user_id=user.id or "",
        token_hash=token_hash,
        expires_at=expires_at,
        user_agent=request.headers.get("user-agent", ""),
        ip_address=_get_client_ip(request),
    )

    response.set_cookie(
        key=settings.auth_session_cookie_name,
        value=raw_token,
        max_age=settings.auth_session_minutes * 60,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        path="/",
    )

    record_audit_event(
        request=request,
        action="LOGIN",
        user=user.email,
        resource="Portail d'administration",
        status=AuditLogStatus.SUCCESS,
        level=AuditLogLevel.INFO,
        message="Connexion reussie.",
        payload={"email": user.email, "role": user.role.value},
    )

    return LoginResponse(
        user=_build_auth_user(user=user, current_token_hash=token_hash),
        sessionExpiresAt=expires_at,
    )


def logout_user(*, request: Request, response: Response) -> None:
    current_user = getattr(request.state, "current_user", None) or {}
    raw_token = request.cookies.get(settings.auth_session_cookie_name)
    if raw_token:
        _sessions_repo.close_session_by_token_hash(
            hash_session_token(raw_token),
            close_reason=_USER_LOGOUT_REASON,
        )

    user_email = str(current_user.get("email", "session"))
    record_audit_event(
        request=request,
        action="LOGOUT",
        user=user_email,
        resource="Portail d'administration",
        status=AuditLogStatus.SUCCESS,
        level=AuditLogLevel.INFO,
        message="Deconnexion utilisateur.",
        payload={"email": user_email},
    )

    response.delete_cookie(key=settings.auth_session_cookie_name, path="/")


def get_current_user_from_request(request: Request) -> AuthUser:
    current_user = getattr(request.state, "current_user", None)
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentification requise.")

    user = _users_repo.find_active_by_id(str(current_user.get("id", "")))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentification requise.")

    raw_token = request.cookies.get(settings.auth_session_cookie_name)
    current_token_hash = hash_session_token(raw_token) if raw_token else None
    return _build_auth_user(user=user, current_token_hash=current_token_hash)


def disconnect_all_user_devices(*, request: Request, response: Response) -> int:
    current_user = get_current_user_from_request(request)
    closed_sessions = _sessions_repo.close_all_sessions_by_user_id(
        user_id=current_user.id,
        close_reason=_USER_DISCONNECT_ALL_REASON,
    )

    record_audit_event(
        request=request,
        action="DISCONNECT_ALL_DEVICES",
        user=current_user.email,
        resource="Profil utilisateur",
        status=AuditLogStatus.SUCCESS,
        level=AuditLogLevel.INFO,
        message="Deconnexion de tous les appareils actifs.",
        payload={"userId": current_user.id, "email": current_user.email, "closedSessions": closed_sessions},
    )

    response.delete_cookie(key=settings.auth_session_cookie_name, path="/")
    return closed_sessions


def update_current_user_profile(*, payload: UpdateProfileRequest, request: Request) -> AuthUser:
    current_user = get_current_user_from_request(request)

    nom = payload.nom.strip()
    prenom = payload.prenom.strip()
    email = payload.email.strip().lower()
    telephone = payload.telephone.strip()
    adresse = payload.adresse.strip()
    date_naissance = payload.dateNaissance.strip()
    direction = payload.direction.strip()
    service = payload.service.strip()
    poste = payload.poste.strip()
    matricule = payload.matricule.strip()
    bureau = payload.bureau.strip()
    responsable = payload.responsable.strip()
    membre_depuis = payload.membreDepuis.strip()
    langue_preferee = payload.languePreferee.strip().lower()
    theme_prefere = payload.themePrefere.strip().lower()

    required_values = [nom, prenom, email, telephone, adresse, date_naissance, direction, service, poste, matricule, bureau, responsable, membre_depuis]
    if any(not value for value in required_values):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tous les champs du profil sont obligatoires.")

    if "@" not in email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Adresse e-mail invalide.")

    if langue_preferee not in {"fr", "en", "ar"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Langue invalide.")

    if theme_prefere not in {"light", "dark"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Theme invalide.")

    try:
        updated_user = _users_repo.update_profile(
            user_id=current_user.id,
            nom=nom,
            prenom=prenom,
            email=email,
            telephone=telephone,
            adresse=adresse,
            date_naissance=date_naissance,
            direction=direction,
            service=service,
            poste=poste,
            matricule=matricule,
            bureau=bureau,
            responsable=responsable,
            membre_depuis=membre_depuis,
            langue_preferee=langue_preferee,
            theme_prefere=theme_prefere,
            notifications_email=payload.notificationsEmail,
            notifications_sms=payload.notificationsSms,
            two_factor_enabled=payload.twoFactorEnabled,
        )
    except ValueError as exc:
        if str(exc) == "EMAIL_ALREADY_USED":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cette adresse e-mail est deja utilisee.") from None
        raise

    if not updated_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable.")

    record_audit_event(
        request=request,
        action="UPDATE_PROFILE",
        user=updated_user.email,
        resource="Profil utilisateur",
        status=AuditLogStatus.SUCCESS,
        level=AuditLogLevel.INFO,
        message="Mise a jour du profil utilisateur.",
        payload={
            "userId": updated_user.id,
            "email": updated_user.email,
            "nom": updated_user.nom,
            "prenom": updated_user.prenom,
            "service": updated_user.service,
            "poste": updated_user.poste,
        },
    )

    request.state.current_user = updated_user.to_public_dict()
    raw_token = request.cookies.get(settings.auth_session_cookie_name)
    current_token_hash = hash_session_token(raw_token) if raw_token else None
    return _build_auth_user(user=updated_user, current_token_hash=current_token_hash)


def update_current_user_password(*, payload: UpdatePasswordRequest, request: Request) -> None:
    current_user = get_current_user_from_request(request)
    user = _users_repo.find_active_by_id(current_user.id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable.")

    current_password = payload.currentPassword.strip()
    new_password = payload.newPassword.strip()
    confirm_password = payload.confirmPassword.strip()

    if not current_password or not new_password or not confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tous les champs du mot de passe sont obligatoires.")

    if not verify_password(current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Le mot de passe actuel est incorrect.")

    if len(new_password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Le nouveau mot de passe doit contenir au moins 8 caracteres.")

    if new_password != confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La confirmation du mot de passe ne correspond pas.")

    if new_password == current_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Le nouveau mot de passe doit etre different de l'ancien.")

    has_letter = any(char.isalpha() for char in new_password)
    has_digit = any(char.isdigit() for char in new_password)
    has_special = any(not char.isalnum() for char in new_password)
    if not (has_letter and has_digit and has_special):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le mot de passe doit contenir des lettres, des chiffres et un caractere special.",
        )

    updated_user = _users_repo.update_password(user_id=current_user.id, password_hash=hash_password(new_password))
    if not updated_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable.")

    record_audit_event(
        request=request,
        action="UPDATE_PASSWORD",
        user=updated_user.email,
        resource="Profil utilisateur",
        status=AuditLogStatus.SUCCESS,
        level=AuditLogLevel.INFO,
        message="Mise a jour du mot de passe utilisateur.",
        payload={"userId": updated_user.id, "email": updated_user.email},
    )


def require_role(*allowed_roles: UserRole):
    allowed = {role.value for role in allowed_roles}

    def _dependency(request: Request) -> AuthUser:
        user = get_current_user_from_request(request)
        if user.role.value not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse pour ce role.")
        return user

    return _dependency
