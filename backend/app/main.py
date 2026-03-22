from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.audit_logs import router as audit_logs_router
from app.api.chat import router as chat_router
from app.api.claims import router as claims_router
from app.api.conversations import router as conversations_router
from app.api.documents import router as documents_router
from app.api.user_documents import router as user_documents_router
from app.auth import ensure_auth_indexes
from app.core.config import settings
from app.middlewares import AuthSessionMiddleware
from app.services.audit_logs_service import ensure_audit_log_indexes
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
app.include_router(conversations_router, prefix=settings.api_prefix)
app.include_router(user_documents_router, prefix=settings.api_prefix)


@app.on_event("startup")
def on_startup() -> None:
    ensure_auth_indexes()
    ensure_conversation_memory_indexes()
    ensure_audit_log_indexes()
    ensure_claim_indexes()


@app.get("/health")
def health():
    # Endpoint simple pour verifier que l'API tourne.
    return {"status": "ok"}
