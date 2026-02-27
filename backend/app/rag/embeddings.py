from langchain_community.embeddings import FastEmbedEmbeddings

from app.core.config import settings

_embeddings = None


def get_embeddings() -> FastEmbedEmbeddings:
    # Retourne une instance partagée du modèle d'embedding.
    global _embeddings
    if _embeddings is None:
        _embeddings = FastEmbedEmbeddings(model_name=settings.embedding_model)
    return _embeddings
