import { z } from 'zod';
import { TransactionType, Category } from '../types/roles';

/**
 * Zod validation schemas for transaction endpoints.
 * Validates amount precision, date ranges, and enum values
 * to ensure only clean data reaches the database.
 */

export const createTransactionSchema = z.object({
  amount: z
    .number({ required_error: 'Amount is required' })
    .positive('Amount must be positive')
    .multipleOf(0.01, 'Amount can have at most 2 decimal places'),
  type: z.nativeEnum(TransactionType, {
    required_error: 'Transaction type is required',
    invalid_type_error: 'Invalid transaction type',
  }),
  category: z.nativeEnum(Category, {
    required_error: 'Category is required',
    invalid_type_error: 'Invalid category',
  }),
  date: z
    .string({ required_error: 'Date is required' })
    .datetime('Invalid date format — use ISO 8601')
    .refine(
      (d) => new Date(d) <= new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      'Date cannot be more than 1 year in the future',
    ),
  description: z
    .string()
    .max(500, 'Description cannot exceed 500 characters')
    .optional(),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export const transactionQuerySchema = z.object({
  page: z.coerce
    .number()
    .int('Page must be an integer')
    .positive('Page must be positive')
    .default(1),
  limit: z.coerce
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(10),
  type: z.nativeEnum(TransactionType).optional(),
  category: z.nativeEnum(Category).optional(),
  dateFrom: z
    .string()
    .datetime('Invalid dateFrom format — use ISO 8601')
    .optional(),
  dateTo: z
    .string()
    .datetime('Invalid dateTo format — use ISO 8601')
    .optional(),
  search: z
    .string()
    .max(100, 'Search query cannot exceed 100 characters')
    .optional(),
  sortBy: z.enum(['date', 'amount', 'createdAt']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionQueryInput = z.infer<typeof transactionQuerySchema>;
