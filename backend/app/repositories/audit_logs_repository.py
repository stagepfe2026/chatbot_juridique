from pymongo import DESCENDING
from pymongo.collection import Collection

from app.database.connections import get_audit_logs_collection
from app.models import AuditLogModel


class AuditLogsRepository:
    @staticmethod
    def _collection() -> Collection:
        return get_audit_logs_collection()

    def create_log(self, model: AuditLogModel) -> str:
        inserted = self._collection().insert_one(model.to_mongo_insert())
        return str(inserted.inserted_id)

    def list_logs(self, limit: int = 200) -> list[AuditLogModel]:
        cursor = self._collection().find({}).sort("timestamp", DESCENDING).limit(limit)
        return [AuditLogModel.from_mongo(item) for item in cursor]

    def ensure_indexes(self) -> None:
        collection = self._collection()
        collection.create_index([("timestamp", DESCENDING)])
        collection.create_index([("user", 1), ("timestamp", DESCENDING)])
        collection.create_index([("action", 1), ("timestamp", DESCENDING)])
        collection.create_index([("status", 1), ("timestamp", DESCENDING)])
        collection.create_index([("level", 1), ("timestamp", DESCENDING)])
