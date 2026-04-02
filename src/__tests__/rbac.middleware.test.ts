import { Request, Response, NextFunction } from 'express';
import { requireRole } from '../middleware/rbac.middleware';
import { Role } from '../types/roles';
import { ApiError } from '../utils/ApiError';

describe('RBAC Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  it('should pass for ADMIN user when requireRole(ADMIN)', () => {
    mockReq.user = {
      id: 'admin-id',
      email: 'admin@test.com',
      role: Role.ADMIN,
      isActive: true,
    };

    const middleware = requireRole(Role.ADMIN);
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('should throw ApiError 403 for VIEWER user when requireRole(ADMIN)', () => {
    mockReq.user = {
      id: 'viewer-id',
      email: 'viewer@test.com',
      role: Role.VIEWER,
      isActive: true,
    };

    const middleware = requireRole(Role.ADMIN);

    expect(() => {
      middleware(mockReq as Request, mockRes as Response, mockNext);
    }).toThrow(ApiError);

    try {
      middleware(mockReq as Request, mockRes as Response, mockNext);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(403);
      expect((error as ApiError).message).toBe('Insufficient permissions');
    }
  });

  it('should pass for ANALYST user when requireRole(ANALYST, ADMIN)', () => {
    mockReq.user = {
      id: 'analyst-id',
      email: 'analyst@test.com',
      role: Role.ANALYST,
      isActive: true,
    };

    const middleware = requireRole(Role.ANALYST, Role.ADMIN);
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
  });

  it('should return 401 if req.user is undefined', () => {
    mockReq.user = undefined;

    const middleware = requireRole(Role.ADMIN);

    expect(() => {
      middleware(mockReq as Request, mockRes as Response, mockNext);
    }).toThrow(ApiError);

    try {
      middleware(mockReq as Request, mockRes as Response, mockNext);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(401);
      expect((error as ApiError).message).toBe('Not authenticated');
    }
  });

  it('should reject VIEWER when only ANALYST and ADMIN are allowed', () => {
    mockReq.user = {
      id: 'viewer-id',
      email: 'viewer@test.com',
      role: Role.VIEWER,
      isActive: true,
    };

    const middleware = requireRole(Role.ANALYST, Role.ADMIN);

    expect(() => {
      middleware(mockReq as Request, mockRes as Response, mockNext);
    }).toThrow(ApiError);
  });
});
