/**
 * NotesRepository interface (contract).
 *
 * Any storage backend (in-memory, Postgres, etc.) must implement these
 * two methods with these exact signatures. The service/routes only ever
 * talk to this interface — they never know which backend is behind it.
 *
 *   async create(text) -> { id, text, createdAt }
 *   async findAll()     -> [{ id, text, createdAt }, ...]
 */
class NotesRepository {
  async create(_text) {
    throw new Error('create() not implemented');
  }

  async findAll() {
    throw new Error('findAll() not implemented');
  }
}

module.exports = NotesRepository;
