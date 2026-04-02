import { z } from 'zod';
import dotenv from 'dotenv';

// Load .env file before validation
dotenv.config();

/**
 * Zod schema for environment variable validation.
 * The application will crash immediately with a clear error message
 * if any required variable is missing or invalid.
 * This implements the fail-fast principle — never let the app start silently misconfigured.
 */
const envSchema = z.object({
  DATABASE_URL: z
    .string({ required_error: 'DATABASE_URL is required' })
    .min(1, 'DATABASE_URL cannot be empty'),

  JWT_ACCESS_SECRET: z
    .string({ required_error: 'JWT_ACCESS_SECRET is required' })
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters for security'),

  JWT_REFRESH_SECRET: z
    .string({ required_error: 'JWT_REFRESH_SECRET is required' })
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters for security'),

  JWT_ACCESS_EXPIRES_IN: z
    .string()
    .default('15m'),

  JWT_REFRESH_EXPIRES_IN: z
    .string()
    .default('7d'),

  NODE_ENV: z
    .enum(['development', 'production', 'test'], {
      required_error: 'NODE_ENV is required',
      invalid_type_error: 'NODE_ENV must be one of: development, production, test',
    })
    .default('development'),

  PORT: z
    .string()
    .default('3000')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),

  CORS_ORIGIN: z
    .string()
    .default('*'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates and parses all environment variables on startup.
 * If validation fails, the process exits with code 1 and a clear error message.
 */
function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('╔══════════════════════════════════════════════╗');
    console.error('║       ENVIRONMENT VALIDATION FAILED         ║');
    console.error('╚══════════════════════════════════════════════╝');
    console.error('');
    console.error('The following environment variables are missing or invalid:');
    console.error('');

    for (const issue of result.error.issues) {
      console.error(`  ✗ ${issue.path.join('.')}: ${issue.message}`);
    }

    console.error('');
    console.error('Please check your .env file and ensure all required variables are set.');
    console.error('See .env.example for reference.');
    console.error('');
    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();
