import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { registerSchema, loginSchema, refreshTokenSchema } from '../../validators/auth.validator';
import * as authService from './auth.service';

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user account
 *     description: Creates a new user with VIEWER role. Returns access and refresh tokens.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: SecurePass1
 *     responses:
 *       201:
 *         description: User registered successfully
 *       409:
 *         description: Email already registered
 *       422:
 *         description: Validation failed
 */
export const registerHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    throw Object.assign(new Error('Validation failed'), {
      name: 'ZodError',
      errors: result.error.errors,
    });
  }

  const { email, password } = result.data;
  const data = await authService.register(email, password);

  ApiResponse.success(res, 201, 'User registered successfully', data);
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
 *     description: Authenticates a user and returns access and refresh tokens.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@zorvyn.com
 *               password:
 *                 type: string
 *                 example: Admin123!
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials or account deactivated
 *       422:
 *         description: Validation failed
 */
export const loginHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    throw Object.assign(new Error('Validation failed'), {
      name: 'ZodError',
      errors: result.error.errors,
    });
  }

  const { email, password } = result.data;
  const data = await authService.login(email, password);

  ApiResponse.success(res, 200, 'Login successful', data);
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 *     description: Uses a valid refresh token to get new access and refresh tokens. Implements token rotation.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tokens refreshed successfully
 *       401:
 *         description: Invalid or expired refresh token
 */
export const refreshHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = refreshTokenSchema.safeParse(req.body);
  if (!result.success) {
    throw Object.assign(new Error('Validation failed'), {
      name: 'ZodError',
      errors: result.error.errors,
    });
  }

  const data = await authService.refreshAccessToken(result.data.refreshToken);

  ApiResponse.success(res, 200, 'Tokens refreshed successfully', data);
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout and invalidate refresh token
 *     description: Deletes the refresh token from the database. Idempotent — succeeds even if the token doesn't exist.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
export const logoutHandler = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await authService.logout(refreshToken);
  }

  ApiResponse.success(res, 200, 'Logged out successfully');
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user profile
 *     description: Returns the authenticated user's profile information.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved
 *       401:
 *         description: Not authenticated
 */
export const getMeHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Not authenticated');
  }

  const user = await authService.getMe(req.user.id);

  ApiResponse.success(res, 200, 'User profile retrieved', user);
});
