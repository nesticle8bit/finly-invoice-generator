import { Router } from 'express';
import {
  listInvoices,
  getInvoice,
  getNextNumber,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  downloadPDF,
  getDashboardStats,
} from '../controllers/invoices.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/stats', getDashboardStats);
router.get('/next-number', getNextNumber);
router.get('/', listInvoices);
router.get('/:id', getInvoice);
router.get('/:id/pdf', downloadPDF);
router.post('/', createInvoice);
router.put('/:id', updateInvoice);
router.delete('/:id', deleteInvoice);

export default router;
