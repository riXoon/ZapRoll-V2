const errorMiddleware = (err, req, res, next) => {
  console.error(err.stack ?? { code: err.code, message: err.message });

  const statusCode = err.statusCode || (/^PT[45][0-9]{2}$/.test(err.code) ? Number(err.code.slice(2)) : 500);
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorMiddleware;
