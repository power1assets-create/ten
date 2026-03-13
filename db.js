// db.js — PostgreSQL connection + schema init + seed data
// รองรับ Railway (DATABASE_URL) และ local (DB_HOST ฯลฯ)

require('dotenv').config();
const { Pool } = require('pg');

// ─── Pool ──────────────────────────────────────────────────────────────────────
// Railway inject DATABASE_URL อัตโนมัติ — ถ้าไม่มีให้ fallback local
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }, // จำเป็นสำหรับ Railway TLS
      }
    : {
        host:     process.env.DB_HOST     || 'localhost',
        port:     Number(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME     || 'crmdb',
        user:     process.env.DB_USER     || process.env.USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
      }
);

// ─── initDB ────────────────────────────────────────────────────────────────────
// สร้างตารางทั้งหมด (IF NOT EXISTS) — รันทุก boot ไม่มีผลถ้ามีอยู่แล้ว
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      -- ══════════════════════════════════════
      -- ตาราง contacts
      -- ══════════════════════════════════════
      CREATE TABLE IF NOT EXISTS contacts (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(100) NOT NULL,
        company    VARCHAR(100),
        email      VARCHAR(100) NOT NULL UNIQUE,
        phone      VARCHAR(20),
        status     VARCHAR(20)  NOT NULL DEFAULT 'lead'
                   CHECK (status IN ('lead','prospect','customer','inactive')),
        tags       TEXT,                        -- เก็บเป็น comma-separated เช่น "vip,esport"
        notes      TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- ══════════════════════════════════════
      -- ตาราง deals
      -- ══════════════════════════════════════
      CREATE TABLE IF NOT EXISTS deals (
        id         SERIAL PRIMARY KEY,
        contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
        title      VARCHAR(200) NOT NULL,
        value      DECIMAL(10,2) DEFAULT 0,
        stage      VARCHAR(30)  NOT NULL DEFAULT 'new'
                   CHECK (stage IN ('new','contacted','proposal','negotiation','won','lost')),
        close_date DATE,
        notes      TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- เพิ่ม column ใหม่ให้ตารางเก่าถ้ายังไม่มี (migration อัตโนมัติ)
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tags  TEXT;
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'lead';
      ALTER TABLE deals    ADD COLUMN IF NOT EXISTS close_date DATE;
      ALTER TABLE deals    ADD COLUMN IF NOT EXISTS notes TEXT;
    `);

    console.log('✅ initDB: ตาราง contacts + deals พร้อมใช้งาน');
  } catch (err) {
    console.error('❌ initDB error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// ─── seedData ──────────────────────────────────────────────────────────────────
// ใส่ข้อมูลตัวอย่าง 10 contacts + 5 deals
// ใช้ ON CONFLICT DO NOTHING ป้องกัน duplicate เมื่อ restart
async function seedData() {
  const client = await pool.connect();
  try {
    // ตรวจว่ามีข้อมูลอยู่แล้วไหม — ถ้ามีไม่ seed ซ้ำ
    const { rows } = await client.query('SELECT COUNT(*) FROM contacts');
    if (parseInt(rows[0].count) > 0) {
      console.log('ℹ️  seedData: มีข้อมูลอยู่แล้ว ข้าม seed');
      return;
    }

    // ── 10 Contacts ──────────────────────────────────────────────
    await client.query(`
      INSERT INTO contacts (name, company, email, phone, status, tags, notes) VALUES
        ('สมชาย ใจดี',       'Team Alpha',       'somchai@alpha.gg',      '081-111-1111', 'customer',  'vip,esport',     'ลูกค้าประจำ ซื้อทุกเดือน'),
        ('วิไล รักเรียน',    'XYZ Esport',       'wilai@xyz.gg',          '082-222-2222', 'prospect',  'esport',         'สนใจแพ็กเกจทีม'),
        ('ธนา มั่งคั่ง',     'Rich Gaming',      'thana@rich.gg',         '083-333-3333', 'customer',  'vip,streamer',   'Streamer ใหญ่ มี follower 500k'),
        ('นิดา สวยงาม',      'Beauty Stream',    'nida@beauty.gg',        '084-444-4444', 'lead',      'streamer',       'ติดต่อผ่าน Instagram'),
        ('ภูมิ เก่งกาจ',     'Pro Team TH',      'phum@proth.gg',         '085-555-5555', 'customer',  'pro,esport',     'นักกีฬา Pro League'),
        ('กานต์ ดีมาก',      'Gamer Hub',        'karn@gamerhub.gg',      '086-666-6666', 'prospect',  'gaming',         'เจ้าของร้านเกม'),
        ('มณี สว่างใจ',      'Shine Gaming',     'manee@shine.gg',        '087-777-7777', 'inactive',  'old',            'ไม่ได้ติดต่อมา 3 เดือน'),
        ('ชาย หล่อมาก',      'Handsome Team',    'chai@handsome.gg',      '088-888-8888', 'lead',      'new',            'ติดต่อเข้ามาเอง'),
        ('พลอย ใสใจ',        'Crystal Esport',   'ploy@crystal.gg',       '089-999-9999', 'prospect',  'esport,vip',     'ทีม Rising Star'),
        ('อาทิตย์ สุดยอด',   'Sun Pro Gaming',   'arthit@sunpro.gg',      '090-000-0000', 'customer',  'pro,streamer',   'Champion Season 3')
      ON CONFLICT (email) DO NOTHING;
    `);

    // ── 5 Deals ───────────────────────────────────────────────────
    await client.query(`
      INSERT INTO deals (contact_id, title, value, stage, close_date, notes)
      SELECT c.id, d.title, d.value, d.stage, d.close_date::DATE, d.notes
      FROM (VALUES
        ('somchai@alpha.gg',  'แพ็กเกจอุปกรณ์ Gaming ประจำปี',   85000,  'won',         '2026-03-01', 'ปิดดีลสำเร็จ จัดส่งแล้ว'),
        ('wilai@xyz.gg',      'สปอนเซอร์ทีม XYZ Season 4',       250000, 'negotiation', '2026-04-15', 'รอ approve งบจากบริษัทแม่'),
        ('thana@rich.gg',     'ชุด Streaming Setup Premium',      120000, 'proposal',    '2026-03-30', 'ส่ง proposal ไปแล้ว รอ feedback'),
        ('phum@proth.gg',     'อุปกรณ์ Pro Team ครบชุด',         180000, 'contacted',   '2026-05-01', 'นัด demo สินค้าสัปดาห์หน้า'),
        ('ploy@crystal.gg',   'เมาส์ + คีย์บอร์ด Esport Edition', 35000, 'new',         '2026-04-01', 'Lead ใหม่ ยังไม่ได้ติดต่อ')
      ) AS d(email, title, value, stage, close_date, notes)
      JOIN contacts c ON c.email = d.email
      ON CONFLICT DO NOTHING;
    `);

    console.log('✅ seedData: เพิ่ม 10 contacts + 5 deals สำเร็จ');
  } catch (err) {
    console.error('❌ seedData error:', err.message);
    // ไม่ throw — seed fail ไม่ควรหยุด server
  } finally {
    client.release();
  }
}

// ─── Boot sequence ─────────────────────────────────────────────────────────────
async function boot() {
  try {
    // ทดสอบ connection
    const { rows } = await pool.query('SELECT NOW() AS now');
    console.log(`✅ PostgreSQL connected — ${rows[0].now}`);

    await initDB();   // สร้างตาราง
    await seedData(); // ใส่ข้อมูลตัวอย่าง (ถ้ายังไม่มี)
  } catch (err) {
    console.error('❌ Boot failed:', err.message);
    process.exit(1);  // หยุด server ถ้า DB ใช้ไม่ได้
  }
}

boot();

module.exports = pool;
