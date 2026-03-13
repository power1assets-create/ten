// server.js — Entry point หลักของแอป
// รับผิดชอบ: สร้าง Express server, middleware, routes, และ serve static files

require('dotenv').config(); // โหลด .env ก่อนเสมอ

const express = require('express');
const cors    = require('cors');
const path    = require('path');

// Import routes
const contactsRouter = require('./routes/contacts');
const dealsRouter    = require('./routes/deals');

const app  = express();
const PORT = process.env.PORT || 3000; // ใช้ PORT จาก env หรือ fallback 3000

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());                        // อนุญาต cross-origin requests
app.use(express.json());                // parse JSON body
app.use(express.urlencoded({ extended: true })); // parse form data

// Serve static files จาก /public (HTML, CSS, JS ของ frontend)
app.use(express.static(path.join(__dirname, 'public')));

// ─── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/contacts', contactsRouter); // จัดการ contacts ทั้งหมด
app.use('/api/deals',    dealsRouter);    // จัดการ deals ทั้งหมด

// Health check — ใช้ตรวจว่า server ยังทำงานอยู่
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Catch-all: ส่ง index.html สำหรับ route ที่ไม่ใช่ API (รองรับ SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 CRM Server กำลังทำงานที่ http://localhost:${PORT}`);
});
