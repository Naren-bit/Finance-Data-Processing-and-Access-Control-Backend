import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { globalRateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { ApiError } from './utils/ApiError';

import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import transactionsRoutes from './modules/transactions/transactions.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';

const app = express();

// ─── Swagger / OpenAPI Documentation ────────────────────────────────────────
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Zorvyn Finance Dashboard API',
      version: '1.0.0',
      description:
        'A comprehensive finance dashboard backend API with authentication, RBAC, transaction management, and analytics.',
      contact: {
        name: 'Zorvyn Engineering',
        email: 'dev@zorvyn.com',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT access token',
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Users', description: 'User management (Admin only)' },
      { name: 'Transactions', description: 'Transaction CRUD operations' },
      { name: 'Dashboard', description: 'Analytics and dashboard endpoints' },
    ],
  },
  apis: [
    './src/modules/**/*.controller.ts',
    './src/modules/**/*.routes.ts',
  ],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Serve Swagger UI — available in all environments for evaluation convenience
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Zorvyn Finance Dashboard API Docs',
}));

// Serve raw swagger spec as JSON
app.get('/api-docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ─── Middleware (order matters) ─────────────────────────────────────────────

// 1. Security headers
app.use(helmet());

// 2. CORS configuration
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
}));

// 3. HTTP request logger
app.use(requestLogger);

// 4. JSON body parser with size limit
app.use(express.json({ limit: '10kb' }));

// 5. Global rate limiter
app.use(globalRateLimiter);

// ─── Routes ─────────────────────────────────────────────────────────────────

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Zorvyn Finance Dashboard API is running',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ─── 404 handler for unmatched routes ───────────────────────────────────────
app.use((_req, _res, next) => {
  next(new ApiError(404, 'Route not found'));
});

// ─── Global error handler (must be last, 4 args) ───────────────────────────
app.use(errorHandler);

export default app;
