const supabase = require('../config/supabase');
const { isAuthRetryableFetchError } = require('@supabase/supabase-js');

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

    if (error && (isAuthRetryableFetchError(error) || error.status === 429 || error.status >= 500)) {
      return res.status(503).json({
        status: 'error',
        code: 'auth_unavailable',
        message: 'Could not reach the sign-in service. Try again in a moment.'
      });
    }

    if (error || !user) {
      return res.status(401).json({
        status: 'error',
        code: 'invalid_access_token',
        message: 'Invalid or expired token.'
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
