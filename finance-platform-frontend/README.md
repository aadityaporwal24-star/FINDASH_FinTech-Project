# Financial Institutions Frontend

React + Vite app for:
- Multi-method authentication (Google + email/password via Firebase)
- Profile section (view/edit user metadata)
- Multi-file drag-and-drop document upload and structured JSON view
- Analytics charts/tables generated from structured document data
- AI report generation endpoint integration
- Finance-focused chatbot with document-aware context
- Risk analysis and loan ease estimator

## Quick start

1. Install dependencies
```bash
npm install
```

2. Create env file
```bash
cp .env.example .env
```
Set Firebase keys and API base URL.

3. Run development server
```bash
npm run dev
```

## Expected API endpoints

- `POST /documents/structure` (multipart with `file`) -> structured JSON
- `POST /analytics/report` with `{ documents: [...] }` -> AI report text
- `POST /chat` with `{ question, domain, documents }` -> chatbot response