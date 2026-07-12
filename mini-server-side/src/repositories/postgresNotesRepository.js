const { Pool } = require('pg');
const NotesRepository = require('./notesRepository');

/**
 * Postgres implementation. Same interface as InMemoryNotesRepository —
 * create() and findAll() with identical signatures — so the server
 * doesn't need to change at all to use this instead.
 */
class PostgresNotesRepository extends NotesRepository {
  constructor(connectionString) {
    super();
    this.pool = new Pool({ connectionString });
  }

  async create(text) {
    const result = await this.pool.query(
      'INSERT INTO notes (text) VALUES ($1) RETURNING id, text, created_at AS "createdAt"',
      [text]
    );
    return result.rows[0];
  }

  async findAll() {
    const result = await this.pool.query(
      'SELECT id, text, created_at AS "createdAt" FROM notes ORDER BY id ASC'
    );
    return result.rows;
  }
}

module.exports = PostgresNotesRepository;
