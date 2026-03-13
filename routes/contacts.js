// routes/contacts.js — จัดการ CRUD สำหรับ Contacts (ลูกค้า/ผู้ติดต่อ)
// Schema: id, name, email, phone, company, created_at

const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// ─── GET /api/contacts ─────────────────────────────────────────────────────────
// ดึง contacts ทั้งหมด เรียงจากใหม่ไปเก่า
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM contacts ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /contacts error:', err.message);
    res.status(500).json({ error: 'ดึงข้อมูล contacts ไม่สำเร็จ' });
  }
});

// ─── GET /api/contacts/:id ─────────────────────────────────────────────────────
// ดึง contact คนเดียวตาม id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM contacts WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบ contact นี้' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /contacts/:id error:', err.message);
    res.status(500).json({ error: 'ดึงข้อมูลไม่สำเร็จ' });
  }
});

// ─── POST /api/contacts ────────────────────────────────────────────────────────
// สร้าง contact ใหม่
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, company } = req.body;

    // ตรวจ field บังคับ
    if (!name || !email) {
      return res.status(400).json({ error: 'ต้องระบุ name และ email' });
    }

    const result = await pool.query(
      `INSERT INTO contacts (name, email, phone, company)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, email, phone || null, company || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    // error code 23505 = unique violation (email ซ้ำ)
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email นี้มีอยู่แล้ว' });
    }
    console.error('POST /contacts error:', err.message);
    res.status(500).json({ error: 'สร้าง contact ไม่สำเร็จ' });
  }
});

// ─── PUT /api/contacts/:id ─────────────────────────────────────────────────────
// อัปเดต contact ตาม id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, company } = req.body;

    const result = await pool.query(
      `UPDATE contacts
       SET name = $1, email = $2, phone = $3, company = $4
       WHERE id = $5
       RETURNING *`,
      [name, email, phone || null, company || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบ contact นี้' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /contacts/:id error:', err.message);
    res.status(500).json({ error: 'อัปเดตไม่สำเร็จ' });
  }
});

// ─── DELETE /api/contacts/:id ──────────────────────────────────────────────────
// ลบ contact ตาม id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM contacts WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบ contact นี้' });
    }
    res.json({ message: 'ลบสำเร็จ', id: result.rows[0].id });
  } catch (err) {
    console.error('DELETE /contacts/:id error:', err.message);
    res.status(500).json({ error: 'ลบไม่สำเร็จ' });
  }
});

module.exports = router;
