function errorHandler(err, req, res, next) {
  // Don't forward status codes from external APIs (axios errors have err.response)
  const status = err.response ? 500 : (err.status || 500);
  const message = err.response
    ? `External API error: ${err.message}`
    : (err.message || 'Internal server error');
  res.status(status).json({ message });
}

module.exports = { errorHandler };
