const Database = require('better-sqlite3');

class SqliteTasksRepository {
  constructor(dbFile) {
    this.db = new Database(dbFile || 'tasks.db');
    this.db.pragma('journal_mode = WAL');

    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          done INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`
      )
      .run();

    const row = this.db.prepare('SELECT COUNT(*) AS count FROM tasks').get();
    if (row.count === 0) {
      const insert = this.db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
      const sample = [
        ['Learn SQLite', 0],
        ['Build an API', 0],
        ['Ship the app', 0],
      ];
      const insertMany = this.db.transaction((tasks) => {
        for (const [title, done] of tasks) insert.run(title, done);
      });
      insertMany(sample);
    }
  }

  async create(title) {
    const stmt = this.db.prepare('INSERT INTO tasks (title) VALUES (?)');
    const info = stmt.run(title);
    return this.findById(info.lastInsertRowid);
  }

  async findAll() {
    return this.db
      .prepare('SELECT id, title, done, created_at AS "createdAt" FROM tasks ORDER BY id ASC')
      .all();
  }

  async findById(id) {
    return this.db
      .prepare('SELECT id, title, done, created_at AS "createdAt" FROM tasks WHERE id = ?')
      .get(id);
  }

  async update(id, title, done) {
    const stmt = this.db.prepare(
      'UPDATE tasks SET title = COALESCE(?, title), done = COALESCE(?, done) WHERE id = ?'
    );
    const info = stmt.run(title, done, id);
    if (info.changes === 0) return null;
    return this.findById(id);
  }

  async delete(id) {
    const stmt = this.db.prepare('DELETE FROM tasks WHERE id = ?');
    const info = stmt.run(id);
    return info.changes > 0;
  }
}

module.exports = SqliteTasksRepository;