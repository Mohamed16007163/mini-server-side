# mini-server-side

A minimal Node.js backend with JSON API endpoints, backed by Postgres and
run via Docker Compose.

## Endpoints

- `GET /` — hello message
- `GET /time` — current server time
- `GET /notes` — list all notes
- `POST /notes` — create a note, body: `{ "text": "..." }`

## Architecture

`src/repositories/notesRepository.js` defines the storage interface
(`create`, `findAll`). Two implementations exist:

- `inMemoryNotesRepository.js` — data lives in process memory, lost on restart
- `postgresNotesRepository.js` — data lives in Postgres, survives restarts

`src/server.js` only depends on the interface. Swapping which
implementation is used is a **one-line change** at the top of
`src/server.js` — the routes and service logic never change.

## Run it

1. Copy the env template:
   ```
   cp .env.example .env
   ```
2. Start everything (app + Postgres) with one command:
   ```
   docker compose up --build
   ```
3. The API is now live at `http://localhost:3000`.

## Prove persistence

```bash
# 1. Create a note
curl -X POST http://localhost:3000/notes \
  -H "Content-Type: application/json" \
  -d '{"text":"survives a restart"}'

# 2. Confirm it's there
curl http://localhost:3000/notes

# 3. Restart everything
docker compose down
docker compose up -d

# 4. Confirm the note is STILL there
curl http://localhost:3000/notes
```

If the note from step 1 is still returned in step 4, data survived a full
container + app restart — proof that storage is real (Postgres + a Docker
volume), not just in-memory.

## Notes

- `.env` is gitignored; `.env.example` is the committed template.
- The Postgres volume (`db_data`) is what makes data survive
  `docker compose down` — removing the volume with
  `docker compose down -v` will wipe it, as expected.
