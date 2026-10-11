# MyApp

Serverless web app: **React + PrimeReact** frontend on S3, **FastAPI** backend on AWS Lambda (Mangum), **DynamoDB** storage, deployed by **Azure DevOps** CI/CD to `test` → `uat` → `prod`.

> Coding rules and stack guardrails: see [AGENTS.md](AGENTS.md).

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20.x |
| npm | 10+ |
| Python | 3.12 |
| Docker | Latest (for DynamoDB Local / `sam local`) |
| AWS SAM CLI | Latest (optional, for Lambda-style local runs) |

---

## Frontend (`frontend/`)

### 1. Install
```bash
cd frontend
npm install
```

### 2. Configure (local)
Runtime config lives in `frontend/public/config.js`:
```js
window.__APP_CONFIG__ = {
  envName: "local",
  apiBaseUrl: "http://localhost:8000",
  logLevel: "debug"          // debug | info | warn | error
};
```
- Point `apiBaseUrl` at your local backend (default) or a deployed `test` API.
- The pipeline **replaces** this file per environment on deploy, so do not use `VITE_*` vars for env-specific values.

### 3. Run
```bash
npm run dev            # http://localhost:5173
```

#### Demo mode (no backend needed)
`public/config.js` has `useMockApi: true` for local runs. Every API call is then answered by an in-browser
mock server (`src/mocks/`) with dummy data saved in the browser's localStorage, so the full UI can be demoed without the backend.

| Account | Role | Notes |
|---|---|---|
| `superadmin@demo.in` | Super Admin | Activates / rejects Coach and District Secretary logins |
| `coach@demo.in` | Coach (Pune) | Students to approve / reject; downloads ID cards |
| `district@demo.in` | District Secretary (Pune) | Approves Coach-approved students, which issues the `SAT…` Shooter ID |
| `sneha.joshi@demo.in` | Student | Approved; can download the ID card |
| `kabir.shinde@demo.in` | Student | Rejected by Coach; sees the reason |
| `aarav.patil@demo.in` | Student | Submitted, awaiting Coach |
| `arjun.more@demo.in` | Student | Draft, resumes at Step 2 |
| `newcoach@demo.in` | Coach | Pending activation, cannot log in yet |

- Password for every account: `Demo@1234`. Every OTP is `123456`.
- The login page lists these accounts (click one to fill the form) and has a **Reset demo data** button.
- `/demo/mailbox` shows every email and SMS the portal would have sent (OTP, password reset link, approval, rejection).
- The ID card PDF uses a sample photo.
- To use the real backend, set `useMockApi: false`. The deploy pipeline's `config.js` leaves it out, so deployed environments use the real API unless you add it.

### 4. Quality checks
```bash
npm run lint           # ESLint (console.* is blocked; use src/lib/logger.ts)
npm run typecheck      # TypeScript strict
npm run test           # Vitest
```

### 5. Production build
```bash
npm run build          # output: frontend/dist/
npm run preview        # serve the build locally
```
`dist/` contains `index.html`, `config.js` (local defaults) and hashed `assets/`. The same build is promoted to every environment.

### 6. How it's deployed
`azure-pipelines-frontend.yml`:
1. **CI**: `npm ci` → lint → typecheck → test → build → publish `dist` artifact.
2. **Deploy (per env)**:
   - Deploys `template-frontend.yaml` (S3 website bucket).
   - Reads the backend `ApiUrl` from the backend stack.
   - Writes `config.js` with `apiBaseUrl` + `logLevel` from `env-<env>.yaml`.
   - Syncs to S3 (assets cached 1 year; `index.html` and `config.js` no-cache).

### Frontend stack at a glance
| Concern | Library |
|---|---|
| Components | PrimeReact + PrimeIcons |
| Form state | React Hook Form |
| Validation / types | Zod |
| Bridge | @hookform/resolvers (`zodResolver`) |
| Build | Vite + TypeScript |

---

## Backend (`backend/`)

### Run locally with uvicorn (fastest loop)
```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env
docker compose up -d                                   # DynamoDB Local on :8001
python -m scripts.create_local_tables
uvicorn app.main:app --reload --port 8000              # http://localhost:8000/docs
```

### Run as Lambda locally (SAM)
```bash
# from repo root; DynamoDB Local must be running
sam build -t template-backend.yaml
sam local start-api --env-vars backend/local-env.json --port 8000
```

### Test & lint
```bash
cd backend
ruff check . && ruff format --check .
pytest
```

---

## Environments & logging

Per-environment values live in `env-test.yaml`, `env-uat.yaml`, `env-prod.yaml`:

| Variable | Used by | Example |
|---|---|---|
| `logLevel` | Lambda `LOG_LEVEL` | `DEBUG` / `INFO` / `WARNING` / `ERROR` |
| `logFormat` | Lambda `LOG_FORMAT` | `json` / `text` |
| `frontendLogLevel` | `config.js` `logLevel` | `debug` / `info` / `warn` / `error` |
| `allowedOrigins` | API CORS | frontend website URL |

Change a value → commit → pipeline redeploys.

## One-time Azure DevOps / AWS setup

1. Install the **AWS Toolkit for Azure DevOps** extension.
2. Create AWS service connections: `aws-test`, `aws-uat`, `aws-prod`.
3. Create Azure DevOps Environments `myapp-test`, `myapp-uat`, `myapp-prod`; add approvals on `uat` and `prod`.
4. Create one S3 bucket per env for SAM artifacts and put its name in `samArtifactBucket`.
5. Replace `<ACCOUNT_ID>` placeholders in `env-*.yaml`.
6. Create two pipelines from `azure-pipelines-backend.yml` and `azure-pipelines-frontend.yml`.
7. First run: deploy **backend before frontend** (frontend reads the API URL from the backend stack).

## Notes
- S3 website endpoints are **HTTP only**. For HTTPS / custom domain in `prod`, add CloudFront + ACM in front of the bucket.
