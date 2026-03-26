from app.rag.pipeline import _retrieve_relevant_docs


def retrieve(question: str, k: int = 5):
    # Reutilise la logique de retrieval enrichie du pipeline principal.
    del k
    return _retrieve_relevant_docs(question)
