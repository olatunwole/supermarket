import { pool } from '../config/database';

async function run() {
  const client = await pool.connect();
  try {
    const tenantRes = await client.query("SELECT * FROM tenants WHERE subdomain = 'afroauthentic'");
    console.log('TENANT RECORD:', tenantRes.rows);

    if (tenantRes.rows[0]) {
      const userRes = await client.query("SELECT id, username, email, role, is_active FROM users WHERE tenant_id = $1", [tenantRes.rows[0].id]);
      console.log('USER RECORDS FOR TENANT:', userRes.rows);
    } else {
      console.log("No tenant found with subdomain 'afroauthentic'");
    }
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
