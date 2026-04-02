// Mock Prisma client
jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock environment config
jest.mock('../config/env', () => ({
  env: {
    JWT_ACCESS_SECRET: 'test-access-secret-that-is-at-least-32-chars',
    JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-at-least-32-chars',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    NODE_ENV: 'test',
    PORT: 3000,
    CORS_ORIGIN: '*',
    DATABASE_URL: 'file:./test.db',
  },
}));

import prisma from '../config/database';
import { createTransaction, getTransactions } from '../modules/transactions/transactions.service';
import { Role, TransactionType, Category } from '../types/roles';
import { getPaginationMeta } from '../utils/pagination';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Transactions Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTransaction', () => {
    it('should set userId from service argument, not from request body', async () => {
      const mockTransaction = {
        id: 'tx-1',
        userId: 'user-from-service',
        amount: { toNumber: () => 5000 },
        type: 'INCOME',
        category: 'SALARY',
        date: new Date(),
        description: 'Test',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.transaction.create as jest.Mock).mockResolvedValue(mockTransaction);

      const data = {
        amount: 5000,
        type: TransactionType.INCOME,
        category: Category.SALARY,
        date: new Date().toISOString(),
        description: 'Test',
      };

      await createTransaction(data, 'user-from-service');

      // Verify that the userId passed to Prisma is from the service argument
      expect(mockPrisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-from-service',
          }),
        }),
      );
    });
  });

  describe('getTransactions', () => {
    it('should add userId filter for VIEWER role', async () => {
      (mockPrisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.transaction.count as jest.Mock).mockResolvedValue(0);

      const query = {
        page: 1,
        limit: 10,
        sortBy: 'date' as const,
        sortOrder: 'desc' as const,
      };

      await getTransactions(query, 'viewer-user-id', Role.VIEWER);

      // VIEWER should have userId filter applied
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'viewer-user-id',
            deletedAt: null,
          }),
        }),
      );
    });

    it('should NOT add userId filter for ADMIN role', async () => {
      (mockPrisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.transaction.count as jest.Mock).mockResolvedValue(0);

      const query = {
        page: 1,
        limit: 10,
        sortBy: 'date' as const,
        sortOrder: 'desc' as const,
      };

      await getTransactions(query, 'admin-user-id', Role.ADMIN);

      // ADMIN should NOT have userId filter
      const calledWith = (mockPrisma.transaction.findMany as jest.Mock).mock.calls[0][0];
      expect(calledWith.where).not.toHaveProperty('userId');
      expect(calledWith.where.deletedAt).toBeNull();
    });
  });
});

describe('getPaginationMeta', () => {
  it('should return correct totalPages and hasNext/hasPrev', () => {
    const meta = getPaginationMeta(95, 2, 10);

    expect(meta.total).toBe(95);
    expect(meta.page).toBe(2);
    expect(meta.limit).toBe(10);
    expect(meta.totalPages).toBe(10); // ceil(95/10) = 10
    expect(meta.hasNext).toBe(true);  // page 2 of 10
    expect(meta.hasPrev).toBe(true);  // page > 1
  });

  it('should return hasPrev=false for page 1', () => {
    const meta = getPaginationMeta(50, 1, 10);
    expect(meta.hasPrev).toBe(false);
  });

  it('should return hasNext=false for last page', () => {
    const meta = getPaginationMeta(50, 5, 10);
    expect(meta.hasNext).toBe(false);
  });

  it('should handle zero total', () => {
    const meta = getPaginationMeta(0, 1, 10);
    expect(meta.totalPages).toBe(0);
    expect(meta.hasNext).toBe(false);
    expect(meta.hasPrev).toBe(false);
  });
});
