import { Router } from 'express';
import { getProfile, updateProfile, uploadLogo, uploadSignature } from '../controllers/profile.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getProfile);
router.put('/', updateProfile);
router.post('/logo', upload.single('logo'), uploadLogo);
router.post('/signature', upload.single('signature'), uploadSignature);

export default router;
