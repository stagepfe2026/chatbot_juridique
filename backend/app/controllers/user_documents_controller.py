from app.services.documents_service import list_favorite_documents, search_documents, set_document_favorite


def search_documents_controller(query: str, limit: int = 20):
    return search_documents(query=query, limit=limit)


def list_favorite_documents_controller(limit: int = 50):
    return list_favorite_documents(limit=limit)


def set_document_favorite_controller(document_id: str, is_favored: bool):
    return set_document_favorite(document_id, is_favored=is_favored)
