import rateLimit from 'express-rate-limit';

/**
 * Global rate limiter: 100 requests per 15-minute window per IP.
 * Applied to all routes to prevent abuse and DoS attacks.
 */
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
});

/**
 * Auth-specific rate limiter: 10 requests per 15-minute window per IP.
 * Applied only to /api/auth routes to prevent brute-force attacks
 * on login and registration endpoints.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later',
  },
});
