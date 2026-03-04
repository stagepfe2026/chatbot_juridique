from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.rag.pipeline import ask_question
from app.rag.prompts import NO_INFO_ANSWER_FR
from app.schemas import SourceFile, SourceItem


class PipelineSourcePolicyTests(unittest.TestCase):
    @patch("app.rag.pipeline._update_summary_async")
    @patch("app.rag.pipeline._chat_questions_repo")
    @patch("app.rag.pipeline.get_conversation_summary")
    @patch("app.rag.pipeline.get_last_messages")
    @patch("app.rag.pipeline.save_message")
    @patch("app.rag.pipeline.ensure_conversation")
    @patch("app.rag.pipeline._retrieve_relevant_docs")
    def test_small_talk_does_not_use_sources(
        self,
        mock_retrieve_docs,
        mock_ensure_conversation,
        mock_save_message,
        mock_last_messages,
        mock_summary,
        mock_chat_repo,
        mock_update_summary,
    ):
        mock_ensure_conversation.return_value = "conv-1"
        mock_last_messages.return_value = []
        mock_summary.return_value = ""
        mock_chat_repo.create_question_record.return_value = "q-1"

        _qid, answer, sources, source_file, _conv = ask_question("bonjour", user_id="user-1", conversation_id=None)

        self.assertTrue(answer)
        self.assertEqual(sources, [])
        self.assertIsNone(source_file)
        mock_retrieve_docs.assert_not_called()
        self.assertTrue(mock_save_message.called)
        self.assertTrue(mock_update_summary.called)

    @patch("app.rag.pipeline._update_summary_async")
    @patch("app.rag.pipeline._chat_questions_repo")
    @patch("app.rag.pipeline.get_conversation_summary")
    @patch("app.rag.pipeline.get_last_messages")
    @patch("app.rag.pipeline.save_message")
    @patch("app.rag.pipeline.ensure_conversation")
    @patch("app.rag.pipeline._retrieve_relevant_docs")
    def test_no_relevant_docs_returns_no_info_and_no_sources(
        self,
        mock_retrieve_docs,
        mock_ensure_conversation,
        mock_save_message,
        mock_last_messages,
        mock_summary,
        mock_chat_repo,
        _mock_update_summary,
    ):
        mock_ensure_conversation.return_value = "conv-1"
        mock_last_messages.return_value = []
        mock_summary.return_value = ""
        mock_retrieve_docs.return_value = []
        mock_chat_repo.create_question_record.return_value = "q-1"

        _qid, answer, sources, source_file, _conv = ask_question(
            "quel est le capital social minimum d'une societe ?",
            user_id="user-1",
            conversation_id=None,
        )

        self.assertEqual(answer, NO_INFO_ANSWER_FR)
        self.assertEqual(sources, [])
        self.assertIsNone(source_file)
        self.assertTrue(mock_save_message.called)

    @patch("app.rag.pipeline._update_summary_async")
    @patch("app.rag.pipeline._chat_questions_repo")
    @patch("app.rag.pipeline.get_conversation_summary")
    @patch("app.rag.pipeline.get_last_messages")
    @patch("app.rag.pipeline.save_message")
    @patch("app.rag.pipeline.ensure_conversation")
    @patch("app.rag.pipeline._generate_answer")
    @patch("app.rag.pipeline._build_source_file")
    @patch("app.rag.pipeline._to_source_items")
    @patch("app.rag.pipeline._build_rag_context")
    @patch("app.rag.pipeline._retrieve_relevant_docs")
    def test_sources_are_returned_only_when_docs_are_used(
        self,
        mock_retrieve_docs,
        mock_build_context,
        mock_to_sources,
        mock_source_file,
        mock_generate_answer,
        mock_ensure_conversation,
        mock_save_message,
        mock_last_messages,
        mock_summary,
        mock_chat_repo,
        _mock_update_summary,
    ):
        mock_ensure_conversation.return_value = "conv-1"
        mock_last_messages.return_value = []
        mock_summary.return_value = ""
        mock_retrieve_docs.return_value = [object()]
        mock_build_context.return_value = "context"
        mock_to_sources.return_value = [
            SourceItem(documentId="doc-1", title="Doc", excerpt="x", section="chunk_1", page="1")
        ]
        mock_source_file.return_value = SourceFile(documentId="doc-1", filename="doc.pdf", downloadUrl="/api/x")
        mock_generate_answer.return_value = "Reponse fondee sur les documents."
        mock_chat_repo.create_question_record.return_value = "q-1"

        _qid, _answer, sources, source_file, _conv = ask_question(
            "Que dit l'article 68 du code ?",
            user_id="user-1",
            conversation_id=None,
        )

        self.assertEqual(len(sources), 1)
        self.assertIsNotNone(source_file)
        self.assertTrue(mock_save_message.called)


if __name__ == "__main__":
    unittest.main()
