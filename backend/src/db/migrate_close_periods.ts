import { pool } from '../config/database';

const migrate = async () => {
  const client = await pool.connect();
  try {
    console.log('Running close periods and rejected transactions migrations...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS closed_periods (
        id SERIAL PRIMARY KEY,
        period_type VARCHAR(10) NOT NULL CHECK (period_type IN ('month', 'year')),
        period_name VARCHAR(20) UNIQUE NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        closed_at TIMESTAMP DEFAULT NOW(),
        closed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE SET NULL
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS rejected_transactions (
        id SERIAL PRIMARY KEY,
        reference VARCHAR(100) UNIQUE NOT NULL,
        rejected_at TIMESTAMP DEFAULT NOW(),
        rejected_by INTEGER REFERENCES users(id) ON DELETE SET NULL
      );
    `);
    console.log('✅ Tables closed_periods and rejected_transactions created successfully!');
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

migrate();
