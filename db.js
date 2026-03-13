// db.js — PostgreSQL connection + schema init + seed data
// รองรับ Railway (DATABASE_URL) และ local (DB_HOST ฯลฯ)

require('dotenv').config();
const { Pool } = require('pg');

// ─── Pool ──────────────────────────────────────────────────────────────────────
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }, // Railway TLS
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis:       30000,
        max: 10,
      }
    : {
        host:     process.env.DB_HOST     || 'localhost',
        port:     Number(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME     || 'crmdb',
        user:     process.env.DB_USER     || process.env.USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        connectionTimeoutMillis: 10000,
      }
);

// ─── initDB ────────────────────────────────────────────────────────────────────
async function initDB() {
  const client = await pool.connect();
  try {
    // ── contacts ──────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(100) NOT NULL,
        company    VARCHAR(100),
        email      VARCHAR(100) NOT NULL UNIQUE,
        phone      VARCHAR(20),
        status     VARCHAR(20) NOT NULL DEFAULT 'lead'
                   CHECK (status IN ('lead','prospect','customer','inactive')),
        tags       TEXT,
        notes      TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // ── deals ─────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS deals (
        id         SERIAL PRIMARY KEY,
        contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
        title      VARCHAR(200) NOT NULL,
        value      DECIMAL(10,2) DEFAULT 0,
        stage      VARCHAR(30) NOT NULL DEFAULT 'new'
                   CHECK (stage IN ('new','contacted','proposal','negotiation','won','lost')),
        close_date DATE,
        notes      TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // ── safe migrations (IF NOT EXISTS) ───────────────────────────────────────
    await client.query(`
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tags       TEXT;
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notes      TEXT;
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
      ALTER TABLE deals    ADD COLUMN IF NOT EXISTS close_date DATE;
      ALTER TABLE deals    ADD COLUMN IF NOT EXISTS notes      TEXT;
    `);

    console.log('✅ initDB: tables ready');
  } finally {
    client.release();
  }
}

// ─── seedData ──────────────────────────────────────────────────────────────────
async function seedData() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT COUNT(*) FROM contacts');
    if (parseInt(rows[0].count) > 0) {
      console.log('ℹ️  seedData: skipped (data exists)');
      return;
    }

    // ── 10 contacts ───────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO contacts (name, company, email, phone, status, tags, notes) VALUES
        ('สมชาย ใจดี',     'Team Alpha',     'somchai@alpha.gg',  '081-111-1111', 'customer', 'vip,esport',   'ลูกค้าประจำ'),
        ('วิไล รักเรียน',  'XYZ Esport',     'wilai@xyz.gg',      '082-222-2222', 'prospect', 'esport',       'สนใจแพ็กเกจทีม'),
        ('ธนา มั่งคั่ง',   'Rich Gaming',    'thana@rich.gg',     '083-333-3333', 'customer', 'vip,streamer', 'Streamer 500k'),
        ('นิดา สวยงาม',    'Beauty Stream',  'nida@beauty.gg',    '084-444-4444', 'lead',     'streamer',     'ติดต่อผ่าน IG'),
        ('ภูมิ เก่งกาจ',   'Pro Team TH',    'phum@proth.gg',     '085-555-5555', 'customer', 'pro,esport',   'Pro League'),
        ('กานต์ ดีมาก',    'Gamer Hub',      'karn@gamerhub.gg',  '086-666-6666', 'prospect', 'gaming',       'เจ้าของร้านเกม'),
        ('มณี สว่างใจ',    'Shine Gaming',   'manee@shine.gg',    '087-777-7777', 'inactive', 'old',          'ไม่ติดต่อ 3 เดือน'),
        ('ชาย หล่อมาก',    'Handsome Team',  'chai@handsome.gg',  '088-888-8888', 'lead',     'new',          'ติดต่อเข้ามาเอง'),
        ('พลอย ใสใจ',      'Crystal Esport', 'ploy@crystal.gg',   '089-999-9999', 'prospect', 'esport,vip',   'Rising Star'),
        ('อาทิตย์ สุดยอด', 'Sun Pro Gaming', 'arthit@sunpro.gg',  '090-000-0000', 'customer', 'pro,streamer', 'Champion S3')
      ON CONFLICT (email) DO NOTHING;
    `);

    // ── 5 deals ───────────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO deals (contact_id, title, value, stage, close_date, notes)
      SELECT c.id, d.title, d.value::DECIMAL, d.stage, d.close_date::DATE, d.notes
      FROM (VALUES
        ('somchai@alpha.gg', 'แพ็กเกจ Gaming ประจำปี',      '85000',  'won',         '2026-03-01', 'ปิดดีลแล้ว'),
        ('wilai@xyz.gg',     'สปอนเซอร์ทีม XYZ Season 4',  '250000', 'negotiation', '2026-04-15', 'รอ approve'),
        ('thana@rich.gg',    'Streaming Setup Premium',      '120000', 'proposal',    '2026-03-30', 'รอ feedback'),
        ('phum@proth.gg',    'อุปกรณ์ Pro Team ครบชุด',    '180000', 'contacted',   '2026-05-01', 'นัด demo'),
        ('ploy@crystal.gg',  'เมาส์ + คีย์บอร์ด Esport',  '35000',  'new',         '2026-04-01', 'Lead ใหม่')
      ) AS d(email, title, value, stage, close_date, notes)
      JOIN contacts c ON c.email = d.email
      ON CONFLICT DO NOTHING;
    `);

    console.log('✅ seedData: 10 contacts + 5 deals inserted');
  } catch (err) {
    console.error('⚠️  seedData error (non-fatal):', err.message);
  } finally {
    client.release();
  }
}

// ─── Boot with retry ───────────────────────────────────────────────────────────
// Railway DB อาจยังไม่พร้อมตอน container start — retry สูงสุด 10 ครั้ง
async function boot(attempt = 1, maxAttempts = 10) {
  try {
    console.log(`🔌 Connecting to DB... (attempt ${attempt}/${maxAttempts})`);

    await pool.query('SELECT 1');
    console.log('✅ PostgreSQL connected');

    await initDB();
    await seedData();

    console.log('✅ Boot complete');
  } catch (err) {
    const msg = err.message || err.code || JSON.stringify(err);
    console.error(`❌ Boot attempt ${attempt} failed: ${msg}`);

    if (attempt < maxAttempts) {
      const delay = Math.min(attempt * 2000, 10000); // 2s, 4s, 6s … max 10s
      console.log(`⏳ Retry in ${delay / 1000}s...`);
      await new Promise(r => setTimeout(r, delay));
      return boot(attempt + 1, maxAttempts);
    }

    // ครบ 10 ครั้งแล้วยังไม่ได้ — log และ continue (ไม่ exit)
    // เพื่อให้ Railway health check ผ่านก่อน
    console.error('❌ DB unavailable after max retries — server running without DB');
  }
}

boot();

module.exports = pool;
