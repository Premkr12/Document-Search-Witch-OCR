/**
 * Centralized environment variable validation.
 *
 * In production (NODE_ENV=production) the app will crash immediately if any
 * critical variable is missing — this is intentional to prevent insecure
 * deployments.
 *
 * In development it falls back to safe defaults and logs warnings.
 */

const isProd = process.env.NODE_ENV === 'production';

function requireEnv(name, devDefault) {
  const value = process.env[name];
  if (value) return value;

  if (isProd) {
    throw new Error(
      `FATAL: Required environment variable "${name}" is not set. ` +
      `The application cannot start in production without it.`
    );
  }

  // Development fallback
  console.warn(
    `⚠️  WARNING: "${name}" is not set. Using development default. ` +
    `Do NOT use defaults in production.`
  );
  return devDefault;
}

const config = {
  PORT: process.env.PORT || 5000,
  MONGO_URI: requireEnv('MONGO_URI', 'mongodb://localhost:27017/text-scan-insight'),
  JWT_SECRET: requireEnv('JWT_SECRET', 'dev_jwt_secret_DO_NOT_USE_IN_PROD'),
  JWT_REFRESH_SECRET: requireEnv('JWT_REFRESH_SECRET', 'dev_refresh_secret_DO_NOT_USE_IN_PROD'),
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  NODE_ENV: process.env.NODE_ENV || 'development',
  OCR_ENGINE: process.env.OCR_ENGINE || 'easyocr',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@yourdomain.com',
};

module.exports = config;
