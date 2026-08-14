require('dotenv').config();
const express = require('express');
const supabase = require('./config/supabaseClient');
const requireAuth = require('./middleware/authMiddleware');
const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('../openapi.json');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;

// GET /public/info
app.get('/public/info', (req, res) => {
  return res.status(200).json({ message: 'Welcome stranger! This info is public.' });
});

// GET /protected/profile
app.get('/protected/profile', requireAuth, (req, res) => {
  return res.status(200).json({
    id: req.user.id,
    email: req.user.email,
    created_at: req.user.created_at
  });
});

// GET /protected/dashboard — second protected route, proves middleware is reusable
app.get('/protected/dashboard', requireAuth, (req, res) => {
  return res.status(200).json({
    message: `Welcome to your dashboard, ${req.user.email}`
  });
});

// POST /auth/signup
app.post('/auth/signup', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(201).json({ user: data.user });
});

// POST /auth/login
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return res.status(401).json({ error: 'Invalid login credentials' });
  }

  return res.status(200).json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: data.user
  });
});
// Swagger docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

// POST /auth/logout
app.post('/auth/logout', requireAuth, async (req, res) => {
  const { error } = await supabase.auth.signOut(req.token);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(204).send();
});

app.listen(PORT, () => {
  console.log('Server running and connected to Supabase');
});