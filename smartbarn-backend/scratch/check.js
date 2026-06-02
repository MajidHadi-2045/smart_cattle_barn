const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function run() {
  try {
    const zonesCount = await p.zone.count();
    const sectionsCount = await p.section.count();
    const envDataCount = await p.environmentData.count();
    console.log({ zonesCount, sectionsCount, envDataCount });
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
