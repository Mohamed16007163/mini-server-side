require('dotenv').config();
const express = require('express');
const supabase = require('./config/supabaseClient');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;
// GET /protected/profile
app.get('/protected/profile', (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] === '') {
    return res.status(401).json({ error: 'Access token required' });
  }

  const token = authHeader.split(' ')[1];

  // Stage 3 will actually verify this token with Supabase.
  // For now, just confirm we successfully extracted it.
  return res.status(200).json({ message: 'Token received (not yet verified)', token });
});

app.listen(PORT, () => {
  console.log('Server running and connected to Supabase');
  // GET /public/info
app.get('/public/info', (req, res) => {
  return res.status(200).json({ message: 'Welcome stranger! This info is public.' });
});

}); 