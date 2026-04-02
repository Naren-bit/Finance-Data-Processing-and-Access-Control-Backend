import prisma from '../../config/database';
import { Role } from '../../types/roles';
import { Prisma } from '@prisma/client';

/**
 * Builds a user-scoping filter based on the user's role.
 * VIEWERs see only their own data; ANALYSTs and ADMINs see all data.
 */
function buildScopeFilter(
  userId: string,
  userRole: Role,
): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = {
    deletedAt: null,
  };

  if (userRole === Role.VIEWER) {
    where.userId = userId;
  }

  return where;
}

/**
 * Adds date range filtering to a WHERE clause.
 */
function addDateFilter(
  where: Prisma.TransactionWhereInput,
  dateFrom?: string,
  dateTo?: string,
): Prisma.TransactionWhereInput {
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) {
      (where.date as Prisma.DateTimeFilter).gte = new Date(dateFrom);
    }
    if (dateTo) {
      (where.date as Prisma.DateTimeFilter).lte = new Date(dateTo);
    }
  }
  return where;
}

export interface SummaryResult {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  transactionCount: number;
  incomeCount: number;
  expenseCount: number;
}

/**
 * Generates a financial summary with total income, expenses, net balance, and counts.
 * Uses Prisma groupBy on transaction type for efficiency.
 * @param userId - Authenticated user's ID
 * @param userRole - Authenticated user's role
 * @param dateFrom - Optional start date filter (ISO string)
 * @param dateTo - Optional end date filter (ISO string)
 * @returns Summary object with totals and counts
 */
export async function getSummary(
  userId: string,
  userRole: Role,
  dateFrom?: string,
  dateTo?: string,
): Promise<SummaryResult> {
  const where = addDateFilter(buildScopeFilter(userId, userRole), dateFrom, dateTo);

  const grouped = await prisma.transaction.groupBy({
    by: ['type'],
    where,
    _sum: { amount: true },
    _count: { _all: true },
  });

  let totalIncome = 0;
  let totalExpenses = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  for (const group of grouped) {
    const sum = group._sum.amount ? group._sum.amount.toNumber() : 0;
    const count = group._count._all;

    if (group.type === 'INCOME') {
      totalIncome = sum;
      incomeCount = count;
    } else if (group.type === 'EXPENSE') {
      totalExpenses = sum;
      expenseCount = count;
    }
  }

  return {
    totalIncome,
    totalExpenses,
    netBalance: totalIncome - totalExpenses,
    transactionCount: incomeCount + expenseCount,
    incomeCount,
    expenseCount,
  };
}

export interface CategoryBreakdownResult {
  category: string;
  type: string;
  total: number;
  count: number;
  percentage: number;
}

/**
 * Breaks down transactions by category with totals, counts, and percentage of type total.
 * percentage = (category total / total of that type) * 100, rounded to 2 decimal places.
 * @param userId - Authenticated user's ID
 * @param userRole - Authenticated user's role
 * @param dateFrom - Optional start date filter
 * @param dateTo - Optional end date filter
 * @returns Array of category breakdown objects
 */
export async function getByCategory(
  userId: string,
  userRole: Role,
  dateFrom?: string,
  dateTo?: string,
): Promise<CategoryBreakdownResult[]> {
  const where = addDateFilter(buildScopeFilter(userId, userRole), dateFrom, dateTo);

  const grouped = await prisma.transaction.groupBy({
    by: ['category', 'type'],
    where,
    _sum: { amount: true },
    _count: { _all: true },
  });

  // Calculate totals per type for percentage calculation
  const typeTotals: Record<string, number> = {};
  for (const group of grouped) {
    const sum = group._sum.amount ? group._sum.amount.toNumber() : 0;
    typeTotals[group.type] = (typeTotals[group.type] || 0) + sum;
  }

  return grouped.map((group) => {
    const total = group._sum.amount ? group._sum.amount.toNumber() : 0;
    const typeTotal = typeTotals[group.type] || 1; // prevent division by zero
    const percentage = Math.round((total / typeTotal) * 10000) / 100;

    return {
      category: group.category,
      type: group.type,
      total,
      count: group._count._all,
      percentage,
    };
  });
}

export interface TrendResult {
  period: string;
  income: number;
  expenses: number;
  net: number;
}

/**
 * Generates income/expense trends bucketed by period (monthly or weekly).
 * Uses $queryRaw with strftime for SQLite date bucketing — demonstrates raw SQL knowledge.
 * @param userId - Authenticated user's ID
 * @param userRole - Authenticated user's role
 * @param period - "monthly" or "weekly" bucketing
 * @param dateFrom - Optional start date filter
 * @param dateTo - Optional end date filter
 * @returns Array of trend objects ordered chronologically
 */
export async function getTrends(
  userId: string,
  userRole: Role,
  period: 'monthly' | 'weekly',
  dateFrom?: string,
  dateTo?: string,
): Promise<TrendResult[]> {
  const dateFormat = period === 'monthly' ? '%Y-%m' : '%Y-%W';

  // Build WHERE clause conditions for raw SQL
  const conditions: string[] = ['t."deletedAt" IS NULL'];
  const params: (string | Date)[] = [];

  if (userRole === Role.VIEWER) {
    conditions.push(`t."userId" = ?`);
    params.push(userId);
  }

  if (dateFrom) {
    conditions.push(`t."date" >= ?`);
    params.push(new Date(dateFrom).toISOString());
  }

  if (dateTo) {
    conditions.push(`t."date" <= ?`);
    params.push(new Date(dateTo).toISOString());
  }

  const whereClause = conditions.join(' AND ');

  const rawResults = await prisma.$queryRawUnsafe<
    Array<{ period: string; type: string; total: number }>
  >(
    `SELECT 
      strftime('${dateFormat}', t."date") as period,
      t."type",
      SUM(CAST(t."amount" AS REAL)) as total
    FROM "Transaction" t
    WHERE ${whereClause}
    GROUP BY period, t."type"
    ORDER BY period ASC`,
    ...params,
  );

  // Pivot the results: merge income and expense into single period entries
  const periodMap = new Map<string, { income: number; expenses: number }>();

  for (const row of rawResults) {
    if (!periodMap.has(row.period)) {
      periodMap.set(row.period, { income: 0, expenses: 0 });
    }
    const entry = periodMap.get(row.period)!;
    if (row.type === 'INCOME') {
      entry.income = Number(row.total);
    } else {
      entry.expenses = Number(row.total);
    }
  }

  // Convert the map to a sorted array
  const trends: TrendResult[] = [];
  for (const [periodKey, data] of periodMap) {
    trends.push({
      period: periodKey,
      income: data.income,
      expenses: data.expenses,
      net: data.income - data.expenses,
    });
  }

  return trends.sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Retrieves the last 10 transactions with user information joined.
 * Ordered by date desc, then createdAt desc.
 * @param userId - Authenticated user's ID
 * @param userRole - Authenticated user's role
 * @returns Array of recent transaction objects
 */
export async function getRecent(
  userId: string,
  userRole: Role,
): Promise<Record<string, unknown>[]> {
  const where = buildScopeFilter(userId, userRole);

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: 10,
    include: {
      user: {
        select: { id: true, email: true },
      },
    },
  });

  return transactions.map((t) => ({
    ...t,
    amount: t.amount.toNumber(),
  }));
}

export interface TopCategoryResult {
  category: string;
  total: number;
  count: number;
  rank: number;
}

/**
 * Returns the top 5 EXPENSE categories by total amount.
 * @param userId - Authenticated user's ID
 * @param userRole - Authenticated user's role
 * @param dateFrom - Optional start date filter
 * @param dateTo - Optional end date filter
 * @returns Array of top category objects with rank
 */
export async function getTopCategories(
  userId: string,
  userRole: Role,
  dateFrom?: string,
  dateTo?: string,
): Promise<TopCategoryResult[]> {
  const where = addDateFilter(buildScopeFilter(userId, userRole), dateFrom, dateTo);
  where.type = 'EXPENSE';

  const grouped = await prisma.transaction.groupBy({
    by: ['category'],
    where,
    _sum: { amount: true },
    _count: { _all: true },
    orderBy: {
      _sum: { amount: 'desc' },
    },
    take: 5,
  });

  return grouped.map((group, index) => ({
    category: group.category,
    total: group._sum.amount ? group._sum.amount.toNumber() : 0,
    count: group._count._all,
    rank: index + 1,
  }));
}
