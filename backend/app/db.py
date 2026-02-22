from pymongo import MongoClient

from app.config import settings

_client = MongoClient(settings.mongodb_uri)
db = _client[settings.mongodb_db_name]


def get_documents_collection():
    return db["documents"]
