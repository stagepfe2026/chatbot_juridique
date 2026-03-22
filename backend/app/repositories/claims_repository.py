from datetime import datetime, timezone

from app.database.connections import get_claims_collection
from app.models import ClaimModel


class ClaimsRepository:
    def create_claim(self, model: ClaimModel) -> ClaimModel:
        inserted = get_claims_collection().insert_one(model.to_mongo_insert())
        raw = get_claims_collection().find_one({"_id": inserted.inserted_id})
        return ClaimModel.from_mongo(raw or {})

    def ensure_indexes(self) -> None:
        claims = get_claims_collection()
        claims.create_index([("userId", 1), ("createdAt", -1)])
        claims.create_index([("status", 1), ("createdAt", -1)])
