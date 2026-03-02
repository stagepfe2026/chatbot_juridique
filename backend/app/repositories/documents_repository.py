from typing import Any

from bson import ObjectId
from fastapi import HTTPException, status

from app.database.connections import get_documents_collection
from app.models import DocumentModel
from app.schemas import DocumentStatus


class DocumentsRepository:
    def list_active_documents(self) -> list[DocumentModel]:
        cursor = get_documents_collection().find({"deletedAt": None}).sort("createdAt", -1)
        return [DocumentModel.from_mongo(item) for item in cursor]

    def create_document(self, model: DocumentModel) -> str:
        inserted = get_documents_collection().insert_one(model.to_mongo_insert())
        return str(inserted.inserted_id)

    def get_active_document_raw_by_id(self, document_id: str) -> dict[str, Any] | None:
        return get_documents_collection().find_one({"_id": self._parse_document_id(document_id), "deletedAt": None})

    def get_active_document_fields_by_id(self, document_id: str, projection: dict[str, int]) -> dict[str, Any] | None:
        return get_documents_collection().find_one(
            {"_id": self._parse_document_id(document_id), "deletedAt": None},
            projection,
        )

    def mark_document_as_processing(self, document_id: str) -> None:
        get_documents_collection().update_one(
            {"_id": self._parse_document_id(document_id)},
            {"$set": {"documentStatus": DocumentStatus.PROCESSING.value, "indexError": None}},
        )

    def mark_document_as_indexed(self, document_id: str, *, indexed_at, chunks_count: int) -> None:
        get_documents_collection().update_one(
            {"_id": self._parse_document_id(document_id)},
            {
                "$set": {
                    "documentStatus": DocumentStatus.INDEXED.value,
                    "indexedAt": indexed_at,
                    "chunksCount": chunks_count,
                    "indexError": None,
                }
            },
        )

    def mark_document_as_failed(self, document_id: str, *, error: str) -> None:
        get_documents_collection().update_one(
            {"_id": self._parse_document_id(document_id)},
            {"$set": {"documentStatus": DocumentStatus.FAILED.value, "indexError": error}},
        )

    def list_non_indexed_active_document_ids(self) -> list[str]:
        docs = get_documents_collection().find(
            {"deletedAt": None, "documentStatus": {"$ne": DocumentStatus.INDEXED.value}},
            {"_id": 1},
        )
        return [str(doc["_id"]) for doc in docs]

    @staticmethod
    def _parse_document_id(document_id: str) -> ObjectId:
        try:
            return ObjectId(document_id)
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="documentId invalide.") from exc
