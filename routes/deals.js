// routes/deals.js — จัดการ CRUD สำหรับ Deals (โอกาสการขาย)
// Schema: id, title, value, stage, contact_id, created_at
// stage values: 'lead' | 'proposal' | 'negotiation' | 'won' | 'lost'

const express = require('express');
const router  = express.Router();
const pool    = require('../db');

const VALID_STAGES = ['lead', 'proposal', 'negotiation', 'won', 'lost'];

// ─── GET /api/deals ────────────────────────────────────────────────────────────
// ดึง deals ทั้งหมด พร้อม JOIN ชื่อ contact
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, c.name AS contact_name
      FROM deals d
      LEFT JOIN contacts c ON d.contact_id = c.id
      ORDER BY d.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /deals error:', err.message);
    res.status(500).json({ error: 'ดึงข้อมูล deals ไม่สำเร็จ' });
  }
});

// ─── GET /api/deals/:id ────────────────────────────────────────────────────────
// ดึง deal คนเดียวตาม id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT d.*, c.name AS contact_name
      FROM deals d
      LEFT JOIN contacts c ON d.contact_id = c.id
      WHERE d.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบ deal นี้' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /deals/:id error:', err.message);
    res.status(500).json({ error: 'ดึงข้อมูลไม่สำเร็จ' });
  }
});

// ─── POST /api/deals ───────────────────────────────────────────────────────────
// สร้าง deal ใหม่
router.post('/', async (req, res) => {
  try {
    const { title, value, stage, contact_id } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'ต้องระบุ title' });
    }
    if (stage && !VALID_STAGES.includes(stage)) {
      return res.status(400).json({ error: `stage ต้องเป็น: ${VALID_STAGES.join(', ')}` });
    }

    const result = await pool.query(
      `INSERT INTO deals (title, value, stage, contact_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [title, value || 0, stage || 'lead', contact_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /deals error:', err.message);
    res.status(500).json({ error: 'สร้าง deal ไม่สำเร็จ' });
  }
});

// ─── PUT /api/deals/:id ────────────────────────────────────────────────────────
// อัปเดต deal ตาม id (รองรับการเลื่อน stage)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, value, stage, contact_id } = req.body;

    if (stage && !VALID_STAGES.includes(stage)) {
      return res.status(400).json({ error: `stage ต้องเป็น: ${VALID_STAGES.join(', ')}` });
    }

    const result = await pool.query(
      `UPDATE deals
       SET title = $1, value = $2, stage = $3, contact_id = $4
       WHERE id = $5
       RETURNING *`,
      [title, value || 0, stage || 'lead', contact_id || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบ deal นี้' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /deals/:id error:', err.message);
    res.status(500).json({ error: 'อัปเดตไม่สำเร็จ' });
  }
});

// ─── DELETE /api/deals/:id ─────────────────────────────────────────────────────
// ลบ deal ตาม id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM deals WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบ deal นี้' });
    }
    res.json({ message: 'ลบสำเร็จ', id: result.rows[0].id });
  } catch (err) {
    console.error('DELETE /deals/:id error:', err.message);
    res.status(500).json({ error: 'ลบไม่สำเร็จ' });
  }
});

module.exports = router;
