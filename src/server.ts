import app from './app';
import { env } from './config/env';
import prisma from './config/database';

const server = app.listen(env.PORT, () => {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║     Zorvyn Finance Dashboard API Server      ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  ✓ Environment : ${env.NODE_ENV}`);
  console.log(`  ✓ Port        : ${env.PORT}`);
  console.log(`  ✓ CORS Origin : ${env.CORS_ORIGIN}`);
  console.log(`  ✓ API Docs    : http://localhost:${env.PORT}/api-docs`);
  console.log(`  ✓ Health Check: http://localhost:${env.PORT}/api/health`);
  console.log('');
});

/**
 * Graceful shutdown handler.
 * Closes the HTTP server first (stops accepting new connections),
 * then disconnects the Prisma client (releases DB connections),
 * then exits the process cleanly.
 * This shows production operational awareness.
 */
async function gracefulShutdown(signal: string): Promise<void> {
  console.log('');
  console.log(`⚠ Received ${signal}. Starting graceful shutdown...`);

  // Step 1: Close the HTTP server — stop accepting new connections
  console.log('  → Closing HTTP server...');
  server.close(() => {
    console.log('  ✓ HTTP server closed');
  });

  // Step 2: Disconnect Prisma — release database connections
  try {
    console.log('  → Disconnecting database...');
    await prisma.$disconnect();
    console.log('  ✓ Database disconnected');
  } catch (error) {
    console.error('  ✗ Error disconnecting database:', error);
  }

  // Step 3: Exit the process
  console.log('  ✓ Graceful shutdown complete');
  process.exit(0);
}

// Register signal handlers for graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown) => {
  console.error('UNHANDLED REJECTION:', reason);
  // In production, you'd want to log this and potentially restart
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('UNCAUGHT EXCEPTION:', error);
  // Must exit after uncaught exception — process is in an undefined state
  process.exit(1);
});

export default server;
