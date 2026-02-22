#!/bin/sh

echo "🔄 Téléchargement du modèle spaCy (si nécessaire)..."
python -m spacy download fr_core_news_sm || true

echo "📥 Démarrage de l'application (indexation au startup FastAPI)..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
