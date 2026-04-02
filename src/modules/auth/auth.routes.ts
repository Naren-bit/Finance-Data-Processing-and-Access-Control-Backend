import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { authRateLimiter } from '../../middleware/rateLimiter';
import {
  registerHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
  getMeHandler,
} from './auth.controller';

const router = Router();

// Apply auth-specific rate limiter to all auth routes
router.use(authRateLimiter);

router.post('/register', registerHandler);
router.post('/login', loginHandler);
router.post('/refresh', refreshHandler);
router.post('/logout', logoutHandler);
router.get('/me', authenticate, getMeHandler);

export default router;
