/**
 * Custom API error class for operational errors.
 * Operational errors are expected (e.g., validation failures, auth errors)
 * and are safe to expose to the client.
 * Non-operational errors (e.g., programming bugs) should be logged internally
 * and result in a generic 500 response.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where our error was thrown
    Object.setPrototypeOf(this, ApiError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}
