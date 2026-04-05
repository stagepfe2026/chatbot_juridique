import logging
import shutil
import threading

from langchain_community.embeddings import FastEmbedEmbeddings

from app.core.config import settings

_embeddings = None
_embeddings_lock = threading.Lock()
logger = logging.getLogger(__name__)


def _build_embeddings() -> FastEmbedEmbeddings:
    settings.fastembed_cache_path.mkdir(parents=True, exist_ok=True)
    return FastEmbedEmbeddings(
        model_name=settings.embedding_model,
        cache_dir=str(settings.fastembed_cache_path),
    )


def _reset_fastembed_cache() -> None:
    cache_path = settings.fastembed_cache_path
    if not cache_path.exists():
        return
    shutil.rmtree(cache_path, ignore_errors=True)
    cache_path.mkdir(parents=True, exist_ok=True)


def get_embeddings() -> FastEmbedEmbeddings:
    # Retourne une instance partagee du modele d'embedding.
    global _embeddings
    if _embeddings is not None:
        return _embeddings

    with _embeddings_lock:
        if _embeddings is not None:
            return _embeddings
        try:
            _embeddings = _build_embeddings()
        except Exception:
            logger.warning(
                "FastEmbed initialization failed from cache %s. Clearing cache and retrying once.",
                settings.fastembed_cache_path,
                exc_info=True,
            )
            _reset_fastembed_cache()
            _embeddings = _build_embeddings()
        return _embeddings
