import { Router } from 'express';
import {
  createShareLink,
  revokeShareLink,
  getShareInfo,
  accessSharedInvoice,
  updateSharedWP,
} from '../controllers/share.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { validateBody, validateParams } from '../middleware/validate.middleware';
import {
  accessShareSchema,
  createShareSchema,
  idParamSchema,
  updateSharedWPSchema,
} from '../validation/schemas';

const router = Router();

// Password endpoint is a brute-force oracle — throttle hard, per IP + token.
const accessLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyBuilder: (req) => `${req.ip}:${req.params.token}`,
  message: 'Too many password attempts. Please try again in a few minutes.',
});

// Autosave is chatty by design; this only catches runaway clients.
const updateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyBuilder: (req) => `${req.ip}:${req.params.token}`,
});

// Protected (owner only) — manage share links
router.post(
  '/invoices/:id/share',
  authMiddleware,
  validateParams(idParamSchema),
  validateBody(createShareSchema),
  createShareLink
);
router.delete('/invoices/:id/share', authMiddleware, validateParams(idParamSchema), revokeShareLink);
router.get('/invoices/:id/share', authMiddleware, validateParams(idParamSchema), getShareInfo);

// Public (no auth) — collaborator access
router.post('/public/share/:token', accessLimiter, validateBody(accessShareSchema), accessSharedInvoice);
router.put('/public/share/:token/wp', updateLimiter, validateBody(updateSharedWPSchema), updateSharedWP);

export default router;
