// src/server.js
'use strict';

const http = require('http');
const { URL } = require('url');
const SqliteTasksRepository = require('./repositories/sqliteTasksRepository');

const SQLITE_FILE = process.env.SQLITE_FILE || 'tasks.db';
const PORT = Number(process.env.PORT) || 3000;
const tasksRepository = new SqliteTasksRepository(SQLITE_FILE);

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('INVALID_JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload || {});
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

async function handleRequest(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // Health check
    if (pathname === '/health' && req.method === 'GET') {
      return sendJson(res, 200, { status: 'ok' });
    }

    // Root
    if (pathname === '/' && req.method === 'GET') {
      return sendJson(res, 200, { message: 'Hello, Mohamed!' });
    }

    // GET /tasks
    if (pathname === '/tasks' && req.method === 'GET') {
      const tasks = await tasksRepository.findAll();
      return sendJson(res, 200, { tasks });
    }

    // POST /tasks
    if (pathname === '/tasks' && req.method === 'POST') {
      let body;
      try {
        body = await parseJsonBody(req);
      } catch (err) {
        return sendJson(res, 400, { error: 'Invalid JSON body' });
      }

      const title = body && body.title;
      if (!title || typeof title !== 'string') {
        return sendJson(res, 400, { error: '"title" (string) is required' });
      }

      const task = await tasksRepository.create(title);
      return sendJson(res, 201, { task });
    }

    // Routes with id: /tasks/:id
    if (pathname.startsWith('/tasks/') && ['GET', 'PUT', 'DELETE'].includes(req.method)) {
      const parts = pathname.split('/').filter(Boolean);
      const id = Number(parts[1]);
      if (!Number.isInteger(id) || id <= 0) {
        return sendJson(res, 400, { error: 'Invalid id' });
      }

      if (req.method === 'GET') {
        const task = await tasksRepository.findById(id);
        if (!task) return sendJson(res, 404, { error: 'Task not found' });
        return sendJson(res, 200, { task });
      }

      if (req.method === 'PUT') {
        let body;
        try {
          body = await parseJsonBody(req);
        } catch (err) {
          return sendJson(res, 400, { error: 'Invalid JSON body' });
        }

        const title = body.title;
        const done = body.done;
        if (title !== undefined && typeof title !== 'string') {
          return sendJson(res, 400, { error: '"title" must be a string' });
        }
        if (done !== undefined && typeof done !== 'boolean') {
          return sendJson(res, 400, { error: '"done" must be a boolean' });
        }

        const updated = await tasksRepository.update(id, title, done);
        if (!updated) return sendJson(res, 404, { error: 'Task not found' });
        return sendJson(res, 200, { task: updated });
      }

      if (req.method === 'DELETE') {
        const deleted = await tasksRepository.delete(id);
        if (!deleted) return sendJson(res, 404, { error: 'Task not found' });
        return sendJson(res, 200, { message: 'Task deleted' });
      }
    }

    // Not found
    return sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('Unhandled error in request handler', err);
    return sendJson(res, 500, { error: 'Internal server error' });
  }
}

const server = http.createServer((req, res) => {
  // Basic CORS for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  handleRequest(req, res);
});

// Handle EADDRINUSE and other listen errors
server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Set PORT to a free port or stop the process using it.`);
    process.exit(1);
  }
  console.error('Server error', err);
  process.exit(1);
});

// Graceful shutdown
async function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(async (err) => {
    if (err) {
      console.error('Error closing server', err);
      process.exit(1);
    }
    try {
      if (typeof tasksRepository.close === 'function') {
        await tasksRepository.close();
      }
    } catch (e) {
      console.warn('Error closing repository', e);
    }
    console.log('Shutdown complete');
    process.exit(0);
  });

  // Force exit after timeout
  setTimeout(() => {
    console.error('Forcing shutdown');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
