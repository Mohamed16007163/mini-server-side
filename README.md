# Task API with SQLite

A simple CRUD API for managing tasks, built with Node.js and SQLite. Tasks are stored persistently in a SQLite database file, so they survive server restarts.

## Why SQLite?

SQLite is a lightweight, file‑based database that requires no separate server process. It's perfect for small projects, prototyping, or when you want a zero‑configuration database. The entire database is stored in a single file (`tasks.db`), making it easy to backup or move.

## How to start

1. Clone the repository.
2. Install dependencies:  
   `npm install`
3. Start the server:  
   `npm start`
4. The API will be available at `http://localhost:3000`.

The database file `tasks.db` will be created automatically in the project root on first run. The `tasks` table is also created if it doesn't exist, and three sample tasks are inserted only once.

## API Endpoints

| Method | Endpoint           | Description                        |
|--------|--------------------|------------------------------------|
| GET    | /tasks             | List all tasks                     |
| GET    | /tasks/:id         | Get a single task by ID            |
| POST   | /tasks             | Create a new task (body: `{"title":"..."}`) |
| PUT    | /tasks/:id         | Update a task (body: `{"title":"...", "done": true/false}`) |
| DELETE | /tasks/:id         | Delete a task                      |

All responses are JSON. Unknown IDs return `404`, invalid requests return `400`.

## Example SQL Queries

Here's an example SQL query I ran manually using a SQLite viewer (e.g., DB Browser for SQLite):

```sql
-- List all completed tasks
SELECT * FROM tasks WHERE done = 1;