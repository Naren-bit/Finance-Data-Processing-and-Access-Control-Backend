# Challenges Faced & Solutions

During the development of the Zorvyn Finance Dashboard API, I encountered several interesting technical challenges. Here is a breakdown of the most significant challenges and how I architecturalized solutions for them.

## 1. Complex Date Bucketing for Analytics in SQLite

**The Challenge:**
The dashboard required aggregated financial trends (e.g., grouping income and expenses by month or week). While full-scale databases like PostgreSQL have robust native date-truncation functions (`date_trunc`), SQLite's date handling is much more limited. Standard Prisma ORM features (`groupBy`) do not natively support bucketing by arbitrary date periods in SQLite.

**The Solution:**
Instead of pulling all transactions into application memory and grouping them via JavaScript (which would cause a massive memory bottleneck at scale), I opted to drop down to a raw SQL query. I used Prisma's `$queryRawUnsafe` combined with SQLite's `strftime` function.
```sql
SELECT 
  strftime('%Y-%m', t."date") as period,
  t."type",
  SUM(CAST(t."amount" AS REAL)) as total
FROM "Transaction" t
GROUP BY period, t."type"
```
This allowed the database to perform the heavy lifting of the aggregation, returning a tiny payload to the Node.js server. I then pivoted this raw data in the service layer to create user-friendly `{ period, income, expenses, net }` objects.

## 2. Multi-Tenant Data Scoping (Role-Based Filtering)

**The Challenge:**
Implementing Role-Based Access Control (RBAC) at the route level (e.g., "Only Admins can hit this endpoint") is straightforward. However, the assignment required *data-level* scoping — a VIEWER can hit the `GET /transactions` endpoint, but they must *only* see their own data, whereas an ANALYST hitting the exact same endpoint should see *all* data. 

**The Solution:**
I solved this by keeping the Controller completely unaware of the data scoping logic. The Controller simply passes the user's ID and Role down to the Service layer. Inside the Service layer, I dynamically construct the Prisma `where` clause:
```typescript
const where: Prisma.TransactionWhereInput = { deletedAt: null };
if (userRole === Role.VIEWER) {
  where.userId = userId; // Force scope to own records
}
```
This guarantees that data isolation logic cannot be accidentally bypassed by a new route endpoint, as the security check happens right before the database query execution.

## 3. Financial Precision and Floating-Point Errors

**The Challenge:**
JavaScript uses IEEE 754 double-precision floats for standard numbers. This introduces rounding errors when performing financial math (e.g., `0.1 + 0.2 = 0.30000000000000004`). For a financial dashboard, absolute mathematical precision is non-negotiable.

**The Solution:**
I defined the `amount` column in the Prisma Schema as a `Decimal` type. In the Node.js application layer, I used the `decimal.js` library (which Prisma leverages under the hood) to handle all financial inputs and calculations. The backend converts the precise Decimals back into numbers only at the very final step before JSON serialization to the client, ensuring mathematical integrity throughout the request lifecycle.

## 4. Balancing Security with User Experience

**The Challenge:**
Handling security tokens properly while maintaining a modern user experience. Short-lived tokens are secure but log users out too frequently. Long-lived tokens are convenient but dangerous if compromised.

**The Solution:**
I architected a token rotation strategy. 
1. The API issues a short-lived **Access Token** (15 minutes).
2. It simultaneously issues a cryptographically secure, long-lived **Refresh Token** (7 days), which is hashed and stored in the database.
3. When the access token expires, the client uses the refresh token to get a new pair.
Crucially, I implemented **Refresh Token Rotation**: every time a refresh token is used, it is deleted from the database and a new one is issued. This limits the replay window drastically if a token is intercepted.

## 5. Preventing User Enumeration Attacks

**The Challenge:**
In standard login flows, telling the client "User not found" vs "Incorrect password" is a security vulnerability, as it allows attackers to ping the API to discover which email addresses exist in our system.

**The Solution:**
I unified the error handling in the `login` service. Regardless of whether the email does not exist, or the password is wrong, the service universally throws a `401 Unauthorized` with the exact same constant message: `"Invalid credentials"`. The timing attack vector was also mitigated by global rate limiting on the authentication routes (10 requests per 15 minutes).
