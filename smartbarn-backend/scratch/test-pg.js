const { Client } = require('pg');

const client = new Client({
  connectionString: "postgresql://adminvps:pwdDB%40123@77.37.63.21:5432/smartcattlebarn?sslmode=disable",
});

async function test() {
  try {
    console.log('Connecting via pg driver...');
    await client.connect();
    console.log('Successfully connected via pg driver!');
    const res = await client.query('SELECT NOW()');
    console.log('Query result:', res.rows[0]);
  } catch (err) {
    console.error('Connection failed via pg driver:');
    console.error(err);
  } finally {
    await client.end();
  }
}

test();
