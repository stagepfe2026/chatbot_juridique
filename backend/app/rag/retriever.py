from app.rag.pipeline import _get_vector_store


def retrieve(question: str, k: int = 5):
    # Récupère les chunks les plus pertinents depuis Qdrant.
    return _get_vector_store().as_retriever(search_kwargs={'k': k}).invoke(question)
