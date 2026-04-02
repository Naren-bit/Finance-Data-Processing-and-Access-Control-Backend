/**
 * Pagination metadata interface and helper function.
 * Provides consistent pagination info across all list endpoints.
 */

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Calculates pagination metadata from total count, current page, and limit.
 * @param total - Total number of records matching the query
 * @param page - Current page number (1-indexed)
 * @param limit - Number of records per page
 * @returns PaginationMeta object with computed fields
 */
export function getPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit);

  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
