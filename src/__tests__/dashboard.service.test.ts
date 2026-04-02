// Mock Prisma client
jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    transaction: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
      $queryRawUnsafe: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
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
import { getSummary, getByCategory } from '../modules/transactions/transactions.analytics.service';
import { Role } from '../types/roles';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Dashboard Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSummary', () => {
    it('should calculate totals correctly from grouped data', async () => {
      (mockPrisma.transaction.groupBy as jest.Mock).mockResolvedValue([
        {
          type: 'INCOME',
          _sum: { amount: { toNumber: () => 150000 } },
          _count: { _all: 5 },
        },
        {
          type: 'EXPENSE',
          _sum: { amount: { toNumber: () => 85000 } },
          _count: { _all: 12 },
        },
      ]);

      const summary = await getSummary('admin-id', Role.ADMIN);

      expect(summary.totalIncome).toBe(150000);
      expect(summary.totalExpenses).toBe(85000);
      expect(summary.transactionCount).toBe(17);
      expect(summary.incomeCount).toBe(5);
      expect(summary.expenseCount).toBe(12);
    });

    it('should calculate netBalance = totalIncome - totalExpenses', async () => {
      (mockPrisma.transaction.groupBy as jest.Mock).mockResolvedValue([
        {
          type: 'INCOME',
          _sum: { amount: { toNumber: () => 200000 } },
          _count: { _all: 3 },
        },
        {
          type: 'EXPENSE',
          _sum: { amount: { toNumber: () => 120000 } },
          _count: { _all: 8 },
        },
      ]);

      const summary = await getSummary('admin-id', Role.ADMIN);

      expect(summary.netBalance).toBe(80000); // 200000 - 120000
    });

    it('should handle empty data (no transactions)', async () => {
      (mockPrisma.transaction.groupBy as jest.Mock).mockResolvedValue([]);

      const summary = await getSummary('user-id', Role.VIEWER);

      expect(summary.totalIncome).toBe(0);
      expect(summary.totalExpenses).toBe(0);
      expect(summary.netBalance).toBe(0);
      expect(summary.transactionCount).toBe(0);
    });
  });

  describe('getByCategory', () => {
    it('should calculate percentages that sum to ~100% per type', async () => {
      (mockPrisma.transaction.groupBy as jest.Mock).mockResolvedValue([
        {
          category: 'FOOD',
          type: 'EXPENSE',
          _sum: { amount: { toNumber: () => 5000 } },
          _count: { _all: 10 },
        },
        {
          category: 'RENT',
          type: 'EXPENSE',
          _sum: { amount: { toNumber: () => 15000 } },
          _count: { _all: 3 },
        },
        {
          category: 'SALARY',
          type: 'INCOME',
          _sum: { amount: { toNumber: () => 50000 } },
          _count: { _all: 2 },
        },
      ]);

      const breakdown = await getByCategory('admin-id', Role.ADMIN);

      // Check expense percentages sum to 100%
      const expenseItems = breakdown.filter((item) => item.type === 'EXPENSE');
      const expensePercentageSum = expenseItems.reduce(
        (sum, item) => sum + item.percentage,
        0,
      );
      expect(Math.round(expensePercentageSum)).toBe(100);

      // Check income percentages sum to 100%
      const incomeItems = breakdown.filter((item) => item.type === 'INCOME');
      const incomePercentageSum = incomeItems.reduce(
        (sum, item) => sum + item.percentage,
        0,
      );
      expect(Math.round(incomePercentageSum)).toBe(100);
    });

    it('should return correct category data structure', async () => {
      (mockPrisma.transaction.groupBy as jest.Mock).mockResolvedValue([
        {
          category: 'FOOD',
          type: 'EXPENSE',
          _sum: { amount: { toNumber: () => 5000 } },
          _count: { _all: 10 },
        },
      ]);

      const breakdown = await getByCategory('admin-id', Role.ADMIN);

      expect(breakdown[0]).toHaveProperty('category');
      expect(breakdown[0]).toHaveProperty('type');
      expect(breakdown[0]).toHaveProperty('total');
      expect(breakdown[0]).toHaveProperty('count');
      expect(breakdown[0]).toHaveProperty('percentage');
      expect(breakdown[0].category).toBe('FOOD');
      expect(breakdown[0].type).toBe('EXPENSE');
      expect(breakdown[0].total).toBe(5000);
      expect(breakdown[0].count).toBe(10);
    });
  });
});
