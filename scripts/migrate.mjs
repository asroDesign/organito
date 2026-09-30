import 'dotenv/config';
import pg from 'pg';
import { readFile, readdir } from 'node:fs/promises';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
 await client.query('BEGIN');
 await client.query('SELECT pg_advisory_xact_lock(99125)');
 await client.query('CREATE TABLE IF NOT EXISTS app_migrations (tag text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
 const files=(await readdir(new URL('../drizzle/',import.meta.url))).filter(x=>/^\d{4}_.*\.sql$/.test(x)).sort();
 for(const tag of files){
  const {rows}=await client.query('SELECT tag FROM app_migrations WHERE tag=$1',[tag]);if(rows.length)continue;
  const base=tag.startsWith('0000_') && (await client.query("SELECT to_regclass('public.users') AS name")).rows[0].name;
  if(!base)await client.query(await readFile(new URL('../drizzle/'+tag,import.meta.url),'utf8'));
  await client.query('INSERT INTO app_migrations(tag) VALUES($1)',[tag]);
 }
 await client.query('COMMIT');console.log('Database migrations applied.');
} catch(e){await client.query('ROLLBACK');console.error('Migration failed:',e.code??e.name);process.exitCode=1;}finally{client.release();await pool.end();}
