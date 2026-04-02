import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { Role } from '../../types/roles';
import {
  getSummaryHandler,
  getByCategoryHandler,
  getTrendsHandler,
  getRecentHandler,
  getTopCategoriesHandler,
} from './dashboard.controller';

const router = Router();

// All dashboard routes require authentication and at least VIEWER role
router.use(authenticate, requireRole(Role.VIEWER, Role.ANALYST, Role.ADMIN));

router.get('/summary', getSummaryHandler);
router.get('/by-category', getByCategoryHandler);
router.get('/trends', getTrendsHandler);
router.get('/recent', getRecentHandler);
router.get('/top-categories', getTopCategoriesHandler);

export default router;
