from pathlib import Path
import sys
import unittest
from unittest.mock import MagicMock, patch

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.rag.pipeline import (
    _extract_article_refs_from_context,
    _generate_answer,
    _sanitize_answer_references,
)


class PipelineAnswerQualityTests(unittest.TestCase):
    def test_extract_article_refs_from_context_returns_unique_ordered_values(self):
        rag_context = (
            "[Source 1]\ncontent: article 67 ...\n"
            "[Source 2]\ncontent: article 69 ...\n"
            "[Source 3]\ncontent: article 67 ...\n"
        )
        self.assertEqual(_extract_article_refs_from_context(rag_context), ["67", "69"])

    def test_sanitize_answer_replaces_generic_source_references(self):
        rag_context = "[Source 1]\ncontent: article 67 ... article 69 ..."
        answer = "Ces informations sont extraites des sources 1, 2 et 3."
        rendered = _sanitize_answer_references(answer, rag_context)
        self.assertIn("articles 67, 69", rendered.lower())
        self.assertNotIn("sources 1", rendered.lower())

    @patch("app.rag.pipeline._serialize_messages")
    @patch("app.rag.pipeline._get_llm")
    def test_generate_answer_runs_review_pass(self, mock_get_llm, mock_serialize_messages):
        mock_serialize_messages.return_value = ""
        llm = MagicMock()
        llm.invoke.side_effect = [
            MagicMock(content="Brouillon avec sources 1 et 2."),
            MagicMock(content="Reponse finale conforme (article 67)."),
        ]
        mock_get_llm.return_value = llm

        answer = _generate_answer(
            summary="",
            last_messages=[],
            rag_context="[Source 1]\ncontent: article 67 - tiers revenu ...",
            user_question="Que dit l'article 67 ?",
        )

        self.assertEqual(answer, "Reponse finale conforme (article 67).")
        self.assertEqual(llm.invoke.call_count, 2)


if __name__ == "__main__":
    unittest.main()
