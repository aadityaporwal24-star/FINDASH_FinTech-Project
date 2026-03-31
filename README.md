# FinDash

FinDash is a full-stack financial intelligence platform with:
- Secure user onboarding and profile management.
- Financial document submission and structuring workflow.
- Automated analytics, charts, risk scoring, and loan-readiness estimation.
- AI-generated financial report and finance-focused chatbot responses.
- RBI guideline link discovery for policy-aware analysis.

## 1. Repository Structure

- `finance-platform-frontend/`
  - React + Vite application.
  - Dashboard UI, authentication, uploads, analytics visuals, chatbot UI, and 3D analyst embed.
- `finance-platform-backend/`
  - Express API server.
  - File intake, webhook forwarding, email attachment fetch, analytics/report/chat APIs, profile persistence.

## 2. Tech Stack

- Frontend:
  - React 19, Vite 8
  - Firebase Auth
  - Recharts (analytics visualization)
  - Axios
  - GSAP
  - JSZip + XLSX
  - Three.js / @react-three/* (3D components)
- Backend:
  - Node.js + Express 5
  - Multer (file upload)
  - PostgreSQL (`pg`) for user profiles
  - ImapFlow + Mailparser for email attachment intake
  - Gemini API integration for AI report/chat generation

## 3. Key Product Flows

- Authentication flow:
  - Supports Google Sign-In and email/password authentication (Firebase).
- Profile flow:
  - Reads/saves user profile to PostgreSQL via backend profile endpoints.
- Document processing flow:
  - Frontend submits files.
  - Backend accepts file and forwards to configured n8n webhook.
  - Processed ZIP can be fetched from latest matching email attachment endpoint.
- Analytics flow:
  - Structured data is aggregated into totals, trends, risk score, and loan-estimator metrics.
- AI report flow:
  - Frontend sends structured docs + analytics context.
  - Backend calls Gemini and returns a formatted analyst report.
- Chatbot flow:
  - Backend combines document analytics and internet finance context for responses.

## 4. Backend API Overview

- `GET /health`
  - Health check endpoint.
- `GET /profiles/:userId`
  - Fetch user profile by user id.
- `PUT /profiles/:userId`
  - Upsert user profile.
- `POST /documents/submit`
  - Accepts multipart upload (`file`) and queues async forwarding.
- `GET /documents/jobs/:jobId`
  - Returns async upload job status.
- `POST /documents/structure`
  - Accepts multipart upload (`file`) and returns processed ZIP response.
- `GET /documents/latest-email-attachment`
  - Reads latest matching mailbox attachment and returns base64 payload.
- `POST /analytics/report`
  - Generates AI report using structured documents and risk/analytics context.
- `GET /rbi/latest-guidelines`
  - Fetches latest RBI guideline links.
- `POST /chat`
  - Finance assistant chat endpoint with structured + internet context.

## 5. Environment Variables

Set up `.env` files from examples in both apps.

- Backend (`finance-platform-backend/.env`):
  - `PORT`
  - `REQUEST_TIMEOUT_MS`
  - `HEADERS_TIMEOUT_MS`
  - `UPLOAD_FORWARD_TIMEOUT_MS`
  - `N8N_UPLOAD_WEBHOOK`
  - `N8N_EMAIL_NOTIFY_WEBHOOK`
  - `PROFILE_DATABASE_URL`
  - `EMAIL_IMAP_HOST`
  - `EMAIL_IMAP_PORT`
  - `EMAIL_IMAP_SECURE`
  - `EMAIL_USER`
  - `EMAIL_PASS`
  - `EMAIL_INBOX_MAILBOX`
  - `EMAIL_SENDER_ADDRESS`
  - `EMAIL_DEBUG`
  - `GEMINI_API_KEY`
  - `GEMINI_MODEL`
  - `GEMINI_TIMEOUT_MS`
- Frontend (`finance-platform-frontend/.env`):
  - `VITE_API_BASE_URL`
  - `VITE_N8N_UPLOAD_WEBHOOK`
  - `VITE_REQUEST_TIMEOUT_MS`
  - `VITE_UPLOAD_TIMEOUT_MS`
  - `VITE_VAPI_PUBLIC_KEY`
  - `VITE_VAPI_ASSISTANT_ID`
  - Firebase vars (`VITE_FIREBASE_*`)

## 6. Local Development Setup

1. Clone repository:
   - `git clone https://github.com/1Nitin1/FinDash.git`
2. Install backend dependencies:
   - `cd finance-platform-backend`
   - `npm install`
3. Install frontend dependencies:
   - `cd ../finance-platform-frontend`
   - `npm install`
4. Configure env files:
   - Copy `.env.example` to `.env` in both folders and fill values.
5. Start backend:
   - `cd ../finance-platform-backend`
   - `npm run dev`
6. Start frontend:
   - `cd ../finance-platform-frontend`
   - `npm run dev`

## 7. Security and Operational Notes

- Do not commit real secrets in `.env` files.
- Use app-specific credentials for IMAP mailbox integration.
- Rotate API keys and webhook URLs if exposed.
- Validate and sanitize external payloads in production.
- Add proper auth guards on protected APIs before public deployment.

## 8. Suggested Production Improvements

- Add unit/integration tests for APIs and analytics utilities.
- Add rate limiting and request validation middleware.
- Add structured logging and monitoring.
- Move long-running tasks to queue workers.
- Add CI pipeline for lint/build/test.
- Add role-based access control for institution use-cases.

## 9. License

No explicit license is set yet. Add a `LICENSE` file before open-source distribution.

