/**
 * Structured logging with Winston.
 *
 * - Development: colorized, human-readable console output.
 * - Production:  JSON-formatted logs to files (rotatable by ops tooling).
 *
 * Usage:
 *   const logger = require('./config/logger');
 *   logger.info('Server started', { port: 5000 });
 *   logger.error('Something broke', { error: err.message });
 */

const { createLogger, format, transports } = require('winston');
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';

const logger = createLogger({
  level: isProd ? 'info' : 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    isProd
      ? format.json()
      : format.combine(
          format.colorize(),
          format.printf(({ timestamp, level, message, stack, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} [${level}]: ${stack || message}${metaStr}`;
          })
        )
  ),
  transports: [
    new transports.Console(),
    // File transports — only enabled in production to avoid cluttering dev
    ...(isProd
      ? [
          new transports.File({
            filename: path.join(__dirname, '../logs/error.log'),
            level: 'error',
            maxsize: 5 * 1024 * 1024, // 5 MB
            maxFiles: 5,
          }),
          new transports.File({
            filename: path.join(__dirname, '../logs/combined.log'),
            maxsize: 5 * 1024 * 1024,
            maxFiles: 5,
          }),
        ]
      : []),
  ],
});

module.exports = logger;
