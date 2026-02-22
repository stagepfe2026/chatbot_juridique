from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Chatbot Juridique API"
    api_prefix: str = "/api"
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "base_juridique"
    uploads_dir: str = "uploads"
    allowed_extensions: tuple[str, ...] = (".pdf", ".doc", ".docx")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def uploads_path(self) -> Path:
        return Path(self.uploads_dir).resolve()


settings = Settings()
