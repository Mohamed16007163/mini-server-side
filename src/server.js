const http = require('http');
const SqliteTasksRepository = require('./repositories/sqliteTasksRepository');

const tasksRepository = new SqliteTasksRepository(process.env.SQLITE_FILE || 'tasks.db');

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
    // GET /
    if (req.url === '/' && req.method === 'GET') {
      res.statusCode = 200;
      res.end(JSON.stringify({ message: 'Hello, Mohamed!' }));
      return;
    }

    // GET /tasks
    if (req.url === '/tasks' && req.method === 'GET') {
      const tasks = await tasksRepository.findAll();
      res.statusCode = 200;
      res.end(JSON.stringify({ tasks }));
      return;
    }

    // GET /tasks/:id
    if (req.url.startsWith('/tasks/') && req.method === 'GET') {
      const id = parseInt(req.url.split('/')[2], 10);
      const task = await tasksRepository.findById(id);
      if (!task) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Task not found' }));
        return;
      }
      res.statusCode = 200;
      res.end(JSON.stringify({ task }));
      return;
    }

    // POST /tasks
    if (req.url === '/tasks' && req.method === 'POST') {
      const raw = await readBody(req);
      let title;
      try {
        title = JSON.parse(raw || '{}').title;
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        return;
      }

      if (!title || typeof title !== 'string') {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: '"title" (string) is required' }));
        return;
      }

      const task = await tasksRepository.create(title);
      res.statusCode = 201;
      res.end(JSON.stringify({ task }));
      return;
    }

    // PUT /tasks/:id
    if (req.url.startsWith('/tasks/') && req.method === 'PUT') {
      const id = parseInt(req.url.split('/')[2], 10);
      const raw = await readBody(req);
      let body;
      try {
        body = JSON.parse(raw || '{}');
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        return;
      }

      const updated = await tasksRepository.update(id, body.title, body.done);
      if (!updated) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Task not found' }));
        return;
      }

      res.statusCode = 200;
      res.end(JSON.stringify({ task: updated }));
      return;
    }

    // DELETE /tasks/:id
    if (req.url.startsWith('/tasks/') && req.method === 'DELETE') {
      const id = parseInt(req.url.split('/')[2], 10);
      const deleted = await tasksRepository.delete(id);
      if (!deleted) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Task not found' }));
        return;
      }

      res.statusCode = 200;
      res.end(JSON.stringify({ message: 'Task deleted' }));
      return;
    }

    // Fallback
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
