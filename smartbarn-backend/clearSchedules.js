const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  await prisma.feedingSchedule.deleteMany({});
  console.log('Deleted all schedules');
  await prisma.$disconnect();
}
run();
