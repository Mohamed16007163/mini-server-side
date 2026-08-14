const supabase = require('../config/supabaseClient');

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] === '') {
    return res.status(401).json({ error: 'Access token required' });
  }

  const token = authHeader.split(' ')[1];

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Attach the verified user and token to the request so downstream
  // route handlers can use them without re-verifying.
  req.user = data.user;
  req.token = token;

  next();
}

module.exports = requireAuth;