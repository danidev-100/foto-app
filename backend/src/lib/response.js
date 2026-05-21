export function successJSON(res, status, data) {
  return res.status(status).json({ success: true, data });
}

export function errorJSON(res, status, code, message, details = null) {
  return res.status(status).json({
    success: false,
    error: { code, message, details },
  });
}

export function paginatedJSON(res, data, page, limit, total) {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return res.json({
    success: true,
    data,
    pagination: { page, limit, total, total_pages: totalPages },
  });
}

export function healthResponse(res) {
  return res.json({
    success: true,
    data: { status: 'ok', timestamp: new Date().toISOString() },
  });
}
