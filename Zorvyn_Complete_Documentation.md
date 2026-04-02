# Zorvyn Finance Dashboard - Complete Documentation

This document consolidates the engineering report, architecture flow, and the technical challenges faced during the development of the Zorvyn Finance Dashboard API.

---

## 1. Backend Architecture & Data Flow

The application is built using a strict **3-Tier Layered Architecture** (Routes → Controllers → Services). This separation of concerns ensures that the application is highly testable, maintainable, and scalable.

### Architecture Diagram

```mermaid
flowchart TD
    %% Define Client Layer
    Client((Client App / Browser))

    %% Define Node.js Express Layer
    subgraph Express Application [Express.js Backend Server]
        direction TB
        
        %% Global Middlewares
        GlobalMid[Global Middleware\n- Helmet, CORS\n- Morgan Logger\n- Global Rate Limiter]
        
        %% Router
        Router{Express Router}
        
        %% Route Specific Middlewares
        AuthMid[Auth Middleware\n- Validates JWT\n- Fetches User]
        RBACMid[RBAC Middleware\n- requireRole() check]
        
        %% Controllers
        Controllers[API Controllers\n- Validates input via Zod\n- Formats API responses]
        
        %% Services (Business Logic)
        subgraph Business Logic [Service Layer]
            Auth[Auth Service]
            User[Users Service]
            Tx[Transactions Service]
            Dash[Analytics & Dashboard\nService]
        end
        
        %% Error Handler
        GlobalErr[Global Error Handler\n- Catches Exceptions\n- Formats proper HTTP status]
    end

    %% Define Database Layer
    subgraph Database Layer [Persistence]
        Prisma[(Prisma ORM)]
        SQLite[(SQLite Database)]
    end

    %% Map the relationships (The Flow)
    Client -- "HTTP Request" --> GlobalMid
    GlobalMid --> Router
    Router -- "Unprotected Route" --> Controllers
    Router -- "Protected Route" --> AuthMid
    AuthMid -- "Valid Token" --> RBACMid
    RBACMid -- "Has Permission" --> Controllers
    
    Controllers -- "Throws Error" -.-> GlobalErr
    AuthMid -. "Invalid Token" .-> GlobalErr
    RBACMid -. "Forbidden" .-> GlobalErr
    
    Controllers -- "Calls Method" --> Business Logic
    
    Auth <--> Prisma
    User <--> Prisma
    Tx <--> Prisma
    Dash <--> Prisma
    
    Prisma <--> SQLite
    
    GlobalErr -. "JSON Error Response" .-> Client
    Controllers -- "JSON Response" --> Client
```

### Request Flow Explanation

When an HTTP request enters the system, it follows a strict pipeline:

1. **Global Middleware Stage**: Every incoming request first passes through `helmet` (security headers), `cors`, the Morgan logger, and the global rate limiter (to prevent DDoS/spamming).
2. **Authentication & Authorization Stage**: If the route is protected, it hits two critical middlewares:
    * **Auth Middleware**: Extracts the JWT Bearer token, verifies its signature using `jsonwebtoken`, looks up the user in the database to ensure they haven't been deactivated, and attaches the safe `req.user` object to the request.
    * **RBAC Middleware**: A higher-order function (`requireRole`) checks if the user's role exists in the allowed list for that specific endpoint. 
3. **Controller Stage (Input Validation)**: The controller's only job is the boundary layer. It takes the raw `req.body` or `req.query` and passes it through a **Zod Schema**. If validation fails, it throws a `ZodError` ending the request. If it succeeds, it extracts the validated payload and calls a specific method in the Service Layer.
4. **Service Stage (Business Logic)**: This is the core of the application. The Service layer contains all decision-making logic, financial data calculations, role-based database scoping, and error throwing.
5. **ORM & Database Stage**: The Service layer communicates with the SQLite database exclusively through the Prisma Client. Prisma handles connection pooling, type-safe queries, and migrating raw SQL results into TypeScript objects.
6. **Response / Error Stage**: If everything succeeds, the Controller wraps the service data in an `ApiResponse` standard class and replies to the client. If *any* error occurs anywhere in the pipeline, it bubbles down to the **Global Error Handler** middleware.

---

## 2. Technology Stack & Rationale

When selecting the stack, the primary considerations were **predictability (type safety)**, **developer ergonomics**, and **separation of concerns**.

| Technology | Justification (Why this and not something else?) |
|------------|--------------------------------------------------|
| **Node.js (Express)** | Chose Express over NestJS or fastify. While NestJS provides great out-of-the-box structure, Express is unopinionated. Building a structured layer-by-layer architecture from scratch in Express demonstrates a deep understanding of design patterns, middleware composition, and request lifecycles rather than relying on framework magic. |
| **TypeScript** | Crucial for a financial application. Catching type mismatches (e.g., treating a string as a monetary value) at compile-time rather than runtime is a requirement for modern backend systems. |
| **Prisma ORM** | Chose Prisma over TypeORM or Sequelize. Prisma generates a type-safe database client dynamically based on the schema. This removes the "impedance mismatch" between database joins and TypeScript objects, leading to extremely fast and safe database interactions. |
| **SQLite** | Selected for deployment simplicity. It requires zero setup or Docker configuration to run locally. However, thanks to Prisma, the entire backend can be migrated to PostgreSQL in minutes simply by changing the schema provider line. |
| **Zod** | Chose Zod over Joi or class-validator for input validation. Zod allows us to define runtime validation schemas that natively infer static TypeScript types, keeping our boundaries clean and our types DRY. |

---

## 3. Uniqueness of the Design

The application implements several advanced software engineering patterns that elevate it beyond a standard CRUD API.

### A. "Fat Services, Skinny Controllers"
The architecture strictly enforces that **Controllers** contain zero business logic. They are responsible only for validating HTTP requests (via Zod) and returning HTTP responses. All logic lives in the **Services**. This makes the application highly testable, as we can write unit tests for the services without needing to spin up mock HTTP servers or fake Express requests.

### B. Multi-Tenant Role Data Scoping
A standard beginner mistake in RBAC is to only protect the *endpoints*. While an Admin-only endpoint prevents unauthorized execution, an endpoint like `GET /api/transactions` is accessible to all roles. 

The uniqueness of this design is that the **data is scoped dynamically in the service layer** based on who is asking:
* If a `VIEWER` queries `/transactions`, the service secretly injects a `userId = req.user.id` filter into the database query.
* If an `ANALYST` makes the exact same request, the filter is omitted, granting platform-wide access for data aggregation.

This creates a powerful "multi-tenant" feel within a single unified API endpoint.

### C. Financial Safety (Soft Deletes)
In financial systems, data must never truly be destroyed, as it destroys historical audit trails and aggregates. We implemented a **Soft Delete** pattern. When an Admin calls `DELETE /api/transactions/:id`, the database record is not dropped. Instead, a `deletedAt` timestamp is populated. Every single GET query in the system automatically filters out records where `deletedAt IS NOT NULL`.

### D. Single-Source-of-Truth Error Handling
Error handling is not scattered across the controllers. If an entity is not found, the service throws a custom `ApiError(404, 'Not found')`. If a database constraint is violated, Prisma throws a `P2002` exception. All of these bubble down to a single `errorHandler.ts` middleware, translating runtime logic errors, database exceptions, and validation failures into standard `status: false, message: string` API responses.

---

## 4. Challenges Faced & Solutions

During the development of the API, several interesting technical challenges were encountered and resolved.

### A. Complex Date Bucketing for Analytics in SQLite

**The Challenge:** The dashboard required aggregated financial trends (e.g., grouping income and expenses by month). While PostgreSQL has robust native date-truncation functions, SQLite's date handling is much more limited. Standard Prisma ORM features (`groupBy`) do not natively support bucketing by arbitrary date periods in SQLite.

**The Solution:** Instead of pulling all transactions into application memory and grouping them via JavaScript (which would cause a massive memory bottleneck at scale), we opted to drop down to a raw SQL query using Prisma's `$queryRawUnsafe` combined with SQLite's `strftime` function. This allowed the database to perform the heavy lifting of the aggregation, returning a tiny payload to the Node.js server.

### B. Multi-Tenant Data Scoping (Role-Based Filtering)

**The Challenge:** Implementing Role-Based Access Control (RBAC) at the route level is straightforward, but the project required *data-level* scoping — a VIEWER can hit the `GET /transactions` endpoint, but they must *only* see their own data, whereas an ANALYST hitting the exact same endpoint should see *all* data. 

**The Solution:** Solved by keeping the Controller completely unaware of the data scoping logic. The Controller simply passes the user's ID and Role down to the Service layer. Inside the Service layer, the Prisma `where` clause is dynamically constructed. This guarantees that data isolation logic cannot be accidentally bypassed by a new route endpoint.

### C. Financial Precision and Floating-Point Errors

**The Challenge:** JavaScript uses IEEE 754 double-precision floats for standard numbers. This introduces rounding errors when performing financial math. Absolute mathematical precision is non-negotiable for a finance dashboard.

**The Solution:** Defined the `amount` column in the Prisma Schema as a `Decimal` type. In the Node.js application layer, the `decimal.js` library is used to handle all financial inputs and calculations. The backend converts the precise Decimals back into numbers only at the very final step before JSON serialization to the client.

### D. Balancing Security with User Experience

**The Challenge:** Handling security tokens properly while maintaining a modern user experience. Short-lived tokens are secure but log users out too frequently. Long-lived tokens are convenient but dangerous if compromised.

**The Solution:** Architected a robust token rotation strategy. 
1. The API issues a short-lived **Access Token** (15 minutes).
2. It simultaneously issues a cryptographically secure, long-lived **Refresh Token** (7 days), which is hashed and stored in the database.
When the access token expires, the client uses the refresh token to get a new pair. A **Refresh Token Rotation** strategy was implemented so that every time a refresh token is used, it is deleted from the database and a new one is issued, limiting the replay window drastically.

### E. Preventing User Enumeration Attacks

**The Challenge:** In standard login flows, telling the client "User not found" vs "Incorrect password" is a security vulnerability, allowing attackers to ping the API to discover valid email addresses.

**The Solution:** Unified the error handling in the `login` service. Regardless of whether the email does not exist, or the password is wrong, the service universally throws a `401 Unauthorized` with the exact same constant message. The timing attack vector was also mitigated by global rate limiting on the authentication routes.

---

## 5. Conclusion

This backend was constructed with production-grade sensibilities. Security (token rotation, rate-limiting, Helmet headers), accuracy (Prisma Decimals, Soft Deletes), and code-cleanliness (Layered Architecture, Dependency Injection-friendly services) were prioritized over building a massive, untested monolith. The result is a robust core that is ready to scale.
