from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.chat_service import create_chat_question

class ChatServiceFlowTests(unittest.TestCase):
    @patch("app.services.chat_service.ask_question")
    def test_create_chat_question_with_conversation_flow(self, mock_ask_question):
        mock_ask_question.return_value = (
            "question-1",
            "Reponse",
            [],
            None,
            "conv-1",
        )

        result = create_chat_question(
            "Ma question",
            user_id="user-1",
            conversation_id="conv-1",
        )

        self.assertEqual(result.questionId, "question-1")
        self.assertEqual(result.conversationId, "conv-1")
        self.assertEqual(result.answer, "Reponse")
        mock_ask_question.assert_called_once()


if __name__ == "__main__":
    unittest.main()
