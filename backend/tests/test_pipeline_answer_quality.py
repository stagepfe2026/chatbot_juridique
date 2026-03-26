from pathlib import Path
import sys
import unittest
from unittest.mock import MagicMock, patch

from langchain_core.documents import Document

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.rag.pipeline import (
    _build_answer_requirements,
    _extract_article_refs_from_context,
    _generate_answer,
    _sanitize_legal_style,
    _sanitize_answer_references,
    _select_relevant_docs,
    _review_answer_grounding,
    LLMTimeoutError,
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

    def test_build_answer_requirements_requests_legal_structure(self):
        requirements = _build_answer_requirements(
            "Quels avantages fiscaux sont accordes aux entreprises nouvellement creees ?",
            "[Source 1]\ncontent: article 71 ...",
        )
        self.assertIn("beneficiaires", requirements.lower())
        self.assertIn("conditions", requirements.lower())
        self.assertIn("exclusions", requirements.lower())

    def test_sanitize_legal_style_removes_vague_et_suivants_reference(self):
        rag_context = "[Source 1]\ncontent: article 71 ... article 72 ..."
        answer = "Selon les articles 71 et suivants, l'avantage s'applique."
        rendered = _sanitize_legal_style(answer, rag_context)
        self.assertIn("article 71", rendered.lower())
        self.assertNotIn("et suivants", rendered.lower())

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

        with patch.object(settings, "answer_review_enabled", True):
            answer = _generate_answer(
                summary="",
                last_messages=[],
                rag_context="[Source 1]\ncontent: article 67 - tiers revenu ...",
                user_question="Que dit l'article 67 ?",
            )

        self.assertEqual(answer, "Reponse finale conforme (article 67).")
        self.assertEqual(llm.invoke.call_count, 2)

    @patch("app.rag.pipeline._serialize_messages")
    @patch("app.rag.pipeline._get_llm")
    def test_generate_answer_ignores_review_prompt_leakage(self, mock_get_llm, mock_serialize_messages):
        mock_serialize_messages.return_value = ""
        llm = MagicMock()
        llm.invoke.side_effect = [
            MagicMock(content="Reponse fondee sur l'article 67."),
            MagicMock(content="Tu es un verificateur juridique.\nrag_context:\n..."),
        ]
        mock_get_llm.return_value = llm

        with patch.object(settings, "answer_review_enabled", True):
            answer = _generate_answer(
                summary="",
                last_messages=[],
                rag_context="[Source 1]\ncontent: article 67 - tiers revenu ...",
                user_question="Que dit l'article 67 ?",
            )

        self.assertEqual(answer, "Reponse fondee sur l'article 67.")

    @patch("app.rag.pipeline._get_embeddings")
    def test_select_relevant_docs_diversifies_comparative_results(self, mock_get_embeddings):
        embeddings = MagicMock()
        embeddings.embed_query.return_value = [1.0, 0.0]
        embeddings.embed_documents.return_value = [
            [1.0, 0.0],
            [0.99, 0.01],
            [0.95, 0.05],
            [0.9, 0.1],
            [0.0, 1.0],
        ]
        mock_get_embeddings.return_value = embeddings

        candidates = [
            (Document(page_content="Article 67 sur le regime A", metadata={"document_id": "doc-a", "title": "Doc A", "chunk_index": 0}), 0.95),
            (Document(page_content="Article 67 details supplementaires regime A", metadata={"document_id": "doc-a", "title": "Doc A", "chunk_index": 1}), 0.94),
            (Document(page_content="Article 68 exception regime A", metadata={"document_id": "doc-a", "title": "Doc A", "chunk_index": 2}), 0.93),
            (Document(page_content="Article 69 autre detail regime A", metadata={"document_id": "doc-a", "title": "Doc A", "chunk_index": 3}), 0.92),
            (Document(page_content="Article 70 sur le regime B", metadata={"document_id": "doc-b", "title": "Doc B", "chunk_index": 0}), 0.78),
        ]

        with patch.object(settings, "retriever_k", 4), patch.object(settings, "retriever_max_per_document", 2), patch.object(settings, "retriever_use_semantic_rerank", True):
            selected = _select_relevant_docs("Compare le regime A et le regime B", candidates)

        selected_doc_ids = [doc.metadata.get("document_id") for doc in selected]
        self.assertIn("doc-a", selected_doc_ids)
        self.assertIn("doc-b", selected_doc_ids)
        self.assertLessEqual(selected_doc_ids.count("doc-a"), 2)

    @patch("app.rag.pipeline._serialize_messages")
    @patch("app.rag.pipeline._review_answer_grounding")
    @patch("app.rag.pipeline._get_llm")
    def test_generate_answer_skips_review_when_disabled(self, mock_get_llm, mock_review, mock_serialize_messages):
        mock_serialize_messages.return_value = ""
        llm = MagicMock()
        llm.invoke.return_value = MagicMock(content="Reponse finale article 67.")
        mock_get_llm.return_value = llm

        with patch.object(settings, "answer_review_enabled", False):
            answer = _generate_answer(
                summary="",
                last_messages=[],
                rag_context="[Source 1]\ncontent: article 67 - tiers revenu ...",
                user_question="Que dit l'article 67 ?",
            )

        self.assertEqual(answer, "Reponse finale article 67.")
        mock_review.assert_not_called()

    @patch("app.rag.pipeline._generate_answer_once")
    def test_generate_answer_retries_with_reduced_context_after_timeout(self, mock_generate_once):
        mock_generate_once.side_effect = [LLMTimeoutError(), "Reponse reduite."]

        with patch.object(settings, "llm_retry_with_reduced_context", True), patch.object(settings, "llm_retry_max_sources", 1):
            answer = _generate_answer(
                summary="resume",
                last_messages=[{"role": "user", "content": "memoire"}],
                rag_context="[Source 1]\ndocument: Doc A\npage: n/a\ncontent: premier bloc\n\n[Source 2]\ndocument: Doc B\npage: n/a\ncontent: deuxieme bloc",
                user_question="Question ?",
            )

        self.assertEqual(answer, "Reponse reduite.")
        self.assertEqual(mock_generate_once.call_count, 2)
        retry_kwargs = mock_generate_once.call_args_list[1].kwargs
        self.assertEqual(retry_kwargs["summary"], "")
        self.assertEqual(retry_kwargs["last_messages"], [])
        self.assertIn("Doc A", retry_kwargs["rag_context"])
        self.assertNotIn("Doc B", retry_kwargs["rag_context"])


    @patch("app.rag.pipeline._invoke_llm_content")
    def test_review_answer_grounding_returns_draft_when_timeout_occurs(self, mock_invoke):
        mock_invoke.return_value = None

        reviewed = _review_answer_grounding(
            rag_context="[Source 1]\ncontent: article 67",
            user_question="Que dit l'article 67 ?",
            draft_answer="Brouillon.",
        )

        self.assertEqual(reviewed, "Brouillon.")


if __name__ == "__main__":
    unittest.main()
