import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../../config/env';
import prisma from '../../config/database';
import { ApiError } from '../../utils/ApiError';
import { Role } from '../../types/roles';

const BCRYPT_ROUNDS = 12;

/**
 * Strips passwordHash from a user object for safe API responses.
 * Never expose password hashes in any response — this is a security fundamental.
 */
export function toSafeUser(user: {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  passwordHash?: string;
}): Omit<typeof user, 'passwordHash'> {
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

/**
 * Hashes a plaintext password using bcrypt with 12 salt rounds.
 * 12 rounds provides a good balance between security and performance.
 * @param password - Plaintext password to hash
 * @returns Bcrypt hash string
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Compares a plaintext password against a bcrypt hash.
 * @param password - Plaintext password to verify
 * @param hash - Stored bcrypt hash
 * @returns true if password matches, false otherwise
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generates a JWT access token and a refresh token.
 * Access token is short-lived (15m) for security.
 * Refresh token is a cryptographically random string stored in DB.
 * @param user - User object with id, email, and role
 * @returns Object containing accessToken and refreshToken strings
 */
export function generateTokens(user: { id: string; email: string; role: string }): {
  accessToken: string;
  refreshToken: string;
} {
  const expiresInMs = parseDuration(env.JWT_ACCESS_EXPIRES_IN);
  const expiresInSeconds = Math.floor(expiresInMs / 1000);

  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    env.JWT_ACCESS_SECRET,
    { expiresIn: expiresInSeconds },
  );

  const refreshToken = crypto.randomBytes(64).toString('hex');

  return { accessToken, refreshToken };
}

/**
 * Parses a duration string (e.g., '7d', '15m') into milliseconds.
 * @param duration - Duration string
 * @returns Duration in milliseconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}

/**
 * Stores a refresh token in the database with an expiration date.
 * @param userId - User ID to associate the token with
 * @param token - Refresh token string
 */
async function storeRefreshToken(userId: string, token: string): Promise<void> {
  const expiresAt = new Date(Date.now() + parseDuration(env.JWT_REFRESH_EXPIRES_IN));

  await prisma.refreshToken.create({
    data: { userId, token, expiresAt },
  });
}

/**
 * Registers a new user account.
 * @param email - User's email address (must be unique)
 * @param password - Plaintext password (will be hashed)
 * @throws ApiError 409 if email is already registered
 * @returns Object with accessToken, refreshToken, and safe user object
 */
export async function register(
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string; user: ReturnType<typeof toSafeUser> }> {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new ApiError(409, 'Email already registered');
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: { email, passwordHash, role: Role.VIEWER },
  });

  const { accessToken, refreshToken } = generateTokens(user);
  await storeRefreshToken(user.id, refreshToken);

  return { accessToken, refreshToken, user: toSafeUser(user) };
}

/**
 * Authenticates a user with email and password.
 * Uses a single generic error message for both wrong email and wrong password
 * to prevent user enumeration attacks.
 * @param email - User's email address
 * @param password - Plaintext password
 * @throws ApiError 401 if credentials are invalid or account is deactivated
 * @returns Object with accessToken, refreshToken, and safe user object
 */
export async function login(
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string; user: ReturnType<typeof toSafeUser> }> {
  // Use the same error message for both wrong email and wrong password
  // to prevent user enumeration attacks
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const isPasswordValid = await comparePassword(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid credentials');
  }

  if (!user.isActive) {
    throw new ApiError(401, 'Account deactivated');
  }

  const { accessToken, refreshToken } = generateTokens(user);
  await storeRefreshToken(user.id, refreshToken);

  return { accessToken, refreshToken, user: toSafeUser(user) };
}

/**
 * Refreshes an access token using a valid refresh token.
 * Implements token rotation: the old refresh token is deleted and a new one is created.
 * This limits the window for refresh token replay attacks.
 * @param oldRefreshToken - The current refresh token
 * @throws ApiError 401 if token is invalid or expired
 * @returns Object with new accessToken and refreshToken
 */
export async function refreshAccessToken(
  oldRefreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: oldRefreshToken },
    include: { user: true },
  });

  if (!storedToken) {
    throw new ApiError(401, 'Invalid refresh token');
  }

  if (storedToken.expiresAt < new Date()) {
    // Clean up the expired token
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    throw new ApiError(401, 'Refresh token expired');
  }

  if (!storedToken.user.isActive) {
    throw new ApiError(401, 'Account deactivated');
  }

  // Token rotation: delete old, create new
  await prisma.refreshToken.delete({ where: { id: storedToken.id } });

  const { accessToken, refreshToken: newRefreshToken } = generateTokens(storedToken.user);
  await storeRefreshToken(storedToken.userId, newRefreshToken);

  return { accessToken, refreshToken: newRefreshToken };
}

/**
 * Logs out a user by deleting their refresh token from the database.
 * Idempotent: returns successfully even if the token doesn't exist.
 * @param refreshToken - The refresh token to invalidate
 */
export async function logout(refreshToken: string): Promise<void> {
  try {
    await prisma.refreshToken.delete({
      where: { token: refreshToken },
    });
  } catch {
    // Token not found — return success anyway (idempotent logout)
  }
}

/**
 * Retrieves the current authenticated user's profile.
 * @param userId - The authenticated user's ID
 * @throws ApiError 404 if user not found
 * @returns Safe user object (no passwordHash)
 */
export async function getMe(userId: string): Promise<ReturnType<typeof toSafeUser>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return toSafeUser(user);
}
