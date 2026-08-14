# mini-server-side

A collection of two Node.js backend APIs built as part of the FlyRank backend internship track:

1. **Task API** — a CRUD API for managing tasks, backed by SQLite.
2. **Auth Login & Protect API** — a secure authentication API using Supabase Auth, with JWT-protected routes and Swagger documentation.

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

Create a `.env` file in the project root (this file is git-ignored and must never be committed):

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

## Project structure

```
mini-server-side/
├── src/
│   ├── server.js                  # Task API (SQLite) entry point
│   ├── authServer.js              # Auth API (Supabase) entry point
│   ├── config/
│   │   └── supabaseClient.js      # Supabase client init
│   ├── middleware/
│   │   └── authMiddleware.js      # Reusable JWT verification middleware
│   └── repositories/
│       └── sqliteTasksRepository.js
├── openapi.json                   # OpenAPI spec powering /docs
├── postman/                       # Postman collection for manual testing
├── docs/                          # Screenshots referenced in this README
├── .env                           # Local secrets (git-ignored, not committed)
└── package.json
```

## Security notes

- `.env` is git-ignored and was never committed — see `.gitignore`.
- Only the Supabase **anon/publishable** key is used client-side; the service_role key is never exposed.
- Password hashing, token issuance, and token verification are all delegated to Supabase Auth rather than implemented by hand.
