import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { Role } from '../../types/roles';
import {
  getTransactionsHandler,
  createTransactionHandler,
  getTransactionByIdHandler,
  updateTransactionHandler,
  deleteTransactionHandler,
} from './transactions.controller';

const router = Router();

// All transaction routes require authentication
router.use(authenticate);

// GET: VIEWER, ANALYST, ADMIN
router.get('/', requireRole(Role.VIEWER, Role.ANALYST, Role.ADMIN), getTransactionsHandler);

// POST: ANALYST, ADMIN only
router.post('/', requireRole(Role.ANALYST, Role.ADMIN), createTransactionHandler);

// GET by ID: VIEWER (own only — checked in service), ANALYST, ADMIN
router.get('/:id', requireRole(Role.VIEWER, Role.ANALYST, Role.ADMIN), getTransactionByIdHandler);

// PUT: ANALYST (own only — checked in service), ADMIN
router.put('/:id', requireRole(Role.ANALYST, Role.ADMIN), updateTransactionHandler);

// DELETE: ADMIN only (soft delete)
router.delete('/:id', requireRole(Role.ADMIN), deleteTransactionHandler);

export default router;
