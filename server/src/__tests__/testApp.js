/**
 * Creates an Express app for use in Supertest tests.
 * Mirrors src/index.js but does not start the HTTP server.
 */
const express = require('express');
const { protect, requireAdmin, requireWrite } = require('../middleware/auth');

const app = express();
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth',         require('../routes/auth'));
app.use('/api/students',     require('../routes/students'));
app.use('/api/students',     require('../routes/interactions'));
app.use('/api/students',     require('../routes/outcomes'));
app.use('/api/students',     require('../routes/progress'));
app.use('/api/users',        require('../routes/users'));
app.use('/api/followups',    require('../routes/followups'));
app.use('/api/email-templates', require('../routes/emailTemplates'));
app.use('/api/database',     require('../routes/database'));

const { errorHandler } = require('../middleware/errorHandler');
app.use(errorHandler);

module.exports = app;
