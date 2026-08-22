# mini-server-side

A collection of three Node.js backend APIs built as part of the FlyRank backend internship track:

1. **Task API** — a CRUD API for managing tasks, backed by SQLite.
2. **Auth Login & Protect API** — a secure authentication API using Supabase Auth, with JWT-protected routes and Swagger documentation.
3. **Ticket Triage API** — an LLM-backed endpoint that classifies support ticket messages, with a strict output schema, timeouts, and bounded retries.

Each API runs as its own server and can be started independently.

---

## 1. Task API (SQLite)

A simple CRUD API for managing tasks, built with Node.js and SQLite. Tasks are stored persistently in a SQLite database file, so they survive server restarts.

### Why SQLite?

SQLite is a lightweight, file‑based database that requires no separate server process. It's perfect for small projects, prototyping, or when you want a zero‑configuration database. The entire database is stored in a single file (`tasks.db`), making it easy to backup or move.

### How to start

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. The API will be available at `http://localhost:3000`.

The database file `tasks.db` will be created automatically in the project root on first run. The `tasks` table is also created if it doesn't exist, and three sample tasks are inserted only once.

### API Endpoints

| Method | Endpoint    | Description                                                  |
|--------|-------------|----------------------------------------------------------------|
| GET    | /tasks      | List all tasks                                                 |
| GET    | /tasks/:id  | Get a single task by ID                                        |
| POST   | /tasks      | Create a new task (body: `{"title":"..."}`)                    |
| PUT    | /tasks/:id  | Update a task (body: `{"title":"...", "done": true/false}`)    |
| DELETE | /tasks/:id  | Delete a task                                                   |

All responses are JSON. Unknown IDs return `404`, invalid requests return `400`.

### Where the database lives

`tasks.db` (plus its `-shm`/`-wal` journal files, since WAL mode is enabled) is created in the project root the first time the server runs. These files are runtime data, not source code, so they're git-ignored rather than committed — anyone cloning the repo gets a fresh database automatically on first `npm start`.

### Example SQL Queries

Example queries run manually against `tasks.db` using DB Browser for SQLite:

```sql
-- List all completed tasks
SELECT * FROM tasks WHERE done = 1;

-- Count all tasks
SELECT COUNT(*) FROM tasks;
```

### Database viewer screenshot

![tasks table in DB Browser](./docs/db-screenshot.png)

---

## 2. Auth Login & Protect API (Supabase)

A secure authentication API that handles user Sign Up, Log In, and Log Out, and protects specific routes using JSON Web Tokens (JWTs) issued and verified by **Supabase Auth**.

### How it works

1. The client sends email/password to `/auth/signup` or `/auth/login`.
2. On login, Supabase validates the credentials and returns an **access token** (JWT).
3. The client sends that token in the `Authorization: Bearer <token>` header on requests to protected routes.
4. A reusable Express **middleware** (`src/middleware/authMiddleware.js`) verifies the token with Supabase before letting the request through to the route handler.

### Setup — environment variables

Create a `.env` file in the project root (this file is git-ignored and must never be committed). See `.env.example` for the full list of variables used across this project. For this API specifically:

```
SUPABASE_URL=your_project_url
SUPABASE_KEY=your_anon_key
PORT=4000
```

Get `SUPABASE_URL` and `SUPABASE_KEY` (the **anon/publishable** key, not the service_role key) from your Supabase project dashboard under **Project Settings → API**.

> Note: this project polyfills `WebSocket` for compatibility with `@supabase/supabase-js` on Node.js 20 and below (see `src/config/supabaseClient.js`). If you're on Node 22+, this polyfill is unnecessary but harmless.

### How to run

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server (with auto-restart on file changes):
   ```bash
   npm run dev:auth
   ```
3. The API will be available at `http://localhost:4000`.
4. Interactive API docs (Swagger UI) are available at `http://localhost:4000/docs`.

### API Reference

| Method | Endpoint              | Auth required | Description                          | Success | Failure cases |
|--------|-----------------------|:--:|----------------------------------------|---------|---------------|
| POST   | `/auth/signup`        | No  | Create a new user account              | `201`   | `400` missing fields |
| POST   | `/auth/login`         | No  | Authenticate and receive a JWT         | `200`   | `400` missing fields, `401` invalid credentials |
| POST   | `/auth/logout`        | **Yes** | Terminate the current session      | `204`   | `401` missing/invalid token |
| GET    | `/public/info`        | No  | Read public, unprotected data          | `200`   | — |
| GET    | `/protected/profile`  | **Yes** | Read the authenticated user's profile | `200` | `401` missing/invalid token |
| GET    | `/protected/dashboard`| **Yes** | Sample second protected route, proves the auth middleware is reusable | `200` | `401` missing/invalid token |

**Auth header format** for protected routes:
```
Authorization: Bearer <access_token>
```

### Testing

- A Postman collection is included under `postman/` for manually exercising every endpoint.
- Swagger UI (`/docs`) also supports live testing directly from the browser: click **Authorize**, paste a valid access token (no `Bearer` prefix needed), then use **Try it out** on any protected route.

### Swagger UI screenshot

![Swagger UI showing all routes with bearer auth](./docs/swagger-screenshot.png)

---

## 3. Ticket Triage API (Groq LLM)

A single endpoint that takes a raw support ticket message and returns a structured classification — category, priority, a confidence score, and a one-line reason — generated by an LLM. It's mounted on the same Express app as the Auth API (`src/authServer.js`) and documented alongside it in Swagger.

The point of this endpoint isn't the model call itself (that part is genuinely small); it's making the model's answer something the rest of the codebase can trust without a human double-checking it every time.

### How it works

1. `POST /api/tickets/triage` with `{ "message": "..." }`.
2. The input is validated first (`TicketInputSchema`, 3–5000 characters) — nothing gets sent to the model until this passes.
3. The message is sent to Groq (`openai/gpt-oss-120b`) with a system prompt instructing JSON-only output, under an 8-second hard timeout via `AbortController`.
4. The model's response is parsed and validated against `TicketTriageSchema` — a strict enum-based shape, not a free-form string.
5. If the call times out, the provider returns a 5xx, or the model's output fails validation, the request is retried automatically (up to 2 retries, with backoff). A 4xx from the provider (e.g. bad API key) is **not** retried — it fails immediately, since retrying a hopeless error just wastes time and rate limit.
6. The response always includes `attempts`, so it's visible how many calls it actually took.

### Setup — environment variables

Requires a free Groq API key (no credit card needed): sign up at [console.groq.com](https://console.groq.com), create a key under **API Keys**, and add it to `.env`:

```
GROQ_API_KEY=your_groq_key
```

> Groq models get deprecated periodically — if this endpoint starts returning `model_not_found`, check `src/services/groqClient.js` for the current `MODEL` constant and update it against Groq's [model list](https://console.groq.com/docs/models).

### How to run

Same server as the Auth API — no separate process:
```bash
npm run dev:auth
```
Available at `http://localhost:4000/api/tickets/triage`, documented at `http://localhost:4000/docs`.

### API Reference

| Method | Endpoint                | Auth required | Description                                | Success | Failure cases |
|--------|--------------------------|:--:|----------------------------------------------|---------|---------------|
| POST   | `/api/tickets/triage`   | No | Classify a support ticket message via LLM   | `200`   | `400` invalid/too-short input, `502` model failed after retries or unrecoverable provider error |

**Example request:**
```json
{ "message": "I was charged twice for my subscription this month and need a refund" }
```

**Example success response:**
```json
{
  "ok": true,
  "data": {
    "category": "billing",
    "priority": "high",
    "confidence": 0.98,
    "reason": "Customer reports double charge on subscription and requests refund."
  },
  "attempts": 1
}
```

**Example validation failure (`400`, message too short):**
```json
{
  "ok": false,
  "error": "Invalid input",
  "details": { "message": ["Message too short to triage"] }
}
```

### Testing

- **Automated:** 8 test cases covering the happy path, invalid model output, non-JSON output, recovery after a failed attempt, timeouts, non-retryable 401s, retryable 500s, and input validation — all run against a fake model caller (no live API calls, no flakiness). Run with:
  ```bash
  npm test
  ```
- **Manual:** the same Postman collection under `postman/` includes requests for both a successful classification and a `400` validation failure.

### Design notes

- **Enums, not free strings.** `category` and `priority` are validated against a fixed set of values. If the model returns anything outside that set — even something reasonable-sounding like `"urgent!!"` instead of `"urgent"` — it's treated as a failure and retried, not silently accepted.
- **The retry boundary is deliberate.** Timeouts, 5xx errors, and malformed model output are retried because they might succeed on a second attempt. A 4xx (like a bad API key) will never succeed no matter how many times it's retried, so it fails on the first attempt instead of burning the retry budget.
- **`attempts` is always accurate**, not a hardcoded value — it reflects exactly how many model calls were made, which matters if this is ever used to reason about cost or rate-limit usage.

---

## Project structure

```
mini-server-side/
├── src/
│   ├── server.js                        # Task API (SQLite) entry point
│   ├── authServer.js                    # Auth + Ticket Triage APIs entry point
│   ├── config/
│   │   └── supabaseClient.js            # Supabase client init
│   ├── middleware/
│   │   └── authMiddleware.js            # Reusable JWT verification middleware
│   ├── repositories/
│   │   └── sqliteTasksRepository.js
│   ├── schemas/
│   │   └── ticketTriage.schema.js       # Zod schemas for triage input/output
│   ├── services/
│   │   ├── groqClient.js                # Raw Groq API call with timeout
│   │   ├── ticketTriage.service.js      # Retry + validation trust layer
│   │   └── ticketTriage.service.test.js # 8 test cases (node:test)
│   └── routes/
│       └── ticketTriage.route.js        # Express route for the triage endpoint
├── openapi.json                          # OpenAPI spec powering /docs
├── postman/                               # Postman collection for manual testing
├── docs/                                  # Screenshots referenced in this README
├── .env                                   # Local secrets (git-ignored, not committed)
├── .env.example                           # Template of required env vars, safe to commit
└── package.json
```

## Security notes

- `.env` is git-ignored and was never committed — see `.gitignore`. `.env.example` documents the required variable names without any real values.
- Only the Supabase **anon/publishable** key is used client-side; the service_role key is never exposed.
- Password hashing, token issuance, and token verification are all delegated to Supabase Auth rather than implemented by hand.
- The Groq API key is read server-side only (`process.env.GROQ_API_KEY`) and never returned in any response.
