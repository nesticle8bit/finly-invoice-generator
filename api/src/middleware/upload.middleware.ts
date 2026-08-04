import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';

const uploadsDir = env.uploadDir;

// Ensure directories exist
['logos', 'signatures'].forEach((dir) => {
  const fullPath = path.join(uploadsDir, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
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
    cb(null, path.join(uploadsDir, fieldDir));
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
