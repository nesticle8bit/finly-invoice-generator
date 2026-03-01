import { Router } from 'express';
import { listCodes, createCode, deleteCode } from '../controllers/invite.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authMiddleware, listCodes);
router.post('/', authMiddleware, createCode);
router.delete('/:id', authMiddleware, deleteCode);

export default router;
