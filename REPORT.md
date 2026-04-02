# Zorvyn Engineering Report & Documentation

## 1. Introduction
This report documents the architectural choices, technology stack selection, and unique design implementations of the Zorvyn Finance Dashboard API. The goal of this backend is to provide a highly scalable, secure, and well-structured foundation for a financial analytics dashboard incorporating Role-Based Access Control (RBAC).

---

## 2. Technology Stack & Rationale

When selecting the stack, the primary considerations were **predictability (type safety)**, **developer ergonomics**, and **separation of concerns**.

| Technology | Justification (Why this and not something else?) |
|------------|--------------------------------------------------|
| **Node.js (Express)** | Chose Express over NestJS or fastify. While NestJS provides great out-of-the-box structure, Express is unopinionated. Building a structured layer-by-layer architecture from scratch in Express demonstrates a deep understanding of design patterns, middleware composition, and request lifecycles rather than relying on framework magic. |
| **TypeScript** | Crucial for a financial application. Catching type mismatches (e.g., treating a string as a monetary value) at compile-time rather than runtime is a requirement for modern backend systems. |
| **Prisma ORM** | Chose Prisma over TypeORM or Sequelize. Prisma generates a type-safe database client dynamically based on the schema. This removes the "impedance mismatch" between database joins and TypeScript objects, leading to extremely fast and safe database interactions. |
| **SQLite** | Selected for deployment simplicity. It requires zero setup or Docker configuration to run locally. However, thanks to Prisma, the entire backend can be migrated to PostgreSQL in minutes simply by changing the schema provider line. |
| **Zod** | Chose Zod over Joi or class-validator for input validation. Zod allows us to define runtime validation schemas that natively infer static TypeScript types, keeping our boundaries clean and our types DRY (Don't Repeat Yourself). |

---

## 3. Uniqueness of the Design

The application implements several advanced software engineering patterns that elevate it beyond a standard CRUD API.

### A. "Fat Services, Skinny Controllers"
The architecture strictly enforces that **Controllers** contain zero business logic. They are responsible only for validating HTTP requests (via Zod) and returning HTTP responses. All logic lives in the **Services**. This makes the application highly testable, as we can write unit tests for the services without needing to spin up mock HTTP servers or fake Express requests.

### B. Multi-Tenant Role Data Scoping
A standard beginner mistake in RBAC is to only protect the *endpoints*. While an Admin-only endpoint prevents unauthorized execution, an endpoint like `GET /api/transactions` is accessible to all roles. 

The uniqueness of this design is that the **data is scoped dynamically in the service layer** based on who is asking.
* If a `VIEWER` queries `/transactions`, the service secretly injects a `userId = req.user.id` filter into the database query.
* If an `ANALYST` makes the exact same request, the filter is omitted, granting platform-wide access for data aggregation.
This creates a powerful "multi-tenant" feel within a single unified API endpoint.

### C. Financial Safety (Soft Deletes)
In financial systems, data must never truly be destroyed, as it destroys historical audit trails and aggregates. We implemented a **Soft Delete** pattern. When an Admin calls `DELETE /api/transactions/:id`, the database record is not dropped. Instead, a `deletedAt` timestamp is populated. Every single GET query in the system automatically filters out records where `deletedAt IS NOT NULL`.

### D. Single-Source-of-Truth Error Handling
Error handling is not scattered across the controllers. If an entity is not found, the service throws a custom `ApiError(404, 'Not found')`. If a database constraint is violated, Prisma throws a `P2002` exception. All of these bubble down to a single `errorHandler.ts` middleware. This file serves as the system's catch-all, translating runtime logic errors, database exceptions, and validation failures into standard `status: false, message: string` API responses.

---

## 4. Fulfillment of Core Requirements

1. **User and Role Management:** Built out natively. Role assignments are strictly guarded by the `requireRole([Role.ADMIN])` middleware. User status management is handled via the `isActive` boolean.
2. **Financial Records Management:** Full Create, Read, Update, Delete (Soft-Delete) implemented. Advanced filtering operations (Date ranges, Category filtering, Type filtering) are completely functional.
3. **Dashboard Aggregations:** Handled intelligently. Instead of pulling all data into Node.js (which kills memory), aggregates like monthly trends are calculated natively inside SQLite using `strftime` via Raw Queries, returning O(1) mathematical aggregates over the wire.
4. **Validation:** 100% boundary validation. Every single body payload and query parameter is sanitized and typed using Zod before it touches the database. 

## 5. Conclusion
This backend was constructed with production-grade sensibilities. Security (token rotation, rate-limiting, Helmet headers), accuracy (Prisma Decimals, Soft Deletes), and code-cleanliness (Layered Architecture, Dependency Injection-friendly services) were prioritized over building a massive, untested monolith. The result is a robust core that is ready to scale.
