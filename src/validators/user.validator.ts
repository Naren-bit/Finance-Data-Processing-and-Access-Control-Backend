import { z } from 'zod';
import { Role } from '../types/roles';

/**
 * Zod validation schemas for user management endpoints.
 * Used exclusively by ADMIN role for modifying other users.
 */

export const updateRoleSchema = z.object({
  role: z.nativeEnum(Role, {
    required_error: 'Role is required',
    invalid_type_error: 'Invalid role. Must be one of: VIEWER, ANALYST, ADMIN',
  }),
});

export const updateStatusSchema = z.object({
  isActive: z.boolean({
    required_error: 'isActive is required',
    invalid_type_error: 'isActive must be a boolean',
  }),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
