# Chatbot Juridique V1

API FastAPI pour:
- importer des documents dans MongoDB
- nettoyer le texte avec spaCy
- chunker avec overlap
- indexer dans Qdrant
- mettre a jour le statut MongoDB (`INDEXED` / `FAILED`)

## Pipeline d'indexation
1. Chargement document (depuis `content` MongoDB ou `filePath`)
2. Nettoyage spaCy:
   - normalisation Unicode + espaces
   - segmentation en phrases
   - filtration des tokens vides / ponctuation bruit
3. Chunking:
   - `chunk_size` (defaut `900`)
   - `chunk_overlap` (defaut `150`)
4. Embedding FastEmbed
5. Upsert des chunks dans Qdrant
6. Update MongoDB:
   - succes: `documentStatus=INDEXED`, `chunksCount`, `indexedAt`
   - echec: `documentStatus=FAILED`, `indexError`

## Endpoints
- `GET /health`
- `GET /api/admin/documents`
- `POST /api/admin/documents/import`
  - multipart: `file`, `title`, `category`, `description`
  - indexe immediatement apres import
- `POST /api/admin/documents/index-existing`
  - indexe tous les documents non indexes de MongoDB
- `POST /api/admin/documents/{document_id}/index`
  - reindexe un document specifique
- `GET /api/admin/documents/qdrant/health`
- `GET /api/admin/documents/qdrant/stats`
- `GET /api/admin/documents/{document_id}/points`
  - visualise les points Qdrant pour un document
- `POST /api/chat/questions`
  - body: `{ "question": "..." }`
  - pipeline RAG: retriever Qdrant + prompt + Ollama
- `GET /api/chat/questions/{question_id}/sources`

## Variables d'environnement
Copier `.env.example` vers `.env` puis ajuster:
- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `MONGODB_DOCUMENTS_COLLECTION`
- `QDRANT_URL`
- `QDRANT_COLLECTION_NAME`
- `OLLAMA_URL`
- `OLLAMA_MODEL`
- `RETRIEVER_K`
- `SPACY_MODEL`
- `CHUNK_SIZE`
- `CHUNK_OVERLAP`
- `UPLOADS_DIR`
- `INDEXING_RESULTS_DIR`

## Run local
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m spacy download fr_core_news_sm
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Commandes de test
```bash
# 1) sante Qdrant
curl -s http://localhost:8080/api/admin/documents/qdrant/health | jq

# 2) stats collection Qdrant
curl -s http://localhost:8080/api/admin/documents/qdrant/stats | jq

# 3) import + indexation d'un document
curl -s -X POST http://localhost:8080/api/admin/documents/import \
  -F "file=@data/laws/Articles_73_a_77_et_suivants_COMPLET.docx" \
  -F "title=Articles 73 a 77" \
  -F "category=LOI_DES_FINANCES" \
  -F "description=Test indexation" | jq

# 4) reindexer tous les documents non indexes
curl -s -X POST http://localhost:8080/api/admin/documents/index-existing | jq

# 5) visualiser les points d'un document (remplacer <DOCUMENT_ID>)
curl -s "http://localhost:8080/api/admin/documents/<DOCUMENT_ID>/points?limit=20" | jq
```

## Fichiers de resultat d'indexation
Un fichier texte est genere pour chaque document dans:
- `data/indexing_results/<document_id>.txt`

Contenu:
- statut final (`INDEXED` / `FAILED`)
- nombre de chunks/points
- message d'erreur si echec
- extrait du texte nettoye
- apercu des 10 premiers chunks

## Visualisation Qdrant UI
- Ouvrir `http://localhost:6333/dashboard`
- Verifier la collection (`QDRANT_COLLECTION_NAME`)
- Comparer le nombre de points avec `GET /api/admin/documents/qdrant/stats`
