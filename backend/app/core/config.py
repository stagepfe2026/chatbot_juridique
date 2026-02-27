from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Préfixe API commun à toutes les routes backend.
    app_name: str = "Chatbot V1 API"
    api_prefix: str = "/api"

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "chatbot_juridique"
    mongodb_documents_collection: str = "documents"

    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str | None = None
    qdrant_collection_name: str = "juridique_docs"

    embedding_model: str = "BAAI/bge-small-en-v1.5"
    spacy_model: str = "fr_core_news_sm"
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3"
    retriever_k: int = 5

    chunk_size: int = 900
    chunk_overlap: int = 150
    indexing_results_dir: str = "data/indexing_results"

    uploads_dir: str = "data/uploads"
    allowed_extensions: tuple[str, ...] = (".pdf", ".docx")

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
        # Chemin absolu des logs de résultats d'indexation.
        return Path(self.indexing_results_dir).resolve()


settings = Settings()
