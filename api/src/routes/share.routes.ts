import { Router } from 'express';
import {
  createShareLink,
  revokeShareLink,
  getShareInfo,
  accessSharedInvoice,
  updateSharedWP,
} from '../controllers/share.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Protected (owner only) — manage share links
router.post('/invoices/:id/share', authMiddleware, createShareLink);
router.delete('/invoices/:id/share', authMiddleware, revokeShareLink);
router.get('/invoices/:id/share', authMiddleware, getShareInfo);

// Public (no auth) — collaborator access
router.post('/public/share/:token', accessSharedInvoice);
router.put('/public/share/:token/wp', updateSharedWP);

export default router;
