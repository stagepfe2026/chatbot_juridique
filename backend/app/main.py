from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.chat import router as chat_router
from app.api.documents import router as documents_router
from app.core.config import settings

# Application FastAPI principale.
app = FastAPI(title=settings.app_name)

# CORS ouvert pour faciliter le dev frontend/backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(documents_router, prefix=settings.api_prefix)
app.include_router(chat_router, prefix=settings.api_prefix)


@app.get("/health")
def health():
    # Endpoint simple pour vérifier que l'API tourne.
    return {"status": "ok"}
