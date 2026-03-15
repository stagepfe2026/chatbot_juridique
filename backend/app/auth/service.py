from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, Response, status

from app.core.config import settings
from app.core.security import generate_session_token, hash_session_token, verify_password
from app.models import UserRole
from app.repositories import SessionsRepository, UsersRepository
from app.schemas import AuthUser, LoginResponse

_users_repo = UsersRepository()
_sessions_repo = SessionsRepository()
_USER_LOGOUT_REASON = "USER_LOGOUT"


def ensure_auth_indexes() -> None:
    _users_repo.ensure_indexes()
    _sessions_repo.ensure_indexes()


def login_user(*, email: str, password: str, response: Response) -> LoginResponse:
    user = _users_repo.find_active_by_email(email)
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email ou mot de passe invalide.")

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.auth_session_minutes)
    raw_token = generate_session_token()
    token_hash = hash_session_token(raw_token)

    _sessions_repo.create_session(user_id=user.id or "", token_hash=token_hash, expires_at=expires_at)

    response.set_cookie(
        key=settings.auth_session_cookie_name,
        value=raw_token,
        max_age=settings.auth_session_minutes * 60,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        path="/",
    )

    return LoginResponse(
        user=AuthUser(**user.to_public_dict()),
        sessionExpiresAt=expires_at,
    )


def logout_user(*, request: Request, response: Response) -> None:
    raw_token = request.cookies.get(settings.auth_session_cookie_name)
    if raw_token:
        _sessions_repo.close_session_by_token_hash(
            hash_session_token(raw_token),
            close_reason=_USER_LOGOUT_REASON,
        )

    response.delete_cookie(key=settings.auth_session_cookie_name, path="/")


def get_current_user_from_request(request: Request) -> AuthUser:
    current_user = getattr(request.state, "current_user", None)
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentification requise.")
    return AuthUser(**current_user)


def require_role(*allowed_roles: UserRole):
    allowed = {role.value for role in allowed_roles}

    def _dependency(request: Request) -> AuthUser:
        user = get_current_user_from_request(request)
        if user.role.value not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse pour ce role.")
        return user

    return _dependency
