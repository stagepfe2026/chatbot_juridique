from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Prefixe API commun a toutes les routes backend.
    app_name: str = "Chatbot V1 API"
    api_prefix: str = "/api"

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "chatbot_juridique"
    mongodb_documents_collection: str = "documents"
    mongodb_users_collection: str = "users"
    mongodb_sessions_collection: str = "sessions"
    mongodb_conversations_collection: str = "conversations"
    mongodb_messages_collection: str = "messages"
    mongodb_audit_logs_collection: str = "audit_logs"

    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str | None = None
    qdrant_collection_name: str = "juridique_docs"

    embedding_model: str = "BAAI/bge-small-en-v1.5"
    spacy_model: str = "fr_core_news_sm"
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3"
    retriever_k: int = 5
    retriever_min_score: float = 0.5
    memory_last_messages_limit: int = 8
    memory_recent_messages_max_chars: int = 4000
    summary_recent_messages_limit: int = 8

    chunk_size: int = 900
    chunk_overlap: int = 150
    indexing_results_dir: str = "data/indexing_results"

    uploads_dir: str = "data/uploads"
    pdf_cache_dir: str = "data/pdf_cache"
    allowed_extensions: tuple[str, ...] = (".pdf", ".docx", ".doc")

    auth_session_minutes: int = 15
    auth_session_cookie_name: str = "chatbot_session"
    auth_cookie_secure: bool = False
    cors_origins: tuple[str, ...] = ("http://localhost:5173", "http://127.0.0.1:5173")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def uploads_path(self) -> Path:
        # Chemin absolu du dossier d'upload.
        return Path(self.uploads_dir).resolve()

    @property
    def indexing_results_path(self) -> Path:
        # Chemin absolu des logs de resultats d'indexation.
        return Path(self.indexing_results_dir).resolve()

    @property
    def pdf_cache_path(self) -> Path:
        return Path(self.pdf_cache_dir).resolve()


settings = Settings()
