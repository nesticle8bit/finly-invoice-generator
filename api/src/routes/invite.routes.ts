import { Router } from 'express';
import { listCodes, createCode, deleteCode } from '../controllers/invite.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateParams } from '../middleware/validate.middleware';
import { idParamSchema } from '../validation/schemas';

const router = Router();

router.get('/', authMiddleware, listCodes);
router.post('/', authMiddleware, createCode);
router.delete('/:id', authMiddleware, validateParams(idParamSchema), deleteCode);

export default router;
