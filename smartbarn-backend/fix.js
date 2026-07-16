const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  await prisma.livestock.updateMany({
    where: { cattleId: 'C-500' },
    data: { initialWeight: 250, currentWeight: 250 }
  });
  
  await prisma.livestockWeightRecord.updateMany({
    where: { cattleId: 'C-500' },
    data: { weight: 250 }
  });
  
  console.log('Fixed C-500');
  process.exit(0);
}

fix();
