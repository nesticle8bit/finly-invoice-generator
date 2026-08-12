import { Router } from 'express';
import {
  listInvoices,
  getInvoice,
  getNextNumber,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  downloadPDF,
  getInvoiceHTML,
  getDashboardStats,
  duplicateInvoice,
  getMonthlyStats,
} from '../controllers/invoices.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateBody, validateParams } from '../middleware/validate.middleware';
import { createInvoiceSchema, idParamSchema, updateInvoiceSchema } from '../validation/schemas';

const router = Router();

router.use(authMiddleware);

router.get('/stats', getDashboardStats);
router.get('/monthly-stats', getMonthlyStats);
router.get('/next-number', getNextNumber);
router.get('/', listInvoices);
router.get('/:id', validateParams(idParamSchema), getInvoice);
router.get('/:id/pdf', validateParams(idParamSchema), downloadPDF);
router.get('/:id/html', validateParams(idParamSchema), getInvoiceHTML);
router.post('/', validateBody(createInvoiceSchema), createInvoice);
router.post('/:id/duplicate', validateParams(idParamSchema), duplicateInvoice);
router.put('/:id', validateParams(idParamSchema), validateBody(updateInvoiceSchema), updateInvoice);
router.delete('/:id', validateParams(idParamSchema), deleteInvoice);

export default router;
