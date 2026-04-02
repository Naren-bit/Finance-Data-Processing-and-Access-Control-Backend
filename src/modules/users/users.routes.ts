import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { Role } from '../../types/roles';
import {
  getAllUsersHandler,
  getUserByIdHandler,
  updateUserRoleHandler,
  updateUserStatusHandler,
  deleteUserHandler,
} from './users.controller';

const router = Router();

// All user management routes require ADMIN role
router.use(authenticate, requireRole(Role.ADMIN));

router.get('/', getAllUsersHandler);
router.get('/:id', getUserByIdHandler);
router.patch('/:id/role', updateUserRoleHandler);
router.patch('/:id/status', updateUserStatusHandler);
router.delete('/:id', deleteUserHandler);

export default router;
