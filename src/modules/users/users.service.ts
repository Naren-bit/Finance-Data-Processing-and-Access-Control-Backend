import prisma from '../../config/database';
import { ApiError } from '../../utils/ApiError';
import { Role } from '../../types/roles';
import { toSafeUser } from '../auth/auth.service';
import { getPaginationMeta, PaginationMeta } from '../../utils/pagination';

/**
 * Retrieves a paginated list of all users.
 * Never includes passwordHash in the response.
 * @param page - Page number (1-indexed)
 * @param limit - Number of records per page
 * @returns Object with users array and pagination metadata
 */
export async function getAllUsers(
  page: number,
  limit: number,
): Promise<{ users: ReturnType<typeof toSafeUser>[]; pagination: PaginationMeta }> {
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count(),
  ]);

  return {
    users: users.map(toSafeUser),
    pagination: getPaginationMeta(total, page, limit),
  };
}

/**
 * Retrieves a single user by ID.
 * @param id - User ID
 * @throws ApiError 404 if user not found
 * @returns Safe user object (no passwordHash)
 */
export async function getUserById(id: string): Promise<ReturnType<typeof toSafeUser>> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  return toSafeUser(user);
}

/**
 * Updates a user's role.
 * Self-protection: admins cannot change their own role.
 * @param targetUserId - ID of the user to update
 * @param requesterId - ID of the admin making the request
 * @param newRole - New role to assign
 * @throws ApiError 403 if admin tries to modify their own role
 * @throws ApiError 404 if target user not found
 * @returns Updated safe user object
 */
export async function updateUserRole(
  targetUserId: string,
  requesterId: string,
  newRole: Role,
): Promise<ReturnType<typeof toSafeUser>> {
  if (targetUserId === requesterId) {
    throw new ApiError(403, 'Cannot modify your own account');
  }

  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { role: newRole },
  });

  return toSafeUser(updated);
}

/**
 * Updates a user's active status.
 * Self-protection: admins cannot deactivate themselves.
 * @param targetUserId - ID of the user to update
 * @param requesterId - ID of the admin making the request
 * @param isActive - New active status
 * @throws ApiError 403 if admin tries to deactivate themselves
 * @throws ApiError 404 if target user not found
 * @returns Updated safe user object
 */
export async function updateUserStatus(
  targetUserId: string,
  requesterId: string,
  isActive: boolean,
): Promise<ReturnType<typeof toSafeUser>> {
  if (targetUserId === requesterId) {
    throw new ApiError(403, 'Cannot modify your own account');
  }

  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { isActive },
  });

  return toSafeUser(updated);
}

/**
 * Soft-disables a user by setting isActive to false.
 * Does not hard-delete to preserve data integrity and audit trails.
 * Self-protection: admins cannot delete themselves.
 * @param targetUserId - ID of the user to deactivate
 * @param requesterId - ID of the admin making the request
 * @throws ApiError 403 if admin tries to delete themselves
 * @throws ApiError 404 if target user not found
 */
export async function deleteUser(
  targetUserId: string,
  requesterId: string,
): Promise<void> {
  if (targetUserId === requesterId) {
    throw new ApiError(403, 'Cannot modify your own account');
  }

  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  await prisma.user.update({
    where: { id: targetUserId },
    data: { isActive: false },
  });
}
