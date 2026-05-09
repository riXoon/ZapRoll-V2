const supabase = require('../config/supabase');

/**
 * Middleware to protect routes by verifying the Supabase JWT.
 * Expects 'Authorization: Bearer <token>' header.
 */
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'error',
      message: 'No token provided. Authorization denied.'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify the user with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid or expired token.',
        details: error ? error.message : 'User not found'
      });
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (err) {
    console.error('Auth Middleware Error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error during authentication.'
    });
  }
};

module.exports = authMiddleware;
