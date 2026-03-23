from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.audit_logs import router as audit_logs_router
from app.api.chat import router as chat_router
from app.api.claims import admin_router as admin_claims_router, router as claims_router
from app.api.conversations import router as conversations_router
from app.api.documents import router as documents_router
from app.api.user_documents import router as user_documents_router
from app.auth import ensure_auth_indexes
from app.core.config import settings
from app.core.security import hash_session_token
from app.middlewares import AuthSessionMiddleware
from app.repositories import SessionsRepository, UsersRepository
from app.services.audit_logs_service import ensure_audit_log_indexes
from app.services.claims_notifications import claims_notifications_hub
from app.services.claims_service import ensure_claim_indexes
from app.services.conversation_memory_service import ensure_conversation_memory_indexes

# Application FastAPI principale.
app = FastAPI(title=settings.app_name)

# Middleware de session auth via cookie HttpOnly.
app.add_middleware(AuthSessionMiddleware)

# CORS pour dev frontend/backend avec cookies de session.
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(audit_logs_router, prefix=settings.api_prefix)
app.include_router(documents_router, prefix=settings.api_prefix)
app.include_router(chat_router, prefix=settings.api_prefix)
app.include_router(claims_router, prefix=settings.api_prefix)
app.include_router(admin_claims_router, prefix=settings.api_prefix)
app.include_router(conversations_router, prefix=settings.api_prefix)
app.include_router(user_documents_router, prefix=settings.api_prefix)


@app.on_event("startup")
def on_startup() -> None:
    ensure_auth_indexes()
    ensure_conversation_memory_indexes()
    ensure_audit_log_indexes()
    ensure_claim_indexes()


def _get_authenticated_user_from_websocket(websocket: WebSocket) -> dict | None:
    raw_token = websocket.cookies.get(settings.auth_session_cookie_name)
    if not raw_token:
        return None

    token_hash = hash_session_token(raw_token)
    session = SessionsRepository().get_active_session_by_token_hash(token_hash)
    if not session:
        return None

    expires_at = session.get("expiresAt")
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if not isinstance(expires_at, datetime) or expires_at <= datetime.now(timezone.utc):
        return None

    user = UsersRepository().find_active_by_id(str(session.get("userId", "")))
    if not user:
        return None
    return user.to_public_dict()


@app.websocket("/ws/claims")
async def claims_websocket(websocket: WebSocket):
    user = _get_authenticated_user_from_websocket(websocket)
    if not user:
        await websocket.close(code=4401)
        return

    role = str(user.get("role", ""))
    user_id = str(user.get("id", ""))

    if role == "ADMIN":
        await claims_notifications_hub.connect_admin(websocket)
    else:
        await claims_notifications_hub.connect_user(websocket, user_id=user_id)

    try:
        # Keep the socket open until client disconnects.
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await claims_notifications_hub.disconnect(websocket, user_id=user_id if role != "ADMIN" else None)
    except Exception:
        await claims_notifications_hub.disconnect(websocket, user_id=user_id if role != "ADMIN" else None)


@app.get("/health")
def health():
    # Endpoint simple pour verifier que l'API tourne.
    return {"status": "ok"}
