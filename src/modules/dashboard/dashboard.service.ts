import * as analyticsService from '../transactions/transactions.analytics.service';
import { Role } from '../../types/roles';

/**
 * Dashboard service — delegates to analytics service.
 * Provides a clean boundary between dashboard endpoints and analytics logic.
 * Role-based data scoping is handled in the analytics service layer.
 */

/**
 * Gets the financial summary dashboard data.
 * @param userId - Authenticated user's ID
 * @param userRole - Authenticated user's role
 * @param dateFrom - Optional start date filter
 * @param dateTo - Optional end date filter
 * @returns Summary with income, expenses, net balance, and counts
 */
export async function getSummary(
  userId: string,
  userRole: Role,
  dateFrom?: string,
  dateTo?: string,
) {
  return analyticsService.getSummary(userId, userRole, dateFrom, dateTo);
}

/**
 * Gets transaction breakdown by category.
 * @param userId - Authenticated user's ID
 * @param userRole - Authenticated user's role
 * @param dateFrom - Optional start date filter
 * @param dateTo - Optional end date filter
 * @returns Array of category breakdowns with percentages
 */
export async function getByCategory(
  userId: string,
  userRole: Role,
  dateFrom?: string,
  dateTo?: string,
) {
  return analyticsService.getByCategory(userId, userRole, dateFrom, dateTo);
}

/**
 * Gets income/expense trends by period.
 * @param userId - Authenticated user's ID
 * @param userRole - Authenticated user's role
 * @param period - Bucketing period ("monthly" or "weekly")
 * @param dateFrom - Optional start date filter
 * @param dateTo - Optional end date filter
 * @returns Array of trend data points
 */
export async function getTrends(
  userId: string,
  userRole: Role,
  period: 'monthly' | 'weekly',
  dateFrom?: string,
  dateTo?: string,
) {
  return analyticsService.getTrends(userId, userRole, period, dateFrom, dateTo);
}

/**
 * Gets the most recent 10 transactions.
 * @param userId - Authenticated user's ID
 * @param userRole - Authenticated user's role
 * @returns Array of recent transactions
 */
export async function getRecent(userId: string, userRole: Role) {
  return analyticsService.getRecent(userId, userRole);
}

/**
 * Gets the top 5 expense categories by total amount.
 * @param userId - Authenticated user's ID
 * @param userRole - Authenticated user's role
 * @param dateFrom - Optional start date filter
 * @param dateTo - Optional end date filter
 * @returns Array of top categories with rank
 */
export async function getTopCategories(
  userId: string,
  userRole: Role,
  dateFrom?: string,
  dateTo?: string,
) {
  return analyticsService.getTopCategories(userId, userRole, dateFrom, dateTo);
}
