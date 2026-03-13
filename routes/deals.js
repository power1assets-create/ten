// routes/deals.js
// GET    /api/deals           — รายการทั้งหมด (JOIN contacts)
// GET    /api/deals/pipeline  — สรุปแต่ละ stage { stage, count, total_value }
// POST   /api/deals           — สร้างใหม่
// PUT    /api/deals/:id       — แก้ไข
// DELETE /api/deals/:id       — ลบ

const express = require('express');
const router  = express.Router();
const pool    = require('../db');

const VALID_STAGES = ['new', 'contacted', 'proposal', 'negotiation', 'won', 'lost'];

// ── GET /api/deals ────────────────────────────────────────────────────────────
// JOIN contacts → ได้ contact_name + contact_company
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        d.id, d.title, d.value, d.stage, d.close_date, d.notes,
        d.contact_id, d.created_at,
        c.name    AS contact_name,
        c.company AS contact_company
      FROM deals d
      LEFT JOIN contacts c ON d.contact_id = c.id
      ORDER BY d.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /deals:', err.message);
    res.status(500).json({ error: 'ดึงข้อมูลไม่สำเร็จ' });
  }
});

// ── GET /api/deals/pipeline ───────────────────────────────────────────────────
// ⚠️ ต้องอยู่ก่อน /:id เพื่อไม่ให้ถูก match เป็น id
// คืน array ครบ 6 stages เสมอ แม้ stage นั้นยังไม่มี deal
router.get('/pipeline', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        stage,
        COUNT(*)::INT          AS count,
        COALESCE(SUM(value),0) AS total_value
      FROM deals
      GROUP BY stage
    `);

    // map ที่มีข้อมูลจาก DB
    const map = {};
    result.rows.forEach(r => { map[r.stage] = r; });

    // คืน 6 stages เรียงตาม pipeline เสมอ
    const pipeline = VALID_STAGES.map(stage => ({
      stage,
      count:       map[stage]?.count       || 0,
      total_value: map[stage]?.total_value || '0',
    }));

    res.json(pipeline);
  } catch (err) {
    console.error('GET /deals/pipeline:', err.message);
    res.status(500).json({ error: 'ดึง pipeline ไม่สำเร็จ' });
  }
});

// ── POST /api/deals ───────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { contact_id, title, value, stage, close_date, notes } = req.body;

    if (!title?.trim())
      return res.status(400).json({ error: 'ต้องระบุ title' });
    if (stage && !VALID_STAGES.includes(stage))
      return res.status(400).json({ error: `stage ต้องเป็น: ${VALID_STAGES.join(', ')}` });

    const result = await pool.query(
      `INSERT INTO deals (contact_id, title, value, stage, close_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        contact_id  || null,
        title.trim(),
        Number(value) || 0,
        stage       || 'new',
        close_date  || null,
        notes       || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /deals:', err.message);
    res.status(500).json({ error: 'สร้างไม่สำเร็จ' });
  }
});

// ── PUT /api/deals/:id ────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { contact_id, title, value, stage, close_date, notes } = req.body;

    if (!title?.trim())
      return res.status(400).json({ error: 'ต้องระบุ title' });
    if (stage && !VALID_STAGES.includes(stage))
      return res.status(400).json({ error: `stage ต้องเป็น: ${VALID_STAGES.join(', ')}` });

    const result = await pool.query(
      `UPDATE deals SET
         contact_id=$1, title=$2, value=$3, stage=$4, close_date=$5, notes=$6
       WHERE id=$7 RETURNING *`,
      [
        contact_id  || null,
        title.trim(),
        Number(value) || 0,
        stage       || 'new',
        close_date  || null,
        notes       || null,
        req.params.id,
      ]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'ไม่พบ deal' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /deals/:id:', err.message);
    res.status(500).json({ error: 'อัปเดตไม่สำเร็จ' });
  }
});

// ── DELETE /api/deals/:id ─────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM deals WHERE id=$1 RETURNING id, title',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'ไม่พบ deal' });
    res.json({ message: `ลบ "${result.rows[0].title}" สำเร็จ`, id: result.rows[0].id });
  } catch (err) {
    console.error('DELETE /deals/:id:', err.message);
    res.status(500).json({ error: 'ลบไม่สำเร็จ' });
  }
});

module.exports = router;
