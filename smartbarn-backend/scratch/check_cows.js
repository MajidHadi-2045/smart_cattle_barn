const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cows = await prisma.livestock.findMany();
  for (const c of cows) {
    console.log(c.cattleId, 'Weight:', c.currentWeight || c.initialWeight, 'targetBkPercent:', c.targetBkPercent, 'forageRatio:', c.forageRatio, 'concentrateRatio:', c.concentrateRatio, 'concentrateDM:', c.concentrateDM);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
