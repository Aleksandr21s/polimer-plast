import { Router } from 'express';
import authRoutes from './auth.routes.js';
import catalogRoutes from './catalog.routes.js';
import priceRoutes from './price.routes.js';
import orderRoutes from './order.routes.js';
import sampleRoutes from './sample.routes.js';
import companyRoutes from './company.routes.js';
import chatRoutes from './chat.routes.js';
import complaintRoutes from './complaint.routes.js';

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

router.use('/auth', authRoutes);
router.use('/catalog', catalogRoutes);
router.use('/prices', priceRoutes);
router.use('/orders', orderRoutes);
router.use('/samples', sampleRoutes);
router.use('/company', companyRoutes);
router.use('/chat', chatRoutes);
router.use('/complaints', complaintRoutes);

export default router;
