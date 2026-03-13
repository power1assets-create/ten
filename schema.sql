-- schema.sql — สร้างตาราง contacts และ deals ใน PostgreSQL
-- รันด้วย: psql -U postgres -d crmdb -f schema.sql

-- สร้าง database (ถ้ายังไม่มี ให้รันแยก)
-- CREATE DATABASE crmdb;

-- ─── Contacts ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(150) NOT NULL,
  email      VARCHAR(150) NOT NULL UNIQUE,  -- ห้ามซ้ำ
  phone      VARCHAR(30),
  company    VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Deals ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deals (
  id         SERIAL PRIMARY KEY,
  title      VARCHAR(200) NOT NULL,
  value      NUMERIC(15, 2) DEFAULT 0,      -- มูลค่า (บาท)
  stage      VARCHAR(20)   DEFAULT 'lead'   -- lead/proposal/negotiation/won/lost
             CHECK (stage IN ('lead','proposal','negotiation','won','lost')),
  contact_id INT REFERENCES contacts(id) ON DELETE SET NULL,  -- FK ถ้าลบ contact ให้ set null
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Sample Data ───────────────────────────────────────────────────────────────
INSERT INTO contacts (name, email, phone, company) VALUES
  ('สมชาย ใจดี',   'somchai@example.com',  '081-234-5678', 'ABC Co., Ltd.'),
  ('วิไล รักเรียน', 'wilai@example.com',    '089-876-5432', 'XYZ Corp.'),
  ('ธนา มั่งคั่ง',  'thana@example.com',    NULL,           NULL)
ON CONFLICT (email) DO NOTHING;

INSERT INTO deals (title, value, stage, contact_id) VALUES
  ('โปรเจกต์เว็บไซต์',       150000, 'proposal',    1),
  ('ระบบ ERP',               500000, 'negotiation', 2),
  ('แอปมือถือ',              80000,  'lead',        3),
  ('ที่ปรึกษา IT รายเดือน',  30000,  'won',         1)
ON CONFLICT DO NOTHING;
