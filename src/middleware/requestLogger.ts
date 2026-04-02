import morgan from 'morgan';

/**
 * HTTP request logger middleware.
 * Uses 'dev' format in development (concise, colored output)
 * and 'combined' format in production (Apache-style access logs).
 */
export const requestLogger = morgan(
  process.env.NODE_ENV === 'production' ? 'combined' : 'dev',
);
