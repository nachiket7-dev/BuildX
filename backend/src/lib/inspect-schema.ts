import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  const res = await pool.query("SELECT blueprint FROM blueprints WHERE id = 'm9P1dV54'");
  if (res.rows.length === 0) {
    console.log('MedConnect blueprint not found');
  } else {
    const bp = JSON.parse(res.rows[0].blueprint);
    console.log('MedConnect Architecture:', JSON.stringify(bp.architecture, null, 2));
    console.log('MedConnect Schema:', JSON.stringify(bp.schema, null, 2));
    console.log('MedConnect Code Files keys:', bp.code?.files ? Object.keys(bp.code.files) : 'No files');
  }
  process.exit(0);
}

run().catch(console.error);
