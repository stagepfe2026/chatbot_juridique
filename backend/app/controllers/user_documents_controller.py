from app.schemas import DocumentCategory
from app.services.documents_service import count_favorite_documents, list_favorite_documents, search_documents, set_document_favorite


def search_documents_controller(
    query: str,
    limit: int = 20,
    page: int = 1,
    category: DocumentCategory | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    sort_field: str = "date",
    sort_dir: str = "desc",
):
    return search_documents(
        query=query,
        limit=limit,
        page=page,
        category=category,
        date_from=date_from,
        date_to=date_to,
        sort_field=sort_field,
        sort_dir=sort_dir,
    )


def list_favorite_documents_controller(limit: int = 50):
    return list_favorite_documents(limit=limit)


def set_document_favorite_controller(document_id: str, is_favored: bool):
    return set_document_favorite(document_id, is_favored=is_favored)


def count_favorite_documents_controller() -> int:
    return count_favorite_documents()
