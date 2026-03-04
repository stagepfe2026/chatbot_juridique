from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


@dataclass
class ChatQuestionModel:
    question: str
    answer: str
    sources: list[dict[str, Any]]
    source_file: dict[str, Any] | None
    asked_at: datetime
    answered_at: datetime
    created_at: datetime
    user_id: str | None = None
    conversation_id: str | None = None
    id: str | None = None

    @classmethod
    def new(
        cls,
        *,
        question: str,
        answer: str,
        sources: list[dict[str, Any]],
        source_file: dict[str, Any] | None,
        asked_at: datetime | None = None,
        answered_at: datetime | None = None,
        user_id: str | None = None,
        conversation_id: str | None = None,
    ) -> "ChatQuestionModel":
        now = datetime.now(timezone.utc)
        return cls(
            question=question.strip(),
            answer=answer,
            sources=sources,
            source_file=source_file,
            asked_at=asked_at or now,
            answered_at=answered_at or now,
            created_at=now,
            user_id=user_id,
            conversation_id=conversation_id,
        )

    @classmethod
    def from_mongo(cls, raw: dict[str, Any]) -> "ChatQuestionModel":
        return cls(
            id=str(raw.get("_id")) if raw.get("_id") is not None else None,
            question=str(raw.get("question", "")),
            answer=str(raw.get("answer", "")),
            sources=raw.get("sources", []),
            source_file=raw.get("sourceFile"),
            asked_at=raw.get("askedAt") or raw.get("createdAt") or datetime.now(timezone.utc),
            answered_at=raw.get("answeredAt") or raw.get("createdAt") or datetime.now(timezone.utc),
            created_at=raw.get("createdAt") or datetime.now(timezone.utc),
            user_id=str(raw.get("userId")) if raw.get("userId") is not None else None,
            conversation_id=str(raw.get("conversationId")) if raw.get("conversationId") is not None else None,
        )

    def to_mongo_insert(self) -> dict[str, Any]:
        return {
            "question": self.question,
            "answer": self.answer,
            "sources": self.sources,
            "sourceFile": self.source_file,
            "askedAt": self.asked_at,
            "answeredAt": self.answered_at,
            "createdAt": self.created_at,
            "userId": self.user_id,
            "conversationId": self.conversation_id,
        }
