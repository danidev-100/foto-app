export function errorMiddleware(err, req, res, _next) {
  console.error('[ERROR]', err);

  // En producción no exponer detalles internos
  const isDev = process.env.NODE_ENV !== 'production';
  const status = err.status || 500;

  res.status(status).json({
    success: false,
    error: {
      code: err.code || 'INF_001',
      message: status === 500 && !isDev ? 'internal server error' : (err.message || 'internal server error'),
      ...(isDev && err.stack ? { stack: err.stack.split('\n').slice(0, 4).join('\n') } : {}),
    },
  });
}
