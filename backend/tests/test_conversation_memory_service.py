from pathlib import Path
import sys
import unittest
from types import SimpleNamespace

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services import conversation_memory_service as cms


class FakeConversationsRepo:
    def __init__(self):
        self.items = {}
        self.counter = 0

    def ensure_exists(self, conversation_id, user_id=None):
        if conversation_id and conversation_id in self.items:
            return conversation_id
        self.counter += 1
        new_id = f"conv-{self.counter}"
        self.items[new_id] = {"summary": "", "user_id": user_id}
        return new_id

    def get_conversation_by_id(self, conversation_id):
        item = self.items.get(conversation_id)
        if not item:
            return None
        return SimpleNamespace(id=conversation_id, summary=item["summary"])

    def set_summary(self, conversation_id, summary):
        self.items.setdefault(conversation_id, {"summary": ""})["summary"] = summary

    def touch(self, conversation_id):
        return None

    def ensure_indexes(self):
        return None


class FakeMessagesRepo:
    def __init__(self):
        self.items = []

    def create_message(self, model):
        self.items.append(
            {
                "conversation_id": model.conversation_id,
                "role": model.role,
                "content": model.content,
                "created_at": model.created_at,
            }
        )
        return str(len(self.items))

    def list_last_messages(self, conversation_id, limit):
        filtered = [m for m in self.items if m["conversation_id"] == conversation_id][-limit:]
        return [SimpleNamespace(role=m["role"], content=m["content"]) for m in filtered]

    def ensure_indexes(self):
        return None


class FakeLlm:
    def __init__(self, content):
        self.content = content

    def invoke(self, _prompt):
        return SimpleNamespace(content=self.content)


class ConversationMemoryServiceTests(unittest.TestCase):
    def setUp(self):
        self.old_conversations_repo = cms._conversations_repo
        self.old_messages_repo = cms._messages_repo
        self.old_llm = cms._llm
        cms._conversations_repo = FakeConversationsRepo()
        cms._messages_repo = FakeMessagesRepo()

    def tearDown(self):
        cms._conversations_repo = self.old_conversations_repo
        cms._messages_repo = self.old_messages_repo
        cms._llm = self.old_llm

    def test_save_and_get_last_messages(self):
        conv_id = cms.ensure_conversation(None)
        cms.save_message(conv_id, "user", "Bonjour")
        cms.save_message(conv_id, "assistant", "Salut")

        rows = cms.get_last_messages(conv_id, 10)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["role"], "user")
        self.assertEqual(rows[1]["content"], "Salut")

    def test_update_summary(self):
        conv_id = cms.ensure_conversation(None)
        cms._conversations_repo.set_summary(conv_id, "Ancien resume")
        cms.save_message(conv_id, "user", "Question fiscale")
        cms.save_message(conv_id, "assistant", "Reponse fiscale")
        cms._llm = FakeLlm("Nouveau resume court")

        result = cms.update_conversation_summary(conv_id)
        self.assertEqual(result, "Nouveau resume court")
        self.assertEqual(cms.get_conversation_summary(conv_id), "Nouveau resume court")


if __name__ == "__main__":
    unittest.main()
