const NotesRepository = require('./notesRepository');

/**
 * In-memory implementation. Data lives only in process memory —
 * it disappears on every restart. This is the baseline we replace
 * with Postgres later, without changing anything outside this file.
 */
class InMemoryNotesRepository extends NotesRepository {
  constructor() {
    super();
    this.notes = [];
    this.nextId = 1;
  }

  async create(text) {
    const note = {
      id: this.nextId++,
      text,
      createdAt: new Date().toISOString(),
    };
    this.notes.push(note);
    return note;
  }

  async findAll() {
    return this.notes;
  }
}

module.exports = InMemoryNotesRepository;
