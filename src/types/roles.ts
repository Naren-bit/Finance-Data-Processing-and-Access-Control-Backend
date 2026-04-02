/**
 * Application role definitions.
 * SQLite doesn't support native enums, so we define them at the application level
 * and enforce them via Zod validation at every API boundary.
 */

export enum Role {
  VIEWER = 'VIEWER',
  ANALYST = 'ANALYST',
  ADMIN = 'ADMIN',
}

export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum Category {
  SALARY = 'SALARY',
  FREELANCE = 'FREELANCE',
  INVESTMENT = 'INVESTMENT',
  FOOD = 'FOOD',
  RENT = 'RENT',
  UTILITIES = 'UTILITIES',
  TRANSPORT = 'TRANSPORT',
  HEALTHCARE = 'HEALTHCARE',
  ENTERTAINMENT = 'ENTERTAINMENT',
  OTHER = 'OTHER',
}
