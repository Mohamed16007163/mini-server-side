const http = require('http');
const PostgresNotesRepository = require('./repositories/postgresNotesRepository');

// This is the ONE line that changed from the in-memory version.
// Everything below never needed to know or care which repository this is.
const notesRepository = new PostgresNotesRepository(process.env.DATABASE_URL);

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  try {
    if (req.url === '/' && req.method === 'GET') {
      res.statusCode = 200;
      res.end(JSON.stringify({ message: 'Hello, world! my Name is Mohamed' }));
      return;
    }

    if (req.url === '/time' && req.method === 'GET') {
      res.statusCode = 200;
      res.end(JSON.stringify({ time: new Date().toISOString() }));
      return;
    }

    if (req.url === '/notes' && req.method === 'GET') {
      const notes = await notesRepository.findAll();
      res.statusCode = 200;
      res.end(JSON.stringify({ notes }));
      return;
    }

    if (req.url === '/notes' && req.method === 'POST') {
      const raw = await readBody(req);
      let text;
      try {
        text = JSON.parse(raw || '{}').text;
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        return;
      }

      if (!text || typeof text !== 'string') {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: '"text" (string) is required' }));
        return;
      }

      const note = await notesRepository.create(text);
      res.statusCode = 201;
      res.end(JSON.stringify({ note }));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
