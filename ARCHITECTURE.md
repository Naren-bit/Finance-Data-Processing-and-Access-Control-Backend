# Backend Architecture & Data Flow

This document outlines the high-level architecture of the Zorvyn Finance Dashboard API. 

The application is built using a strict **3-Tier Layered Architecture** (Routes → Controllers → Services). This separation of concerns ensures that the application is highly testable, maintainable, and scalable.

## Architecture Diagram

```mermaid
flowchart TD
    %% Define Client Layer
    Client((Client App / Browser))

    %% Define Node.js Express Layer
    subgraph Express Application [Express.js Backend Server]
        direction TB
        
        %% Global Middlewares
        GlobalMid["Global Middleware<br>- Helmet, CORS<br>- Morgan Logger<br>- Global Rate Limiter"]
        
        %% Router
        Router{Express Router}
        
        %% Route Specific Middlewares
        AuthMid["Auth Middleware<br>- Validates JWT<br>- Fetches User"]
        RBACMid["RBAC Middleware<br>- requireRole() check"]
        
        %% Controllers
        Controllers["API Controllers<br>- Validates input via Zod<br>- Formats API responses"]
        
        %% Services (Business Logic)
        subgraph Business Logic [Service Layer]
            Auth[Auth Service]
            User[Users Service]
            Tx[Transactions Service]
            Dash["Analytics & Dashboard<br>Service"]
        end
        
        %% Error Handler
        GlobalErr["Global Error Handler<br>- Catches Exceptions<br>- Formats proper HTTP status"]
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

## Request Flow Explanation

When an HTTP request enters the system, it follows a strict pipeline:

### 1. Global Middleware Stage
Every incoming request first passes through `helmet` (security headers), `cors`, the Morgan logger, and the global rate limiter (to prevent DDoS/spamming).

### 2. Authentication & Authorization Stage
If the route is protected, it hits two critical middlewares:
* **Auth Middleware:** Extracts the JWT Bearer token, verifies its signature using `jsonwebtoken`, looks up the user in the database to ensure they haven't been deactivated, and attaches the safe `req.user` object to the request.
* **RBAC Middleware:** A higher-order function (`requireRole`) checks if the user's role exists in the allowed list for that specific endpoint. 

### 3. Controller Stage (Input Validation)
The controller's only job is the boundary layer. It takes the raw `req.body` or `req.query` and passes it through a **Zod Schema**. If validation fails, it throws a `ZodError` ending the request. If it succeeds, it extracts the validated payload and calls a specific method in the Service Layer.

### 4. Service Stage (Business Logic)
This is the core of the application. The Service layer contains all decision-making logic, financial data calculations, role-based database scoping, and error throwing (e.g., throwing a 404 if a transaction ID is invalid). 

### 5. ORM & Database Stage
The Service layer communicates with the SQLite database exclusively through the Prisma Client. Prisma handles connection pooling, type-safe queries, and migrating raw SQL results into TypeScript objects.

### 6. Response / Error Stage
If everything succeeds, the Controller wraps the service data in an `ApiResponse` standard class and replies to the client. If *any* error occurs anywhere in the pipeline (a failed Zod validation, a Prisma unique constraint violation code `P2002`, or an intentional `ApiError`), it bubbles down to the **Global Error Handler** middleware. This ensures that the client always receives a consistently formatted JSON error and the server never crashes or leaks stack traces in production.
