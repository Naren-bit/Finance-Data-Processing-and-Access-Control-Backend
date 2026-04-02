# Zorvyn Finance Dashboard — Backend API

A comprehensive finance dashboard backend API built with Node.js, TypeScript, Express, Prisma ORM, and SQLite. Features JWT authentication with refresh token rotation, role-based access control (RBAC), transaction management with soft deletes, and real-time financial analytics.

## Overview

This system serves as the backend for a personal finance dashboard, enabling users to track income and expenses, view analytics, and manage financial data. It implements three distinct user roles:

| Role | Capabilities |
|------|-------------|
| **VIEWER** | Read-only access to own transactions and dashboard data |
| **ANALYST** | Create/update transactions + access to all users' dashboard analytics |
| **ADMIN** | Full access — user management, all CRUD operations, soft-delete authority |

## Tech Stack & Rationale

| Technology | Why |
|-----------|-----|
| **Node.js + TypeScript** | Type safety catches bugs at compile time, not runtime. TypeScript interfaces enforce contracts between layers. |
| **Express** | Minimal, unopinionated — structure comes from the team, not the framework. Middleware composition is powerful and explicit. |
| **Prisma + SQLite** | Prisma gives type-safe queries and a migration history; SQLite means zero local setup (no Docker, no cloud DB account needed). |
| **Zod** | Runtime validation at the API boundary — TypeScript types alone don't protect against bad HTTP input from network requests. |
| **Jest + ts-jest** | Confidence that role logic, business rules, and auth flows actually work. Unit tests with mocked Prisma client for fast, isolated testing. |
| **JWT (access + refresh)** | Stateless auth for API requests. Short-lived access tokens (15m) paired with long-lived, rotated refresh tokens limit attack surface. |
| **bcryptjs** | Industry-standard password hashing with configurable work factor (12 rounds). |
| **Helmet + CORS + Rate Limiting** | Defense-in-depth security: security headers, origin restriction, and brute-force protection. |

## Quick Start

> **Must work in under 2 minutes — no Docker, no external DB required.**

```bash
# 1. Clone the repo
git clone <repository-url>
cd zorvyn-finance-dashboard

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env

# 4. Run database migration
npx prisma migrate dev --name init

# 5. Seed the database with test data
npx ts-node --transpile-only prisma/seed.ts

# 6. Start the development server
npm run dev
```

The server will start at `http://localhost:3000`. API documentation is available at `http://localhost:3000/api-docs`.

## Test Credentials (from seed)

| Email | Password | Role |
|-------|----------|------|
| admin@zorvyn.com | Admin123! | ADMIN |
| analyst@zorvyn.com | Analyst123! | ANALYST |
| viewer@zorvyn.com | Viewer123! | VIEWER |

## API Reference

### Authentication

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| POST | `/api/auth/register` | No | — | Register new user (defaults to VIEWER) |
| POST | `/api/auth/login` | No | — | Login with email/password |
| POST | `/api/auth/refresh` | No | — | Refresh access token (token rotation) |
| POST | `/api/auth/logout` | No | — | Invalidate refresh token (idempotent) |
| GET | `/api/auth/me` | Yes | All | Get current user profile |

### User Management (Admin Only)

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/api/users` | Yes | ADMIN | List all users (paginated) |
| GET | `/api/users/:id` | Yes | ADMIN | Get single user |
| PATCH | `/api/users/:id/role` | Yes | ADMIN | Change user role |
| PATCH | `/api/users/:id/status` | Yes | ADMIN | Toggle active status |
| DELETE | `/api/users/:id` | Yes | ADMIN | Soft-disable user (sets isActive=false) |

### Transactions

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/api/transactions` | Yes | All | List transactions (filtered, paginated, sorted) |
| POST | `/api/transactions` | Yes | ANALYST, ADMIN | Create transaction |
| GET | `/api/transactions/:id` | Yes | All | Get single transaction |
| PUT | `/api/transactions/:id` | Yes | ANALYST (own), ADMIN | Update transaction |
| DELETE | `/api/transactions/:id` | Yes | ADMIN | Soft-delete transaction |

### Dashboard Analytics

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/api/dashboard/summary` | Yes | All | Income/expense totals, net balance, counts |
| GET | `/api/dashboard/by-category` | Yes | All | Category breakdown with percentages |
| GET | `/api/dashboard/trends` | Yes | All | Monthly/weekly income vs expense trends |
| GET | `/api/dashboard/recent` | Yes | All | Last 10 transactions |
| GET | `/api/dashboard/top-categories` | Yes | All | Top 5 expense categories |

### Other

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Health check |
| GET | `/api-docs` | No | Swagger UI documentation |
| GET | `/api-docs.json` | No | Raw OpenAPI spec |

## Architecture Decisions

### 1. Layered Architecture (Routes → Controllers → Services)

Each layer has a single responsibility:
- **Routes** define HTTP endpoints and apply middleware (auth, RBAC, rate limiting)
- **Controllers** validate input, call services, and format responses — zero business logic
- **Services** contain all business logic and database queries via Prisma

This separation makes the code testable (services can be tested without HTTP), maintainable (changes in one layer don't cascade), and readable (you can understand the flow by reading any single file).

### 2. requireRole() Middleware Factory

A higher-order function that returns middleware based on allowed roles. This is more composable and readable than inline `if (user.role !== 'ADMIN')` checks scattered across route handlers. It also centralizes the authorization logic in one place.

### 3. Soft Delete (deletedAt instead of hard delete)

Financial records must never be permanently destroyed. Soft delete provides:
- **Audit trail**: every transaction that ever existed is preserved
- **Data integrity**: foreign key relationships remain valid
- **Recovery**: accidental deletions can be reversed
- All queries include `WHERE deletedAt IS NULL` to filter out soft-deleted records

### 4. Refresh Token Rotation

On each token refresh, the old refresh token is deleted and a new one is created. This limits the replay window if a refresh token is compromised — the attacker gets at most one use before the token is invalidated.

### 5. Decimal, Not Float for Money

Floating-point arithmetic causes rounding errors (0.1 + 0.2 ≠ 0.3). Financial applications must use Decimal types to ensure exact representation of monetary values. Prisma's Decimal type maps to SQLite's numeric affinity.

### 6. Database Indexes

Indexes on `userId`, `type`, `category`, `date`, and `deletedAt` because:
- Every transaction query filters by `deletedAt IS NULL`
- VIEWERs always filter by `userId`
- Dashboard analytics group by `type` and `category`
- Date range filtering is the most common query pattern

### 7. Environment Validation on Startup

The application validates all environment variables against a Zod schema before starting. If any required variable is missing or invalid, the process exits immediately with a clear error message. This implements the **fail-fast principle** — never let the app start silently misconfigured.

### 8. The Deliberate Choice of SQLite

While PostgreSQL is the industry standard for production, **SQLite was deliberately chosen for this specific project** to optimize the reviewer experience. 

* **Zero-Friction Evaluation**: Implementing PostgreSQL means reviewers must install Postgres locally, spin up Docker containers, or create cloud database accounts just to test the code. With SQLite, the setup is entirely frictionless: `npm install` → `npx prisma migrate dev` → `npm run dev`. Done.
* **The Power of Abstraction**: Because the application relies on the Prisma ORM, the underlying database layer is fully abstracted. Swapping SQLite for PostgreSQL in a production environment is literally a one-line change in `schema.prisma` (`provider = "postgresql"`). This demonstrates an understanding of the abstraction layer without enforcing unnecessary lock-in.

PostgreSQL genuinely outshines SQLite when an application demands concurrent writes, full-text search, JSON column operators, or horizontal scaling. However, for a demonstration assessment utilizing seed data, none of these bottlenecks apply.

## Assumptions Made

- **ANALYST** can create and update transactions, but can only update their own records (not other users'). ADMIN can update any record.
- **Soft delete** is used for transactions; users are deactivated (`isActive=false`) rather than deleted to preserve referential integrity.
- **Dashboard summary** for VIEWERs is scoped to their own transactions; ANALYSTs and ADMINs see all users' data.
- **Date validation** allows up to 1 year in the future (for scheduled/future transactions) but rejects clearly invalid dates.
- **Refresh tokens** are stored in the database (not Redis) for simplicity; in production, Redis would reduce DB load.
- **SQLite** is used for zero-setup local deployment; the architecture supports migration to PostgreSQL with minimal code changes.

## What Would Change in Production

| Area | Development | Production |
|------|------------|------------|
| **Database** | SQLite (file-based) | PostgreSQL with connection pooling (PgBouncer) |
| **Token storage** | Database | Redis (lower latency, reduced DB load) |
| **Logging** | Morgan (dev format) | Structured JSON logging (Winston or Pino) |
| **Secrets** | `.env` file | AWS Secrets Manager, HashiCorp Vault |
| **HTTPS** | Not enforced | TLS termination at load balancer |
| **CI/CD** | Manual | Automated pipeline with test gates |
| **Rate limiting** | In-memory | Redis-backed (shared across instances) |
| **Architecture** | Monolith | Auth service extracted as microservice |

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run a specific test file
npx jest src/__tests__/auth.service.test.ts

# Type-check without building
npm run lint
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with auto-reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Run compiled production build |
| `npm run seed` | Seed database with test data |
| `npm test` | Run all tests |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Type-check without emitting files |

## Project Structure

```
src/
├── config/
│   ├── env.ts              # Zod-validated environment configuration
│   └── database.ts         # Prisma client singleton
├── middleware/
│   ├── auth.middleware.ts   # JWT verification + user attachment
│   ├── rbac.middleware.ts   # requireRole() factory
│   ├── errorHandler.ts     # Global error handler (Prisma, Zod, ApiError)
│   ├── rateLimiter.ts      # Global + auth-specific rate limiters
│   └── requestLogger.ts    # Morgan HTTP request logger
├── modules/
│   ├── auth/               # Registration, login, refresh, logout
│   ├── users/              # Admin user management
│   ├── transactions/       # CRUD + analytics service
│   └── dashboard/          # Analytics endpoints
├── utils/
│   ├── ApiError.ts         # Custom error class with statusCode
│   ├── ApiResponse.ts      # Consistent response shape helper
│   ├── asyncHandler.ts     # Async route handler wrapper
│   └── pagination.ts       # Pagination metadata calculator
├── validators/             # Zod schemas for all endpoints
├── types/                  # TypeScript type definitions
├── __tests__/              # Jest unit tests
├── app.ts                  # Express app setup (no listen)
└── server.ts               # Server startup + graceful shutdown
```
