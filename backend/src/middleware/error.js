export function errorMiddleware(err, req, res, _next) {
  console.error('[ERROR]', err);
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INF_001',
      message: err.message || 'internal server error',
    },
  });
}
