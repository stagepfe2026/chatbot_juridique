from datetime import datetime, timezone

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.config import settings
from app.core.security import hash_session_token
from app.repositories import SessionsRepository, UsersRepository


class AuthSessionMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.sessions_repo = SessionsRepository()
        self.users_repo = UsersRepository()

    async def dispatch(self, request: Request, call_next):
        request.state.current_user = None
        request.state.session_expires_at = None

        raw_token = request.cookies.get(settings.auth_session_cookie_name)
        if raw_token:
            token_hash = hash_session_token(raw_token)
            session = self.sessions_repo.get_active_session_by_token_hash(token_hash)
            if session:
                expires_at = session.get("expiresAt")
                if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)

                if isinstance(expires_at, datetime) and expires_at > datetime.now(timezone.utc):
                    user_id = str(session.get("userId", ""))
                    user = self.users_repo.find_active_by_id(user_id)
                    if user:
                        request.state.current_user = user.to_public_dict()
                        request.state.session_expires_at = expires_at

        return await call_next(request)
