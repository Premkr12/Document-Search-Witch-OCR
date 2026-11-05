require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const config = require('./config/validateEnv');
const logger = require('./config/logger');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ── Global Exception and Rejection Handling ─────────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason: reason?.message || reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception thrown:', { error: error.message, stack: error.stack });
  // In production, you might want to restart the process gracefully
});

// ── Security Headers ─────────────────────────────────────────────────────────
// Files are fetched by the client with its auth token and shown from blob: URLs,
// so the API never needs to be framed or embedded cross-origin.
app.use(helmet());

// ── CORS — Restricted to configured origin ───────────────────────────────────
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true,
}));

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json());

// ── Rate Limiting ────────────────────────────────────────────────────────────
// General API limiter. The client polls every few seconds while documents are
// being read, so this needs headroom above ~450 requests per window.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});
app.use('/api', apiLimiter);

// Stricter limiter for auth endpoints (prevents brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts, please try again later.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth/change-password', authLimiter);

// Upload limiter
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Upload limit reached, please try again later.' },
});
app.use('/api/documents/upload', uploadLimiter);

// ── Uploads directory ────────────────────────────────────────────────────────
// Files are NOT served statically — GET /api/documents/:id/file checks ownership.
// TODO: Migrate to cloud storage (AWS S3 / Cloudinary) for production.
// Local disk storage is ephemeral on most cloud platforms.
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ── Routes ───────────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');

app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// ── Global Error Handler (MUST be last middleware) ───────────────────────────
app.use(errorHandler);

// ── Connect to MongoDB and start server ──────────────────────────────────────
mongoose.connect(config.MONGO_URI)
  .then(() => {
    logger.info('Connected to MongoDB');
    app.listen(config.PORT, () => {
      logger.info(`Server is running on port ${config.PORT}`);
      logger.info(`CORS origin: ${config.CORS_ORIGIN}`);
      logger.info(`Environment: ${config.NODE_ENV}`);
      logger.info(`OCR engine: ${config.OCR_ENGINE}`);
    });
    require('./services/ocr').resumeInterrupted()
      .catch((err) => logger.error('Could not resume interrupted documents', { error: err.message }));
  })
  .catch(err => {
    logger.error('Failed to connect to MongoDB', { error: err.message });
    process.exit(1);
  });
