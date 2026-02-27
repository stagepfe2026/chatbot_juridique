from pymongo import MongoClient
from qdrant_client import QdrantClient

from app.core.config import settings

mongo_client = MongoClient(settings.mongodb_uri)
mongo_db = mongo_client[settings.mongodb_db_name]

qdrant_client = QdrantClient(
    url=settings.qdrant_url,
    api_key=settings.qdrant_api_key,
)


def get_documents_collection():
    return mongo_db[settings.mongodb_documents_collection]


def get_chat_questions_collection():
    return mongo_db["chat_questions"]
