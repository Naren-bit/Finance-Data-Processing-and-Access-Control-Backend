import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import {
  createTransactionSchema,
  updateTransactionSchema,
  transactionQuerySchema,
} from '../../validators/transaction.validator';
import * as transactionsService from './transactions.service';
import { Role } from '../../types/roles';

/**
 * @swagger
 * /api/transactions:
 *   get:
 *     tags: [Transactions]
 *     summary: List transactions with filtering and pagination
 *     description: |
 *       VIEWER sees only own transactions.
 *       ANALYST and ADMIN see all transactions.
 *       Soft-deleted records are always excluded.
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
 *           maximum: 100
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [INCOME, EXPENSE]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [SALARY, FREELANCE, INVESTMENT, FOOD, RENT, UTILITIES, TRANSPORT, HEALTHCARE, ENTERTAINMENT, OTHER]
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [date, amount, createdAt]
 *           default: date
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully
 *       401:
 *         description: Not authenticated
 *       422:
 *         description: Validation failed
 */
export const getTransactionsHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Not authenticated');

  const result = transactionQuerySchema.safeParse(req.query);
  if (!result.success) {
    throw Object.assign(new Error('Validation failed'), {
      name: 'ZodError',
      errors: result.error.errors,
    });
  }

  const { transactions, pagination } = await transactionsService.getTransactions(
    result.data,
    req.user.id,
    req.user.role as Role,
  );

  ApiResponse.paginated(res, 'Transactions retrieved successfully', transactions, pagination);
});

/**
 * @swagger
 * /api/transactions:
 *   post:
 *     tags: [Transactions]
 *     summary: Create a new transaction
 *     description: Only ANALYST and ADMIN can create transactions. userId is always set from the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, type, category, date]
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 50000
 *               type:
 *                 type: string
 *                 enum: [INCOME, EXPENSE]
 *               category:
 *                 type: string
 *                 enum: [SALARY, FREELANCE, INVESTMENT, FOOD, RENT, UTILITIES, TRANSPORT, HEALTHCARE, ENTERTAINMENT, OTHER]
 *               date:
 *                 type: string
 *                 format: date-time
 *               description:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Transaction created successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       422:
 *         description: Validation failed
 */
export const createTransactionHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Not authenticated');

  const result = createTransactionSchema.safeParse(req.body);
  if (!result.success) {
    throw Object.assign(new Error('Validation failed'), {
      name: 'ZodError',
      errors: result.error.errors,
    });
  }

  // Always set userId from authenticated user — never trust client-provided userId
  const transaction = await transactionsService.createTransaction(result.data, req.user.id);

  ApiResponse.success(res, 201, 'Transaction created successfully', transaction);
});

/**
 * @swagger
 * /api/transactions/{id}:
 *   get:
 *     tags: [Transactions]
 *     summary: Get a single transaction
 *     description: VIEWER can only access own transactions. ANALYST and ADMIN can access any.
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
 *         description: Transaction retrieved
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Transaction not found
 */
export const getTransactionByIdHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Not authenticated');

  const transaction = await transactionsService.getTransactionById(
    req.params.id as string,
    req.user.id,
    req.user.role as Role,
  );

  ApiResponse.success(res, 200, 'Transaction retrieved successfully', transaction);
});

/**
 * @swagger
 * /api/transactions/{id}:
 *   put:
 *     tags: [Transactions]
 *     summary: Update a transaction
 *     description: ANALYST can update own records only. ADMIN can update any record.
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
 *             properties:
 *               amount:
 *                 type: number
 *               type:
 *                 type: string
 *                 enum: [INCOME, EXPENSE]
 *               category:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date-time
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Transaction updated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Transaction not found
 *       422:
 *         description: Validation failed
 */
export const updateTransactionHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Not authenticated');

  const result = updateTransactionSchema.safeParse(req.body);
  if (!result.success) {
    throw Object.assign(new Error('Validation failed'), {
      name: 'ZodError',
      errors: result.error.errors,
    });
  }

  const transaction = await transactionsService.updateTransaction(
    req.params.id as string,
    result.data,
    req.user.id,
    req.user.role as Role,
  );

  ApiResponse.success(res, 200, 'Transaction updated successfully', transaction);
});

/**
 * @swagger
 * /api/transactions/{id}:
 *   delete:
 *     tags: [Transactions]
 *     summary: Soft-delete a transaction (Admin only)
 *     description: Sets deletedAt timestamp. Does not permanently remove the record.
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
 *         description: Transaction deleted
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Transaction not found
 */
export const deleteTransactionHandler = asyncHandler(async (req: Request, res: Response) => {
  await transactionsService.deleteTransaction(req.params.id as string);

  ApiResponse.success(res, 200, 'Transaction deleted');
});
