# Finance Platform Backend

## Run
```bash
npm install
npm run dev
```

## Env
Copy `.env.example` to `.env`.

Required now:
- `PORT` (default 3000)

For future secure Firebase Admin usage (backend only):
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

## Endpoints
- `GET /health`
- `POST /documents/structure` (multipart form-data, field: `file`)
- `POST /analytics/report`
- `POST /chat`