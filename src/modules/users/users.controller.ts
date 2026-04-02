import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { updateRoleSchema, updateStatusSchema } from '../../validators/user.validator';
import * as usersService from './users.service';

/**
 * @swagger
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: List all users (Admin only)
 *     description: Returns a paginated list of users. passwordHash is never included.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 */
export const getAllUsersHandler = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 10, 100);

  const { users, pagination } = await usersService.getAllUsers(page, limit);

  ApiResponse.paginated(res, 'Users retrieved successfully', users, pagination);
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get a single user (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *       404:
 *         description: User not found
 */
export const getUserByIdHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = await usersService.getUserById(req.params.id as string);
  ApiResponse.success(res, 200, 'User retrieved successfully', user);
});

/**
 * @swagger
 * /api/users/{id}/role:
 *   patch:
 *     tags: [Users]
 *     summary: Update user role (Admin only)
 *     description: Admin cannot change their own role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [VIEWER, ANALYST, ADMIN]
 *     responses:
 *       200:
 *         description: User role updated
 *       403:
 *         description: Cannot modify your own account
 *       404:
 *         description: User not found
 *       422:
 *         description: Validation failed
 */
export const updateUserRoleHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Not authenticated');

  const result = updateRoleSchema.safeParse(req.body);
  if (!result.success) {
    throw Object.assign(new Error('Validation failed'), {
      name: 'ZodError',
      errors: result.error.errors,
    });
  }

  const user = await usersService.updateUserRole(
    req.params.id as string,
    req.user.id,
    result.data.role,
  );

  ApiResponse.success(res, 200, 'User role updated successfully', user);
});

/**
 * @swagger
 * /api/users/{id}/status:
 *   patch:
 *     tags: [Users]
 *     summary: Toggle user active status (Admin only)
 *     description: Admin cannot deactivate themselves.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isActive]
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User status updated
 *       403:
 *         description: Cannot modify your own account
 *       404:
 *         description: User not found
 */
export const updateUserStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Not authenticated');

  const result = updateStatusSchema.safeParse(req.body);
  if (!result.success) {
    throw Object.assign(new Error('Validation failed'), {
      name: 'ZodError',
      errors: result.error.errors,
    });
  }

  const user = await usersService.updateUserStatus(
    req.params.id as string,
    req.user.id,
    result.data.isActive,
  );

  ApiResponse.success(res, 200, 'User status updated successfully', user);
});

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Soft-disable a user (Admin only)
 *     description: Sets isActive=false. Does not hard-delete. Cannot delete self.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deactivated
 *       403:
 *         description: Cannot modify your own account
 *       404:
 *         description: User not found
 */
export const deleteUserHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Not authenticated');

  await usersService.deleteUser(req.params.id as string, req.user.id);

  ApiResponse.success(res, 200, 'User deactivated successfully');
});
