import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';
import { logger } from '../config/logger';

const uploadsDir = env.uploadDir;

/**
 * Creating the directory is not enough: a Docker named volume keeps whatever
 * ownership it was created with, so the dirs can exist and still be unwritable
 * by the runtime user. That used to fail at write time as an opaque 500.
 */
function ensureWritable(fullPath: string): void {
  fs.mkdirSync(fullPath, { recursive: true });
  fs.accessSync(fullPath, fs.constants.W_OK | fs.constants.X_OK);
}

['logos', 'signatures'].forEach((dir) => {
  const fullPath = path.join(uploadsDir, dir);
  try {
    ensureWritable(fullPath);
  } catch (err) {
    logger.error(
      `Uploads directory ${fullPath} is missing or not writable by uid ${process.getuid?.() ?? 'n/a'}. ` +
        'On Docker fix with: docker compose run --rm --user root api chown -R node:node /app/uploads',
      err
    );
  }
});

/**
 * SVG is deliberately excluded: uploads are served from the same origin, and an
 * SVG can carry inline <script>, turning any upload into stored XSS.
 */
const ALLOWED_TYPES: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
};

const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    const fieldDir = file.fieldname === 'logo' ? 'logos' : 'signatures';
    const fullPath = path.join(uploadsDir, fieldDir);
    try {
      // Re-check per request: the volume may have been (re)mounted since boot.
      ensureWritable(fullPath);
      cb(null, fullPath);
    } catch (err) {
      cb(err as Error, fullPath);
    }
  },
  filename: (_req, file, cb) => {
    // Derive the extension from the declared mimetype, never from the client
    // filename — that string is attacker-controlled.
    const ext = ALLOWED_TYPES[file.mimetype]?.[0] ?? '.bin';
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedExts = ALLOWED_TYPES[file.mimetype];
  if (!allowedExts) {
    cb(new Error('Only JPEG, PNG, GIF and WebP images are allowed'));
    return;
  }

  // Mimetype and extension must agree; a mismatch is a spoofing attempt.
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext && !allowedExts.includes(ext)) {
    cb(new Error('File extension does not match its content type'));
    return;
  }

  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.maxFileSize, files: 1 },
});
