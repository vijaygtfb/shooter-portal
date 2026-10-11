# AGENTS.md — Project Context & Guardrails

> Read this file before generating or changing any code in this repo.
> It defines the approved tech stack, structure, conventions and rules.
> If a request conflicts with this file, follow this file and flag the conflict.

---

## 1. Project overview

| Item | Value |
|---|---|
| Type | Serverless web application (SPA + REST API) |
| Frontend | React SPA → S3 static website |
| Backend | Python FastAPI → AWS Lambda (via Mangum) behind API Gateway HTTP API |
| Data | Amazon DynamoDB |
| IaC | AWS CloudFormation (SAM transform for backend) |
| CI/CD | Azure DevOps multi-stage YAML — CI + CD in ONE pipeline per component |
| Environments | `test` → `uat` → `prod` (plus `local` for dev) |
| AWS region | `ap-south-1` (change in pipelines + env files together) |

---

## 2. Approved tech stack (do not substitute)

### Frontend
| Concern | Use | Do NOT use |
|---|---|---|
| Framework | React 18 + TypeScript (strict) + Vite | CRA, Next.js, plain JS |
| UI components | **PrimeReact** (+ PrimeIcons) | MUI, AntD, Chakra, Bootstrap, raw HTML widgets where a PrimeReact one exists |
| Form state | **React Hook Form** | Formik, manual `useState` forms |
| Validation / types | **Zod** (v4) | Yup, Joi, hand-written validators |
| Bridge | **@hookform/resolvers** (`zodResolver`) | — |
| HTTP | `apiRequest()` in `src/lib/apiClient.ts` (fetch) | axios, direct `fetch` in components |
| Logging | `logger` in `src/lib/logger.ts` | `console.*` (ESLint blocks it) |
| Tests | Vitest | Jest |

### Backend
| Concern | Use | Do NOT use |
|---|---|---|
| Language | Python 3.12 | — |
| Framework | **FastAPI** | Flask, Django, Chalice |
| Lambda adapter | **Mangum** (`handler = Mangum(app, lifespan="off")`) | custom event parsing |
| Models / validation | Pydantic v2 | dataclasses for API contracts |
| Config | `pydantic-settings` (`app/core/config.py`) | `os.environ[...]` scattered in code |
| Data access | boto3 DynamoDB via repositories | ORMs, direct boto3 in routes |
| Logging | stdlib `logging` via `app/core/logging.py` | `print()` |
| Tests | pytest + moto + FastAPI TestClient | real AWS in unit tests |
| Lint/format | ruff | black/flake8/isort separately |

---

## 3. Repository structure

```
/
├── AGENTS.md                     # this file (agent context + guardrails)
├── CLAUDE.md                     # points to AGENTS.md
├── README.md                     # how to build / run
├── .gitignore
├── template-backend.yaml         # SAM/CFN: Lambda, HTTP API, DynamoDB, log groups
├── template-frontend.yaml        # CFN: S3 static website bucket + policy
├── azure-pipelines-backend.yml   # CI+CD backend  (test → uat → prod)
├── azure-pipelines-frontend.yml  # CI+CD frontend (test → uat → prod)
├── env-test.yaml                 # per-env pipeline variables (incl. log level)
├── env-uat.yaml
├── env-prod.yaml
│
├── backend/                      # ALL API code lives here
│   ├── app/
│   │   ├── main.py               # FastAPI app + Lambda `handler`
│   │   ├── core/                 # config, logging, middleware, dynamodb factory
│   │   ├── api/routes/           # one router per resource (thin)
│   │   ├── models/               # Pydantic request/response models
│   │   └── repositories/         # DynamoDB access (one per table/entity)
│   ├── tests/                    # pytest (moto-mocked DynamoDB)
│   ├── scripts/                  # local helpers (create_local_tables.py)
│   ├── docker-compose.yml        # DynamoDB Local
│   ├── local-env.json            # env vars for `sam local start-api`
│   ├── requirements.txt          # runtime deps (packaged to Lambda)
│   ├── requirements-dev.txt      # + test/lint deps
│   └── pyproject.toml            # ruff + pytest config
│
└── frontend/                     # ALL React code lives here
    ├── public/config.js          # runtime config (replaced per env by pipeline)
    ├── src/
    │   ├── main.tsx              # PrimeReactProvider + theme imports
    │   ├── App.tsx
    │   ├── config.ts             # Zod-validated runtime config
    │   ├── lib/                  # apiClient.ts, logger.ts (shared infra)
    │   └── features/<feature>/   # schema.ts, <feature>Api.ts, components, tests
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    └── eslint.config.js
```

**Placement rules**
- API code → `backend/` only. React code → `frontend/` only.
- CI/CD, CloudFormation, env files, `.gitignore` → repo root only.
- Frontend is organised **by feature** (`src/features/<name>/`), not by file type.

---

## 4. Frontend conventions

### Forms (mandatory pattern)
1. Define the Zod schema in `features/<name>/schema.ts`; derive types with `z.infer`.
2. `useForm<T>({ resolver: zodResolver(schema), mode: "onTouched" })`.
3. Native-backed PrimeReact inputs (`InputText`, `InputTextarea`) → `register()`.
4. Non-native PrimeReact inputs (`Dropdown`, `InputNumber`, `Calendar`, `MultiSelect`, `Checkbox`, `FileUpload`…) → **`Controller`**. Never `register()` these.
5. Show errors with `<small className="p-error">` and add `p-invalid` to the input.
6. Submit via a function in `features/<name>/<name>Api.ts` that calls `apiRequest()`.
7. Feedback via PrimeReact `Toast`. Button label says what happens ("Save item", not "Submit").

### API calls
- Only through `apiRequest(path, zodSchema, init)`; every response is **parsed with Zod**.
- No hard-coded URLs. Base URL comes from `config.apiBaseUrl`.
- Handle `ApiError` (has `status`, `detail`, `requestId`).

### Contract sync
- Zod schemas in `features/*/schema.ts` **mirror** Pydantic models in `backend/app/models/`.
- Backend is the source of truth. Change both in the same PR.
- Enums (e.g. `CATEGORIES`) must match the backend `StrEnum` values exactly.

### Config & env
- Per-environment values go in `public/config.js` (`window.__APP_CONFIG__`), validated in `src/config.ts`.
- **Build once, deploy many**: do NOT use `VITE_*` vars for anything that differs per env.

### Files uploads (when needed)
- Validate type/size/row content with Zod on the client (`z.file()` / `z.instanceof(File)` + `.refine`).
- Always re-validate on the backend (size, magic bytes, Pydantic row validation).

---

## 5. Backend conventions

### Layering (strict)
```
routes (HTTP only) → repositories (DynamoDB only) → boto3
          ↘ models (Pydantic, shared contract)
```
- Routes: parse input, call repository, map "not found" → 404. No boto3 here.
- Repositories: all DynamoDB calls. Return Pydantic models, not raw dicts.
- Inject repositories via `Depends(get_<x>_repository)` so tests can override.

### Lambda / Mangum
- Entry point: `app.main.handler`. Do not rename without updating `template-backend.yaml`.
- `lifespan="off"`; do not rely on startup/shutdown events.
- No `BackgroundTasks`, threads or work after the response (Lambda freezes). Use SQS/EventBridge.
- Keep requests < 29 s (API Gateway limit). Long work → async (SQS/Step Functions).
- Create boto3 clients at module scope / `lru_cache` (reused across warm invocations).

### API rules
- Every endpoint declares `response_model` and correct status codes (201 for create).
- Request models use `extra="forbid"` and field constraints (`min_length`, `ge`, etc.).
- `/health` must stay dependency-free (used by pipeline smoke test).
- Swagger `/docs` is disabled in `prod` automatically.
- CORS is handled **in FastAPI** (`CORS_ORIGINS`), not in API Gateway. Don't add both.

### Config
- All settings via `get_settings()` (env vars). Never read `os.environ` elsewhere.
- Secrets → AWS Secrets Manager / SSM, fetched at cold start and cached. Never in code, env files, or templates.

---

## 6. DynamoDB rules

- Table names come from env vars (`ITEMS_TABLE_NAME`, set by CloudFormation). Never hard-code.
- Naming: `${AppName}-${EnvName}-<entity>` (e.g. `myapp-prod-items`).
- `PAY_PER_REQUEST` billing; SSE on; PITR + deletion protection in `prod`; `DeletionPolicy: Retain`.
- **No `Scan` in request paths.** Design access patterns first; use keys and GSIs with `Query`.
- Paginate with `LastEvaluatedKey` for list endpoints that can exceed one page.
- Use `ConditionExpression` for create/update to prevent overwrites.
- Store datetimes as ISO-8601 UTC strings. Numbers come back as `Decimal` — let Pydantic convert.
- New table checklist: add to `template-backend.yaml` → grant least-privilege policy to the function → add env var → add to `scripts/create_local_tables.py` → add to `tests/conftest.py`.

---

## 7. Logging (both tiers)

| | Backend | Frontend |
|---|---|---|
| API | `get_logger(__name__)` | `logger.debug/info/warn/error` |
| Level env var | `LOG_LEVEL` = DEBUG / INFO / WARNING / ERROR | `logLevel` in `config.js` = debug / info / warn / error |
| Format env var | `LOG_FORMAT` = json / text | JSON objects to console |
| Set by | `env-<env>.yaml` → pipeline → CFN param → Lambda env | `env-<env>.yaml` → pipeline writes `config.js` |

**Rules**
- Never `print()` (backend) or `console.*` (frontend).
- Structured context via `extra={...}` (backend) / `meta` object (frontend).
- Every backend log line carries `request_id` (Lambda request id); it is also returned as `X-Request-Id`.
- Never log secrets, tokens, full request bodies, or PII.
- To change a log level: edit `env-<env>.yaml` and redeploy. Don't hard-code levels.

---

## 8. CI/CD (Azure DevOps)

- **Two pipelines**: `azure-pipelines-backend.yml`, `azure-pipelines-frontend.yml`. No separate release pipelines.
- Path-based triggers: backend changes only run backend; frontend only runs frontend.
- Stages: `CI` → `Deploy_test` → `Deploy_uat` → `Deploy_prod`. PRs run `CI` only; deploys only from `main`.
- Approvals/checks live on Azure DevOps Environments `myapp-uat`, `myapp-prod`.
- AWS auth via AWS Toolkit service connections named `aws-test`, `aws-uat`, `aws-prod`.
- Per-env values only in `env-<env>.yaml` (non-secret). Secrets → variable groups / Key Vault.
- **Build once, promote the same artifact** through all environments.
- CI must stay green: ruff + pytest (backend); eslint + tsc + vitest + build (frontend).
- Adding a new env var: `template-backend.yaml` parameter/env → `env-*.yaml` → pipeline `--parameter-overrides` → `Settings`.

---

## 9. Testing requirements

- Backend: every route has tests for success, validation error (422) and not-found where relevant. DynamoDB mocked with `moto`. Keep `tests/test_lambda_handler.py` passing (real Mangum invocation).
- Frontend: every Zod schema has unit tests for valid/invalid cases.
- No test may call real AWS or the network.

---

## 10. Guardrails — hard rules

**Always**
- Follow the stack in §2 and structure in §3.
- Type everything (TS strict; Python type hints).
- Validate on **both** client (Zod) and server (Pydantic).
- Add/update tests with every change.
- Least-privilege IAM (SAM policy templates scoped to the specific table).
- Keep `template-backend.yaml`, `scripts/create_local_tables.py` and `tests/conftest.py` table definitions in sync.

**Never**
- Commit secrets, `.env`, AWS keys, or account-specific values other than placeholders.
- Hard-code URLs, table names, regions, or log levels in code.
- Use `Scan` in request paths, `print()`, `console.*`, `any` (TS) without justification.
- Add a new library that duplicates an approved one (§2). Ask first.
- Put infra/pipeline files inside `backend/` or `frontend/`.
- Modify `env-prod.yaml` or prod-only template conditions without explicitly calling it out.

---

## 11. Recipes

### Add a new API resource
1. `backend/app/models/<x>.py` — Pydantic Create/Response models.
2. `backend/app/repositories/<x>_repository.py` — class + `get_<x>_repository()`.
3. `backend/app/api/routes/<x>.py` — router; include it in `app/main.py`.
4. DynamoDB table/GSI (if new) — follow §6 checklist.
5. Tests in `backend/tests/test_<x>.py`.

### Add a new form / screen
1. `frontend/src/features/<x>/schema.ts` — Zod schemas mirroring the backend.
2. `frontend/src/features/<x>/<x>Api.ts` — calls via `apiRequest`.
3. `frontend/src/features/<x>/<X>Form.tsx` — RHF + zodResolver + PrimeReact (§4).
4. `frontend/src/features/<x>/schema.test.ts`.

---

## 12. Commands

| Task | Command (from folder) |
|---|---|
| Backend deps | `backend/`: `pip install -r requirements-dev.txt` |
| DynamoDB Local | `backend/`: `docker compose up -d && python -m scripts.create_local_tables` |
| Run API locally | `backend/`: `uvicorn app.main:app --reload --port 8000` |
| Run as Lambda locally | root: `sam build -t template-backend.yaml && sam local start-api --env-vars backend/local-env.json --port 8000` |
| Backend lint/test | `backend/`: `ruff check . && ruff format --check . && pytest` |
| Frontend dev | `frontend/`: `npm install && npm run dev` |
| Frontend checks | `frontend/`: `npm run lint && npm run typecheck && npm run test` |
| Frontend build | `frontend/`: `npm run build` → `frontend/dist/` |
