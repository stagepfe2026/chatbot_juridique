from app.services.conversations_service import (
    archive_conversation_for_user,
    list_conversation_messages_for_user,
    list_recent_conversations,
    list_recent_conversations_by_user,
    restore_conversation_for_user,
    rename_conversation_for_user,
    delete_conversation_for_user,
)


def list_recent_conversations_controller(limit: int = 200):
    return list_recent_conversations(limit=limit)


def list_user_conversations_controller(user_id: str, limit: int = 200):
    return list_recent_conversations_by_user(user_id=user_id, limit=limit)


def list_user_conversation_messages_controller(user_id: str, conversation_id: str, limit: int = 500):
    return list_conversation_messages_for_user(user_id=user_id, conversation_id=conversation_id, limit=limit)


def archive_user_conversation_controller(user_id: str, conversation_id: str):
    return archive_conversation_for_user(user_id=user_id, conversation_id=conversation_id)


def restore_user_conversation_controller(user_id: str, conversation_id: str):
    return restore_conversation_for_user(user_id=user_id, conversation_id=conversation_id)


def rename_user_conversation_controller(user_id: str, conversation_id: str, title: str):
    return rename_conversation_for_user(user_id=user_id, conversation_id=conversation_id, title=title)


def delete_user_conversation_controller(user_id: str, conversation_id: str):
    return delete_conversation_for_user(user_id=user_id, conversation_id=conversation_id)
