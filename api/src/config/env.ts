import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Weak secrets that used to be silently accepted as fallbacks. Refusing them
 * outright is the point: a missing JWT_SECRET meant anyone could mint tokens.
 */
const FORBIDDEN_SECRETS = new Set(['secret', 'changeme', 'password', '']);

function requireSecret(): string {
  const value = (process.env.JWT_SECRET || '').trim();

  if (FORBIDDEN_SECRETS.has(value) || value.length < 32) {
    console.error(
      '❌ JWT_SECRET is missing, too short (<32 chars) or a known-weak value.\n' +
        '   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    );
    process.exit(1);
  }

  return value;
}

function parseOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (raw) return raw.split(',').map((o) => o.trim()).filter(Boolean);
  if (isProduction) return [];
  return ['http://localhost:4200', 'http://localhost:4201'];
}

export const env = {
  isProduction,
  isTest,
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: requireSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigins: parseOrigins(),
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'invoice_generator',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
  },
} as const;
