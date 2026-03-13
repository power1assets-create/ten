// db.js — จัดการ connection กับ PostgreSQL (รองรับ Railway + local)
// Railway ให้ DATABASE_URL มาตรฐาน เช่น
//   postgresql://user:pass@host:port/dbname

require('dotenv').config();

const { Pool } = require('pg');

// ─── สร้าง Pool ────────────────────────────────────────────────────────────────
// ถ้ามี DATABASE_URL (Railway/cloud) ใช้เลย
// ถ้าไม่มี fallback เป็นค่า local แต่ละตัว
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }, // จำเป็นสำหรับ Railway TLS
      }
    : {
        host:     process.env.DB_HOST     || 'localhost',
        port:     process.env.DB_PORT     || 5432,
        database: process.env.DB_NAME     || 'crmdb',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
      }
);

// ─── สร้างตาราง อัตโนมัติ (IF NOT EXISTS) ─────────────────────────────────────
// ฟังก์ชันนี้รันทุกครั้งที่ server เริ่ม — ถ้าตารางมีอยู่แล้วจะไม่ทำอะไร
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      -- ตาราง contacts: เก็บข้อมูลลูกค้า/ผู้ติดต่อ
      CREATE TABLE IF NOT EXISTS contacts (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(150) NOT NULL,
        email      VARCHAR(150) NOT NULL UNIQUE,   -- ห้ามซ้ำ
        phone      VARCHAR(30),
        company    VARCHAR(150),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- ตาราง deals: เก็บโอกาสการขาย เชื่อมกับ contacts
      CREATE TABLE IF NOT EXISTS deals (
        id         SERIAL PRIMARY KEY,
        title      VARCHAR(200) NOT NULL,
        value      NUMERIC(15, 2) DEFAULT 0,        -- มูลค่า (บาท)
        stage      VARCHAR(20)   DEFAULT 'lead'     -- สถานะ deal
                   CHECK (stage IN ('lead','proposal','negotiation','won','lost')),
        contact_id INT REFERENCES contacts(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ ตาราง contacts และ deals พร้อมใช้งาน');
  } catch (err) {
    console.error('❌ สร้างตารางไม่สำเร็จ:', err.message);
    throw err; // หยุด server ถ้า init ล้มเหลว
  } finally {
    client.release();
  }
}

// ─── ทดสอบ connection + init ───────────────────────────────────────────────────
initDB().catch(err => {
  console.error('❌ initDB failed:', err.message);
  process.exit(1); // ออกทันที ไม่ให้ server รันโดยไม่มี DB
});

// Export pool ให้ routes ใช้งาน
module.exports = pool;
