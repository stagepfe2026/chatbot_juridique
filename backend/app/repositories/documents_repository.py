from datetime import datetime
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

    def list_favorite_documents(self, limit: int = 50) -> list[DocumentModel]:
        cursor = (
            get_documents_collection()
            .find({"deletedAt": None, "isFavored": True})
            .sort("createdAt", -1)
            .limit(limit)
        )
        return [DocumentModel.from_mongo(item) for item in cursor]


    def count_favorite_documents(self) -> int:
        return int(get_documents_collection().count_documents({"deletedAt": None, "isFavored": True}))
    def create_document(self, model: DocumentModel) -> str:
        inserted = get_documents_collection().insert_one(model.to_mongo_insert())
        return str(inserted.inserted_id)

    def find_active_by_title_and_category(self, *, title: str, category: str) -> DocumentModel | None:
        raw = get_documents_collection().find_one(
            {"title": title.strip(), "category": category, "deletedAt": None},
            sort=[("createdAt", -1)],
        )
        if not raw:
            return None
        return DocumentModel.from_mongo(raw)

    def update_document_import_payload(
        self,
        document_id: str,
        *,
        file_path: str,
        file_size: int,
        file_type: str,
        description: str,
        realized_at: datetime | None,
    ) -> None:
        get_documents_collection().update_one(
            {"_id": self._parse_document_id(document_id), "deletedAt": None},
            {
                "$set": {
                    "filePath": file_path,
                    "fileSize": file_size,
                    "fileType": file_type,
                    "description": description.strip(),
                    "realizedAt": realized_at,
                    "documentStatus": DocumentStatus.PROCESSING.value,
                    "indexError": None,
                }
            },
        )

    def get_active_document_raw_by_id(self, document_id: str) -> dict[str, Any] | None:
        return get_documents_collection().find_one({"_id": self._parse_document_id(document_id), "deletedAt": None})

    def get_active_document_by_id(self, document_id: str) -> DocumentModel | None:
        raw = self.get_active_document_raw_by_id(document_id)
        if not raw:
            return None
        return DocumentModel.from_mongo(raw)

    def get_active_document_fields_by_id(self, document_id: str, projection: dict[str, int]) -> dict[str, Any] | None:
        return get_documents_collection().find_one(
            {"_id": self._parse_document_id(document_id), "deletedAt": None},
            projection,
        )

    def get_active_documents_fields_by_ids(
        self,
        document_ids: list[str],
        projection: dict[str, int],
    ) -> dict[str, dict[str, Any]]:
        object_ids: list[ObjectId] = []
        for document_id in document_ids:
            try:
                object_ids.append(self._parse_document_id(document_id))
            except HTTPException:
                continue
        if not object_ids:
            return {}

        cursor = get_documents_collection().find(
            {"_id": {"$in": object_ids}, "deletedAt": None},
            projection,
        )
        return {str(doc.get("_id")): doc for doc in cursor}

    def mark_document_as_processing(self, document_id: str) -> None:
        get_documents_collection().update_one(
            {"_id": self._parse_document_id(document_id), "deletedAt": None},
            {"$set": {"documentStatus": DocumentStatus.PROCESSING.value, "indexError": None}},
        )

    def update_document_content(self, document_id: str, *, content: str) -> None:
        get_documents_collection().update_one(
            {"_id": self._parse_document_id(document_id), "deletedAt": None},
            {"$set": {"content": content}},
        )

    def update_document_favorite(self, document_id: str, *, is_favored: bool) -> None:
        get_documents_collection().update_one(
            {"_id": self._parse_document_id(document_id), "deletedAt": None},
            {"$set": {"isFavored": bool(is_favored)}},
        )

    def mark_document_as_indexed(self, document_id: str, *, indexed_at, chunks_count: int) -> None:
        get_documents_collection().update_one(
            {"_id": self._parse_document_id(document_id), "deletedAt": None},
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
            {"_id": self._parse_document_id(document_id), "deletedAt": None},
            {"$set": {"documentStatus": DocumentStatus.FAILED.value, "indexError": error}},
        )

    def list_non_indexed_active_document_ids(self) -> list[str]:
        docs = get_documents_collection().find(
            {"deletedAt": None, "documentStatus": {"$ne": DocumentStatus.INDEXED.value}},
            {"_id": 1},
        )
        return [str(doc["_id"]) for doc in docs]

    def search_active_documents(self, *, terms: list[str], limit: int = 25) -> list[DocumentModel]:
        if not terms:
            return []
        conditions = [
            {
                "$or": [
                    {"title": {"$regex": term, "$options": "i"}},
                    {"content": {"$regex": term, "$options": "i"}},
                ]
            }
            for term in terms
        ]
        query = {"deletedAt": None, "$and": conditions} if conditions else {"deletedAt": None}
        cursor = get_documents_collection().find(query).sort("createdAt", -1).limit(limit)
        return [DocumentModel.from_mongo(item) for item in cursor]

    def hard_delete_document(self, document_id: str) -> dict[str, Any]:
        oid = self._parse_document_id(document_id)
        raw = get_documents_collection().find_one({"_id": oid})
        if not raw:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document introuvable.")
        get_documents_collection().delete_one({"_id": oid})
        return raw

    def get_document_raw_by_id(self, document_id: str) -> dict[str, Any] | None:
        return get_documents_collection().find_one({"_id": self._parse_document_id(document_id)})

    @staticmethod
    def _parse_document_id(document_id: str) -> ObjectId:
        try:
            return ObjectId(document_id)
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="documentId invalide.") from exc
