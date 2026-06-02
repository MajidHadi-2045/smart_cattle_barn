const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log('Current users:', users.map(u => ({ email: u.email, role: u.role })));
  
  // Fix roles if they are lowercase
  for (const user of users) {
    let newRole = user.role;
    if (user.role === 'staff') newRole = 'KANDANG';
    if (user.role === 'manager') newRole = 'MANAGER';
    if (user.role === 'super_admin') newRole = 'SUPER_ADMIN';
    
    if (newRole !== user.role) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: newRole }
      });
      console.log(`Updated user ${user.email} role from ${user.role} to ${newRole}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
