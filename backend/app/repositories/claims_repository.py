from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException, status

from app.database.connections import get_claims_collection
from app.models import ClaimModel


class ClaimsRepository:
    def create_claim(self, model: ClaimModel) -> ClaimModel:
        inserted = get_claims_collection().insert_one(model.to_mongo_insert())
        raw = get_claims_collection().find_one({"_id": inserted.inserted_id})
        return ClaimModel.from_mongo(raw or {})

    def list_claims_for_user(self, user_id: str, limit: int = 100) -> list[ClaimModel]:
        cursor = (
            get_claims_collection()
            .find({"userId": user_id})
            .sort("createdAt", -1)
            .limit(limit)
        )
        return [ClaimModel.from_mongo(item) for item in cursor]

    def list_claims(self, limit: int = 300) -> list[ClaimModel]:
        cursor = get_claims_collection().find({}).sort("createdAt", -1).limit(limit)
        return [ClaimModel.from_mongo(item) for item in cursor]

    def find_claim_by_id(self, claim_id: str) -> ClaimModel | None:
        raw = get_claims_collection().find_one({"_id": self._parse_claim_id(claim_id)})
        if not raw:
            return None
        return ClaimModel.from_mongo(raw)

    def reply_to_claim(self, claim_id: str, *, admin_email: str, message: str) -> ClaimModel | None:
        now = datetime.now(timezone.utc)
        result = get_claims_collection().update_one(
            {"_id": self._parse_claim_id(claim_id)},
            {
                "$set": {
                    "status": "ANSWERED",
                    "adminReply": message.strip(),
                    "adminReplyAt": now,
                    "adminReplyBy": admin_email.strip().lower(),
                    "isReplyReadByUser": False,
                    "updatedAt": now,
                }
            },
        )
        if result.matched_count == 0:
            return None
        return self.find_claim_by_id(claim_id)

    def mark_replies_as_read_by_user(self, user_id: str) -> int:
        now = datetime.now(timezone.utc)
        result = get_claims_collection().update_many(
            {
                "userId": user_id,
                "adminReply": {"$ne": None},
                "isReplyReadByUser": False,
            },
            {"$set": {"isReplyReadByUser": True, "updatedAt": now}},
        )
        return int(result.modified_count)

    def count_unread_replies_for_user(self, user_id: str) -> int:
        return int(
            get_claims_collection().count_documents(
                {
                    "userId": user_id,
                    "adminReply": {"$ne": None},
                    "isReplyReadByUser": False,
                }
            )
        )

    def ensure_indexes(self) -> None:
        claims = get_claims_collection()
        claims.create_index([("userId", 1), ("createdAt", -1)])
        claims.create_index([("status", 1), ("createdAt", -1)])
        claims.create_index([("userId", 1), ("isReplyReadByUser", 1), ("updatedAt", -1)])

    @staticmethod
    def _parse_claim_id(claim_id: str) -> ObjectId:
        try:
            return ObjectId(claim_id)
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="claimId invalide.") from exc
