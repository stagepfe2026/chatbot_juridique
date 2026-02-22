# Backend FastAPI (Chatbot Juridique)

## Prerequis
- Python 3.10+
- MongoDB lance localement (ex: `mongodb://localhost:27017`)

## Installation
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

## Lancer l'API
```bash
uvicorn app.main:app --reload --port 8000
```

## Endpoints utilises par le frontend
- `POST /api/admin/documents/import` (multipart: `file`, `title`, `category`, `description`)
- `GET /api/admin/documents`

## Healthcheck
- `GET /health`
