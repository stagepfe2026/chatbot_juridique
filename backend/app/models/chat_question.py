from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


@dataclass
class ChatQuestionModel:
    question: str
    answer: str
    sources: list[dict[str, Any]]
    source_file: dict[str, Any] | None
    created_at: datetime
    id: str | None = None

    @classmethod
    def new(
        cls,
        *,
        question: str,
        answer: str,
        sources: list[dict[str, Any]],
        source_file: dict[str, Any] | None,
    ) -> "ChatQuestionModel":
        return cls(
            question=question.strip(),
            answer=answer,
            sources=sources,
            source_file=source_file,
            created_at=datetime.now(timezone.utc),
        )

    @classmethod
    def from_mongo(cls, raw: dict[str, Any]) -> "ChatQuestionModel":
        return cls(
            id=str(raw.get("_id")) if raw.get("_id") is not None else None,
            question=str(raw.get("question", "")),
            answer=str(raw.get("answer", "")),
            sources=raw.get("sources", []),
            source_file=raw.get("sourceFile"),
            created_at=raw.get("createdAt") or datetime.now(timezone.utc),
        )

    def to_mongo_insert(self) -> dict[str, Any]:
        return {
            "question": self.question,
            "answer": self.answer,
            "sources": self.sources,
            "sourceFile": self.source_file,
            "createdAt": self.created_at,
        }
