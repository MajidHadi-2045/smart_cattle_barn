const Redis = require('ioredis');
const redis = new Redis({ host: 'localhost', port: 6379 });

async function main() {
  await redis.del('users:staff-list');
  console.log('Cache users:staff-list deleted');
}

main().catch(console.error).finally(() => redis.disconnect());
