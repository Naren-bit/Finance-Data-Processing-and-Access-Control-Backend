import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import * as dashboardService from './dashboard.service';

/**
 * @swagger
 * /api/dashboard/summary:
 *   get:
 *     tags: [Dashboard]
 *     summary: Financial summary
 *     description: |
 *       Returns total income, expenses, net balance, and transaction counts.
 *       VIEWER sees only own data. ANALYST and ADMIN see all data.
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *     responses:
 *       200:
 *         description: Summary retrieved
 *       401:
 *         description: Not authenticated
 */
export const getSummaryHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Not authenticated');

  const { dateFrom, dateTo } = req.query;
  const summary = await dashboardService.getSummary(
    req.user.id,
    req.user.role,
    dateFrom as string | undefined,
    dateTo as string | undefined,
  );

  ApiResponse.success(res, 200, 'Dashboard summary retrieved', summary);
});

/**
 * @swagger
 * /api/dashboard/by-category:
 *   get:
 *     tags: [Dashboard]
 *     summary: Breakdown by category
 *     description: Returns transaction totals grouped by category and type with percentages.
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *     responses:
 *       200:
 *         description: Category breakdown retrieved
 */
export const getByCategoryHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Not authenticated');

  const { dateFrom, dateTo } = req.query;
  const breakdown = await dashboardService.getByCategory(
    req.user.id,
    req.user.role,
    dateFrom as string | undefined,
    dateTo as string | undefined,
  );

  ApiResponse.success(res, 200, 'Category breakdown retrieved', breakdown);
});

/**
 * @swagger
 * /api/dashboard/trends:
 *   get:
 *     tags: [Dashboard]
 *     summary: Income/expense trends
 *     description: |
 *       Returns income, expenses, and net balance bucketed by period.
 *       Uses raw SQL with strftime for date bucketing.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [monthly, weekly]
 *           default: monthly
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
 *     responses:
 *       200:
 *         description: Trends retrieved
 */
export const getTrendsHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Not authenticated');

  const { dateFrom, dateTo } = req.query;
  const period = (req.query.period as string) === 'weekly' ? 'weekly' : 'monthly';

  const trends = await dashboardService.getTrends(
    req.user.id,
    req.user.role,
    period,
    dateFrom as string | undefined,
    dateTo as string | undefined,
  );

  ApiResponse.success(res, 200, 'Trends retrieved', trends);
});

/**
 * @swagger
 * /api/dashboard/recent:
 *   get:
 *     tags: [Dashboard]
 *     summary: Recent transactions
 *     description: Returns the last 10 transactions with user info.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Recent transactions retrieved
 */
export const getRecentHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Not authenticated');

  const recent = await dashboardService.getRecent(req.user.id, req.user.role);

  ApiResponse.success(res, 200, 'Recent transactions retrieved', recent);
});

/**
 * @swagger
 * /api/dashboard/top-categories:
 *   get:
 *     tags: [Dashboard]
 *     summary: Top expense categories
 *     description: Returns the top 5 expense categories by total amount.
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *     responses:
 *       200:
 *         description: Top categories retrieved
 */
export const getTopCategoriesHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Not authenticated');

  const { dateFrom, dateTo } = req.query;
  const topCategories = await dashboardService.getTopCategories(
    req.user.id,
    req.user.role,
    dateFrom as string | undefined,
    dateTo as string | undefined,
  );

  ApiResponse.success(res, 200, 'Top categories retrieved', topCategories);
});
