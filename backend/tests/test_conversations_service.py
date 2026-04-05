from pathlib import Path
import sys
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.models.conversation_memory import ConversationModel, MessageModel
from app.services.conversations_service import list_conversation_messages_for_user, list_recent_conversations_by_user


class ConversationsServiceTests(unittest.TestCase):
    @patch("app.services.conversations_service._messages_repo")
    @patch("app.services.conversations_service._conversations_repo")
    def test_list_recent_conversations_by_user_groups_by_conversation(self, mock_conversations_repo, mock_messages_repo):
        conversation = ConversationModel(
            id="conv-1",
            summary="Resume global",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            user_id="user-1",
        )
        messages = [
            MessageModel(
                id="m-1",
                conversation_id="conv-1",
                role="user",
                content="Question initiale",
                created_at=datetime.now(timezone.utc),
            ),
            MessageModel(
                id="m-2",
                conversation_id="conv-1",
                role="assistant",
                content="Reponse initiale",
                created_at=datetime.now(timezone.utc),
            ),
        ]

        mock_conversations_repo.list_recent_by_user.return_value = [conversation]
        mock_messages_repo.list_messages.return_value = messages
        mock_messages_repo.count_messages.return_value = 2

        result = list_recent_conversations_by_user("user-1", limit=10)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].id, "conv-1")
        self.assertEqual(result[0].title, "Question initiale")
        self.assertEqual(result[0].preview, "Reponse initiale")
        self.assertEqual(result[0].messageCount, 2)
        mock_conversations_repo.list_recent_by_user.assert_called_once_with(user_id="user-1", limit=10)
        mock_messages_repo.list_messages.assert_called_once_with("conv-1", limit=500)

    @patch("app.services.conversations_service._messages_repo")
    @patch("app.services.conversations_service._conversations_repo")
    def test_list_conversation_messages_for_user(self, mock_conversations_repo, mock_messages_repo):
        mock_conversations_repo.can_access.return_value = True
        mock_messages_repo.list_messages.return_value = [
            MessageModel(
                id="m-1",
                conversation_id="conv-1",
                role="user",
                content="Question",
                created_at=datetime.now(timezone.utc),
            ),
            MessageModel(
                id="m-2",
                conversation_id="conv-1",
                role="assistant",
                content="Reponse",
                created_at=datetime.now(timezone.utc),
            ),
        ]

        result = list_conversation_messages_for_user("user-1", "conv-1", limit=100)

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0].conversationId, "conv-1")
        self.assertEqual(result[1].role, "assistant")
        mock_conversations_repo.can_access.assert_called_once_with("conv-1", "user-1")
        mock_messages_repo.list_messages.assert_called_once_with("conv-1", limit=100)

    @patch("app.services.conversations_service._messages_repo")
    @patch("app.services.conversations_service._conversations_repo")
    def test_list_recent_conversations_by_user_cleans_legacy_wrapped_user_title(self, mock_conversations_repo, mock_messages_repo):
        conversation = ConversationModel(
            id="conv-1",
            summary="Resume global",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            user_id="user-1",
        )
        messages = [
            MessageModel(
                id="m-1",
                conversation_id="conv-1",
                role="user",
                content="Instruction de reponse: fournir une reponse detaillee.
Question utilisateur: Quels avantages fiscaux sont accordes aux entreprises nouvellement creees ?",
                created_at=datetime.now(timezone.utc),
            ),
            MessageModel(
                id="m-2",
                conversation_id="conv-1",
                role="assistant",
                content="Reponse initiale",
                created_at=datetime.now(timezone.utc),
            ),
        ]

        mock_conversations_repo.list_recent_by_user.return_value = [conversation]
        mock_messages_repo.list_messages.return_value = messages
        mock_messages_repo.count_messages.return_value = 2

        result = list_recent_conversations_by_user("user-1", limit=10)

        self.assertEqual(
            result[0].title,
            "Quels avantages fiscaux sont accordes aux entreprises nouvellement creees ?",
        )

    @patch("app.services.conversations_service._messages_repo")
    @patch("app.services.conversations_service._conversations_repo")
    def test_list_conversation_messages_for_user_cleans_legacy_wrapped_user_content(self, mock_conversations_repo, mock_messages_repo):
        mock_conversations_repo.can_access.return_value = True
        mock_messages_repo.list_messages.return_value = [
            MessageModel(
                id="m-1",
                conversation_id="conv-1",
                role="user",
                content="Instruction de reponse: fournir une reponse detaillee.
Question utilisateur: Quels avantages fiscaux sont accordes aux entreprises nouvellement creees ?",
                created_at=datetime.now(timezone.utc),
            ),
        ]

        result = list_conversation_messages_for_user("user-1", "conv-1", limit=100)

        self.assertEqual(
            result[0].content,
            "Quels avantages fiscaux sont accordes aux entreprises nouvellement creees ?",
        )


if __name__ == "__main__":
    unittest.main()
