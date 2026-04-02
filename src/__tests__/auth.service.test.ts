import bcrypt from 'bcryptjs';

// Mock Prisma client
jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
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
import {
  hashPassword,
  comparePassword,
  generateTokens,
  register,
  login,
} from '../modules/auth/auth.service';
import { ApiError } from '../utils/ApiError';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should return a bcrypt hash, not plaintext', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);

      expect(hash).not.toBe(password);
      expect(hash).toMatch(/^\$2[aby]?\$/); // bcrypt hash pattern
    });

    it('should generate different hashes for the same password', async () => {
      const password = 'TestPassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2); // Different salts
    });
  });

  describe('comparePassword', () => {
    it('should return true for correct password', async () => {
      const password = 'TestPassword123';
      const hash = await bcrypt.hash(password, 12);

      const result = await comparePassword(password, hash);
      expect(result).toBe(true);
    });

    it('should return false for wrong password', async () => {
      const hash = await bcrypt.hash('CorrectPassword123', 12);

      const result = await comparePassword('WrongPassword123', hash);
      expect(result).toBe(false);
    });
  });

  describe('generateTokens', () => {
    it('should return accessToken and refreshToken strings', () => {
      const user = { id: 'test-id', email: 'test@test.com', role: 'VIEWER' };

      const tokens = generateTokens(user);

      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
      expect(tokens.accessToken.length).toBeGreaterThan(0);
      expect(tokens.refreshToken.length).toBeGreaterThan(0);
    });

    it('should generate different refresh tokens each time', () => {
      const user = { id: 'test-id', email: 'test@test.com', role: 'VIEWER' };

      const tokens1 = generateTokens(user);
      const tokens2 = generateTokens(user);

      expect(tokens1.refreshToken).not.toBe(tokens2.refreshToken);
    });
  });

  describe('register', () => {
    it('should throw ApiError 409 if email already exists', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-id',
        email: 'existing@test.com',
      });

      await expect(register('existing@test.com', 'Password123'))
        .rejects
        .toThrow(ApiError);

      try {
        await register('existing@test.com', 'Password123');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(409);
        expect((error as ApiError).message).toBe('Email already registered');
      }
    });

    it('should create user and return tokens on success', async () => {
      const mockUser = {
        id: 'new-user-id',
        email: 'new@test.com',
        passwordHash: 'hashed',
        role: 'VIEWER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.user.create as jest.Mock).mockResolvedValue(mockUser);
      (mockPrisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await register('new@test.com', 'Password123');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('login', () => {
    it('should throw ApiError 401 for wrong email (same generic message)', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(login('wrong@test.com', 'Password123'))
        .rejects
        .toThrow(ApiError);

      try {
        await login('wrong@test.com', 'Password123');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(401);
        expect((error as ApiError).message).toBe('Invalid credentials');
      }
    });

    it('should throw ApiError 401 for wrong password (same generic message)', async () => {
      const hash = await bcrypt.hash('CorrectPassword123', 12);
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-id',
        email: 'test@test.com',
        passwordHash: hash,
        role: 'VIEWER',
        isActive: true,
      });

      try {
        await login('test@test.com', 'WrongPassword123');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(401);
        // Same message as wrong email — prevents user enumeration
        expect((error as ApiError).message).toBe('Invalid credentials');
      }
    });

    it('should throw ApiError 401 for deactivated account', async () => {
      const hash = await bcrypt.hash('Password123', 12);
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-id',
        email: 'test@test.com',
        passwordHash: hash,
        role: 'VIEWER',
        isActive: false,
      });

      try {
        await login('test@test.com', 'Password123');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(401);
        expect((error as ApiError).message).toBe('Account deactivated');
      }
    });
  });
});
