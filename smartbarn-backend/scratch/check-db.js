
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const livestockCount = await prisma.livestock.count();
  console.log('Livestock Count:', livestockCount);
  
  const vitalsCount = await prisma.livestockVital.count();
  console.log('LivestockVital Count:', vitalsCount);
  
  const envDataCount = await prisma.environmentData.count();
  console.log('EnvironmentData Count:', envDataCount);

  const livestock = await prisma.livestock.findMany();
  console.log('Livestock:', livestock);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
