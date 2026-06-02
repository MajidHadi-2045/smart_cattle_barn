const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing connection...');
    await prisma.$connect();
    console.log('Successfully connected to the database!');
    const users = await prisma.user.findMany({ take: 1 });
    console.log('Query successful, found users:', users.length);
  } catch (e) {
    console.error('Connection failed:');
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
