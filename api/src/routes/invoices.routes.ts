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
  duplicateInvoice,
  getMonthlyStats,
} from '../controllers/invoices.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/stats', getDashboardStats);
router.get('/monthly-stats', getMonthlyStats);
router.get('/next-number', getNextNumber);
router.get('/', listInvoices);
router.get('/:id', getInvoice);
router.get('/:id/pdf', downloadPDF);
router.post('/', createInvoice);
router.post('/:id/duplicate', duplicateInvoice);
router.put('/:id', updateInvoice);
router.delete('/:id', deleteInvoice);

export default router;
