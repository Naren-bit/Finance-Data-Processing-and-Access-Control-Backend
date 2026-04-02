import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { ApiError } from '../../utils/ApiError';
import { getPaginationMeta, PaginationMeta } from '../../utils/pagination';
import { Role } from '../../types/roles';
import { CreateTransactionInput, UpdateTransactionInput, TransactionQueryInput } from '../../validators/transaction.validator';

/**
 * Creates a new transaction.
 * Always sets userId from the authenticated user — never trusts client-provided userId.
 * @param data - Validated transaction data
 * @param userId - Authenticated user's ID (from JWT, not from request body)
 * @returns Created transaction record
 */
export async function createTransaction(
  data: CreateTransactionInput,
  userId: string,
): Promise<Record<string, unknown>> {
  const transaction = await prisma.transaction.create({
    data: {
      userId,
      amount: new Prisma.Decimal(data.amount),
      type: data.type,
      category: data.category,
      date: new Date(data.date),
      description: data.description || null,
    },
  });

  return {
    ...transaction,
    amount: transaction.amount.toNumber(),
  };
}

/**
 * Retrieves a paginated, filtered, and sorted list of transactions.
 * Role-based scoping:
 *   VIEWER → only own transactions
 *   ANALYST, ADMIN → all transactions
 * Always excludes soft-deleted records (deletedAt IS NULL).
 * @param query - Validated query parameters (filters, pagination, sorting)
 * @param userId - Authenticated user's ID
 * @param userRole - Authenticated user's role
 * @returns Object with transactions array and pagination metadata
 */
export async function getTransactions(
  query: TransactionQueryInput,
  userId: string,
  userRole: Role,
): Promise<{ transactions: Record<string, unknown>[]; pagination: PaginationMeta }> {
  const { page, limit, type, category, dateFrom, dateTo, search, sortBy, sortOrder } = query;
  const skip = (page - 1) * limit;

  // Build the WHERE clause dynamically
  const where: Prisma.TransactionWhereInput = {
    deletedAt: null, // Always exclude soft-deleted records
  };

  // Role-based scoping: VIEWER sees only own records
  if (userRole === Role.VIEWER) {
    where.userId = userId;
  }

  if (type) {
    where.type = type;
  }

  if (category) {
    where.category = category;
  }

  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) {
      where.date.gte = new Date(dateFrom);
    }
    if (dateTo) {
      where.date.lte = new Date(dateTo);
    }
  }

  if (search) {
    where.description = {
      contains: search,
    };
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    transactions: transactions.map((t) => ({
      ...t,
      amount: t.amount.toNumber(),
    })),
    pagination: getPaginationMeta(total, page, limit),
  };
}

/**
 * Retrieves a single transaction by ID.
 * VIEWER can only access their own transactions.
 * Must check deletedAt IS NULL.
 * @param transactionId - Transaction ID to retrieve
 * @param userId - Authenticated user's ID
 * @param userRole - Authenticated user's role
 * @throws ApiError 404 if transaction not found
 * @throws ApiError 403 if VIEWER tries to access another user's transaction
 * @returns Transaction record
 */
export async function getTransactionById(
  transactionId: string,
  userId: string,
  userRole: Role,
): Promise<Record<string, unknown>> {
  const transaction = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      deletedAt: null,
    },
    include: {
      user: {
        select: { id: true, email: true },
      },
    },
  });

  if (!transaction) {
    throw new ApiError(404, 'Transaction not found');
  }

  // VIEWER can only access their own transactions
  if (userRole === Role.VIEWER && transaction.userId !== userId) {
    throw new ApiError(403, 'Insufficient permissions');
  }

  return {
    ...transaction,
    amount: transaction.amount.toNumber(),
  };
}

/**
 * Updates a transaction by ID.
 * ANALYST can update only their own records.
 * ADMIN can update any record.
 * Cannot update userId or deletedAt via this endpoint.
 * @param transactionId - Transaction ID to update
 * @param data - Partial transaction data to update
 * @param userId - Authenticated user's ID
 * @param userRole - Authenticated user's role
 * @throws ApiError 404 if transaction not found
 * @throws ApiError 403 if ANALYST tries to update another user's transaction
 * @returns Updated transaction record
 */
export async function updateTransaction(
  transactionId: string,
  data: UpdateTransactionInput,
  userId: string,
  userRole: Role,
): Promise<Record<string, unknown>> {
  const existing = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      deletedAt: null,
    },
  });

  if (!existing) {
    throw new ApiError(404, 'Transaction not found');
  }

  // ANALYST can only update their own records
  if (userRole === Role.ANALYST && existing.userId !== userId) {
    throw new ApiError(403, 'Insufficient permissions');
  }

  const updateData: Prisma.TransactionUpdateInput = {};

  if (data.amount !== undefined) {
    updateData.amount = new Prisma.Decimal(data.amount);
  }
  if (data.type !== undefined) {
    updateData.type = data.type;
  }
  if (data.category !== undefined) {
    updateData.category = data.category;
  }
  if (data.date !== undefined) {
    updateData.date = new Date(data.date);
  }
  if (data.description !== undefined) {
    updateData.description = data.description;
  }

  const updated = await prisma.transaction.update({
    where: { id: transactionId },
    data: updateData,
    include: {
      user: {
        select: { id: true, email: true },
      },
    },
  });

  return {
    ...updated,
    amount: updated.amount.toNumber(),
  };
}

/**
 * Soft-deletes a transaction by setting deletedAt to the current timestamp.
 * Only ADMIN can delete transactions.
 * @param transactionId - Transaction ID to soft-delete
 * @throws ApiError 404 if transaction not found
 */
export async function deleteTransaction(transactionId: string): Promise<void> {
  const existing = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      deletedAt: null,
    },
  });

  if (!existing) {
    throw new ApiError(404, 'Transaction not found');
  }

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { deletedAt: new Date() },
  });
}
