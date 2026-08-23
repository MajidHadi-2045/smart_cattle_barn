const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cows = await prisma.livestock.findMany();
  console.log('PRISMA COWS:', cows);
}

main().catch(console.error).finally(() => prisma.$disconnect());
