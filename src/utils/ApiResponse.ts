import { Response } from 'express';

/**
 * Consistent success response shape used across all endpoints.
 * Ensures the API always returns a predictable structure.
 */
export class ApiResponse {
  /**
   * Sends a success response with consistent shape.
   * @param res - Express response object
   * @param statusCode - HTTP status code (200, 201, etc.)
   * @param message - Human-readable success message
   * @param data - Response payload
   */
  static success(res: Response, statusCode: number, message: string, data?: unknown): void {
    res.status(statusCode).json({
      success: true,
      message,
      data: data ?? null,
    });
  }

  /**
   * Sends a paginated success response.
   * @param res - Express response object
   * @param message - Human-readable success message
   * @param items - Array of items for the current page
   * @param pagination - Pagination metadata
   */
  static paginated(
    res: Response,
    message: string,
    items: unknown[],
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    },
  ): void {
    res.status(200).json({
      success: true,
      message,
      data: {
        items,
        pagination,
      },
    });
  }

  /**
   * Sends an error response with consistent shape.
   * @param res - Express response object
   * @param statusCode - HTTP status code
   * @param message - Error message
   * @param details - Optional validation error details
   */
  static error(
    res: Response,
    statusCode: number,
    message: string,
    details?: Array<{ field: string; message: string }>,
  ): void {
    const response: {
      success: boolean;
      message: string;
      details?: Array<{ field: string; message: string }>;
    } = {
      success: false,
      message,
    };

    if (details) {
      response.details = details;
    }

    res.status(statusCode).json(response);
  }
}
