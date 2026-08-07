import { Router } from 'express';
import { listClients, getClient, createClient, updateClient, deleteClient } from '../controllers/clients.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateBody, validateParams } from '../middleware/validate.middleware';
import { createClientSchema, idParamSchema, updateClientSchema } from '../validation/schemas';

const router = Router();

router.use(authMiddleware);

router.get('/', listClients);
router.get('/:id', validateParams(idParamSchema), getClient);
router.post('/', validateBody(createClientSchema), createClient);
router.put('/:id', validateParams(idParamSchema), validateBody(updateClientSchema), updateClient);
router.delete('/:id', validateParams(idParamSchema), deleteClient);

export default router;
