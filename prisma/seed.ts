import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;

/**
 * Seed script — creates 3 users and 60 realistic transactions.
 * Run with: npx ts-node prisma/seed.ts
 */
async function main(): Promise<void> {
  console.log('🌱 Starting database seed...');
  console.log('');

  // ─── Clean existing data ────────────────────────────────────────────────
  await prisma.refreshToken.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.user.deleteMany();
  console.log('  ✓ Cleaned existing data');

  // ─── Create Users ───────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin123!', BCRYPT_ROUNDS);
  const analystPassword = await bcrypt.hash('Analyst123!', BCRYPT_ROUNDS);
  const viewerPassword = await bcrypt.hash('Viewer123!', BCRYPT_ROUNDS);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@zorvyn.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
      isActive: true,
    },
  });

  const analyst = await prisma.user.create({
    data: {
      email: 'analyst@zorvyn.com',
      passwordHash: analystPassword,
      role: 'ANALYST',
      isActive: true,
    },
  });

  const viewer = await prisma.user.create({
    data: {
      email: 'viewer@zorvyn.com',
      passwordHash: viewerPassword,
      role: 'VIEWER',
      isActive: true,
    },
  });

  console.log('  ✓ Created 3 users:');
  console.log(`    • admin@zorvyn.com   (ADMIN)   — Password: Admin123!`);
  console.log(`    • analyst@zorvyn.com (ANALYST) — Password: Analyst123!`);
  console.log(`    • viewer@zorvyn.com  (VIEWER)  — Password: Viewer123!`);

  // ─── Create Transactions ────────────────────────────────────────────────
  // 60 realistic transactions spread across 3 users and 6 months
  // Roughly 30/70 income/expense split (more expenses is realistic)

  const users = [admin, analyst, viewer];
  const now = new Date();

  /**
   * Generates a random date within the last N months.
   */
  function randomDate(monthsBack: number): Date {
    const date = new Date(now);
    date.setMonth(date.getMonth() - Math.floor(Math.random() * monthsBack));
    date.setDate(1 + Math.floor(Math.random() * 28)); // Avoid invalid dates
    date.setHours(Math.floor(Math.random() * 12) + 8); // Business hours
    date.setMinutes(Math.floor(Math.random() * 60));
    return date;
  }

  /**
   * Generates a random amount within a range, rounded to 2 decimal places.
   */
  function randomAmount(min: number, max: number): number {
    return Math.round((min + Math.random() * (max - min)) * 100) / 100;
  }

  // Transaction templates — realistic Indian fintech context (INR amounts)
  const transactionTemplates = [
    // INCOME transactions (~18 records)
    { type: 'INCOME', category: 'SALARY', amount: () => randomAmount(40000, 80000), description: 'Monthly salary - October' },
    { type: 'INCOME', category: 'SALARY', amount: () => randomAmount(45000, 85000), description: 'Monthly salary - November' },
    { type: 'INCOME', category: 'SALARY', amount: () => randomAmount(42000, 78000), description: 'Monthly salary - December' },
    { type: 'INCOME', category: 'SALARY', amount: () => randomAmount(50000, 90000), description: 'Monthly salary - January' },
    { type: 'INCOME', category: 'SALARY', amount: () => randomAmount(48000, 82000), description: 'Monthly salary - February' },
    { type: 'INCOME', category: 'SALARY', amount: () => randomAmount(55000, 95000), description: 'Monthly salary - March' },
    { type: 'INCOME', category: 'FREELANCE', amount: () => randomAmount(8000, 25000), description: 'Freelance project - UI Design' },
    { type: 'INCOME', category: 'FREELANCE', amount: () => randomAmount(10000, 30000), description: 'Freelance project - API Development' },
    { type: 'INCOME', category: 'FREELANCE', amount: () => randomAmount(5000, 15000), description: 'Freelance project - Logo Design' },
    { type: 'INCOME', category: 'INVESTMENT', amount: () => randomAmount(2000, 8000), description: 'Mutual fund dividend' },
    { type: 'INCOME', category: 'INVESTMENT', amount: () => randomAmount(3000, 12000), description: 'Stock dividend - Reliance' },
    { type: 'INCOME', category: 'INVESTMENT', amount: () => randomAmount(1500, 5000), description: 'Fixed deposit interest' },
    { type: 'INCOME', category: 'OTHER', amount: () => randomAmount(500, 3000), description: 'Cashback reward' },
    { type: 'INCOME', category: 'OTHER', amount: () => randomAmount(2000, 10000), description: 'Birthday gift received' },
    { type: 'INCOME', category: 'FREELANCE', amount: () => randomAmount(12000, 35000), description: 'Freelance project - Mobile App' },
    { type: 'INCOME', category: 'SALARY', amount: () => randomAmount(10000, 20000), description: 'Performance bonus Q4' },
    { type: 'INCOME', category: 'INVESTMENT', amount: () => randomAmount(5000, 15000), description: 'PPF interest credited' },
    { type: 'INCOME', category: 'OTHER', amount: () => randomAmount(1000, 5000), description: 'Tax refund' },

    // EXPENSE transactions (~42 records)
    { type: 'EXPENSE', category: 'RENT', amount: () => randomAmount(15000, 25000), description: 'Monthly rent - January' },
    { type: 'EXPENSE', category: 'RENT', amount: () => randomAmount(15000, 25000), description: 'Monthly rent - February' },
    { type: 'EXPENSE', category: 'RENT', amount: () => randomAmount(15000, 25000), description: 'Monthly rent - March' },
    { type: 'EXPENSE', category: 'RENT', amount: () => randomAmount(15000, 25000), description: 'Monthly rent - October' },
    { type: 'EXPENSE', category: 'RENT', amount: () => randomAmount(15000, 25000), description: 'Monthly rent - November' },
    { type: 'EXPENSE', category: 'RENT', amount: () => randomAmount(15000, 25000), description: 'Monthly rent - December' },
    { type: 'EXPENSE', category: 'FOOD', amount: () => randomAmount(200, 1500), description: 'Grocery run - BigBazaar' },
    { type: 'EXPENSE', category: 'FOOD', amount: () => randomAmount(300, 2000), description: 'Weekly groceries - DMart' },
    { type: 'EXPENSE', category: 'FOOD', amount: () => randomAmount(150, 800), description: 'Zomato order - dinner' },
    { type: 'EXPENSE', category: 'FOOD', amount: () => randomAmount(250, 1200), description: 'Swiggy order - lunch' },
    { type: 'EXPENSE', category: 'FOOD', amount: () => randomAmount(500, 3000), description: 'Restaurant dinner - family' },
    { type: 'EXPENSE', category: 'FOOD', amount: () => randomAmount(100, 600), description: 'Chai and snacks - office canteen' },
    { type: 'EXPENSE', category: 'UTILITIES', amount: () => randomAmount(800, 2500), description: 'Electricity bill - BESCOM' },
    { type: 'EXPENSE', category: 'UTILITIES', amount: () => randomAmount(400, 1200), description: 'Internet bill - Airtel' },
    { type: 'EXPENSE', category: 'UTILITIES', amount: () => randomAmount(300, 800), description: 'Mobile recharge - Jio' },
    { type: 'EXPENSE', category: 'UTILITIES', amount: () => randomAmount(200, 600), description: 'Water bill' },
    { type: 'EXPENSE', category: 'TRANSPORT', amount: () => randomAmount(100, 500), description: 'Ola cab - office commute' },
    { type: 'EXPENSE', category: 'TRANSPORT', amount: () => randomAmount(2000, 5000), description: 'Petrol refill - HP' },
    { type: 'EXPENSE', category: 'TRANSPORT', amount: () => randomAmount(200, 800), description: 'Metro pass - monthly' },
    { type: 'EXPENSE', category: 'TRANSPORT', amount: () => randomAmount(100, 400), description: 'Auto rickshaw - market trip' },
    { type: 'EXPENSE', category: 'TRANSPORT', amount: () => randomAmount(3000, 8000), description: 'Train ticket - Bengaluru to Chennai' },
    { type: 'EXPENSE', category: 'HEALTHCARE', amount: () => randomAmount(500, 3000), description: 'Apollo pharmacy - medicines' },
    { type: 'EXPENSE', category: 'HEALTHCARE', amount: () => randomAmount(1000, 5000), description: 'Doctor consultation - general' },
    { type: 'EXPENSE', category: 'HEALTHCARE', amount: () => randomAmount(2000, 8000), description: 'Dental checkup and cleaning' },
    { type: 'EXPENSE', category: 'HEALTHCARE', amount: () => randomAmount(1500, 4000), description: 'Health insurance premium' },
    { type: 'EXPENSE', category: 'ENTERTAINMENT', amount: () => randomAmount(200, 800), description: 'Netflix subscription' },
    { type: 'EXPENSE', category: 'ENTERTAINMENT', amount: () => randomAmount(300, 1000), description: 'PVR movie tickets' },
    { type: 'EXPENSE', category: 'ENTERTAINMENT', amount: () => randomAmount(500, 2000), description: 'Spotify premium - annual' },
    { type: 'EXPENSE', category: 'ENTERTAINMENT', amount: () => randomAmount(1000, 5000), description: 'Weekend trip - Coorg' },
    { type: 'EXPENSE', category: 'ENTERTAINMENT', amount: () => randomAmount(200, 600), description: 'Books - Amazon order' },
    { type: 'EXPENSE', category: 'OTHER', amount: () => randomAmount(500, 3000), description: 'Clothing - Myntra sale' },
    { type: 'EXPENSE', category: 'OTHER', amount: () => randomAmount(200, 1000), description: 'Haircut and grooming' },
    { type: 'EXPENSE', category: 'OTHER', amount: () => randomAmount(1000, 5000), description: 'Gift for friend - birthday' },
    { type: 'EXPENSE', category: 'OTHER', amount: () => randomAmount(2000, 8000), description: 'Electronics - Amazon' },
    { type: 'EXPENSE', category: 'FOOD', amount: () => randomAmount(400, 1800), description: 'Monthly vegetables - local market' },
    { type: 'EXPENSE', category: 'UTILITIES', amount: () => randomAmount(500, 1500), description: 'Gas cylinder refill' },
    { type: 'EXPENSE', category: 'TRANSPORT', amount: () => randomAmount(150, 600), description: 'Uber ride - airport drop' },
    { type: 'EXPENSE', category: 'ENTERTAINMENT', amount: () => randomAmount(500, 2000), description: 'Gaming subscription - PlayStation' },
    { type: 'EXPENSE', category: 'OTHER', amount: () => randomAmount(300, 1500), description: 'Stationery and supplies' },
    { type: 'EXPENSE', category: 'HEALTHCARE', amount: () => randomAmount(800, 3000), description: 'Eye checkup and new glasses' },
    { type: 'EXPENSE', category: 'FOOD', amount: () => randomAmount(600, 2500), description: 'Bulk grocery - monthly stock' },
    { type: 'EXPENSE', category: 'RENT', amount: () => randomAmount(2000, 5000), description: 'Society maintenance charges' },
  ];

  // Create transactions spread across users
  let transactionCount = 0;
  const monthOffsets = [0, 1, 2, 3, 4, 5]; // Last 6 months

  for (let i = 0; i < transactionTemplates.length; i++) {
    const template = transactionTemplates[i];
    const user = users[i % 3]; // Distribute across users
    const monthOffset = monthOffsets[i % monthOffsets.length];

    const date = new Date(now);
    date.setMonth(date.getMonth() - monthOffset);
    date.setDate(1 + Math.floor(Math.random() * 28));
    date.setHours(Math.floor(Math.random() * 12) + 8);
    date.setMinutes(Math.floor(Math.random() * 60));

    await prisma.transaction.create({
      data: {
        userId: user.id,
        amount: template.amount(),
        type: template.type,
        category: template.category,
        date,
        description: template.description,
      },
    });

    transactionCount++;
  }

  console.log(`  ✓ Created ${transactionCount} transactions across 3 users`);
  console.log('');
  console.log('🌱 Seed completed successfully!');
  console.log('');
  console.log('You can now start the server with: npm run dev');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
