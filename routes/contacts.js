// routes/contacts.js
// GET    /api/contacts        — รายการทั้งหมด (?search= &status=)
// GET    /api/contacts/stats  — สรุปจำนวนแต่ละ status
// GET    /api/contacts/:id    — รายบุคคล
// POST   /api/contacts        — เพิ่มใหม่
// PUT    /api/contacts/:id    — แก้ไข
// DELETE /api/contacts/:id    — ลบ

const express = require('express');
const router  = express.Router();
const pool    = require('../db');

const VALID_STATUS = ['lead', 'prospect', 'customer', 'inactive'];

// ── GET /api/contacts ─────────────────────────────────────────────────────────
// Query params: ?search=xxx  ?status=lead|prospect|customer|inactive
router.get('/', async (req, res) => {
  try {
    const { search, status } = req.query;
    const params = [], conds = [];

    if (search) {
      params.push(`%${search}%`);
      const p = params.length;
      conds.push(`(name ILIKE $${p} OR email ILIKE $${p} OR company ILIKE $${p} OR tags ILIKE $${p})`);
    }

    if (status) {
      params.push(status);
      conds.push(`status = $${params.length}`);
    }

    const where  = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM contacts ${where} ORDER BY created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /contacts:', err.message);
    res.status(500).json({ error: 'ดึงข้อมูลไม่สำเร็จ' });
  }
});

// ── GET /api/contacts/stats ───────────────────────────────────────────────────
// ⚠️ ต้องอยู่ก่อน /:id
router.get('/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT status, COUNT(*)::INT AS count
      FROM contacts GROUP BY status
    `);
    const stats = { lead: 0, prospect: 0, customer: 0, inactive: 0, total: 0 };
    result.rows.forEach(r => {
      if (r.status in stats) stats[r.status] = r.count;
      stats.total += r.count;
    });
    res.json(stats);
  } catch (err) {
    console.error('GET /contacts/stats:', err.message);
    res.status(500).json({ error: 'ดึง stats ไม่สำเร็จ' });
  }
});

// ── GET /api/contacts/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM contacts WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'ไม่พบ contact' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /contacts/:id:', err.message);
    res.status(500).json({ error: 'ดึงข้อมูลไม่สำเร็จ' });
  }
});

// ── POST /api/contacts ────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, company, email, phone, status, tags, notes } = req.body;

    if (!name?.trim())  return res.status(400).json({ error: 'ต้องระบุ name' });
    if (!email?.trim()) return res.status(400).json({ error: 'ต้องระบุ email' });
    if (status && !VALID_STATUS.includes(status))
      return res.status(400).json({ error: `status ต้องเป็น: ${VALID_STATUS.join(', ')}` });

    const result = await pool.query(
      `INSERT INTO contacts (name, company, email, phone, status, tags, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        name.trim(),
        company  || null,
        email.trim().toLowerCase(),
        phone    || null,
        status   || 'lead',
        tags     || null,
        notes    || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email นี้มีอยู่แล้ว' });
    console.error('POST /contacts:', err.message);
    res.status(500).json({ error: 'สร้างไม่สำเร็จ' });
  }
});

// ── PUT /api/contacts/:id ─────────────────────────────────────────────────────
// updated_at อัปเดตอัตโนมัติด้วย NOW()
router.put('/:id', async (req, res) => {
  try {
    const { name, company, email, phone, status, tags, notes } = req.body;

    if (!name?.trim())  return res.status(400).json({ error: 'ต้องระบุ name' });
    if (!email?.trim()) return res.status(400).json({ error: 'ต้องระบุ email' });
    if (status && !VALID_STATUS.includes(status))
      return res.status(400).json({ error: `status ต้องเป็น: ${VALID_STATUS.join(', ')}` });

    const result = await pool.query(
      `UPDATE contacts SET
         name=$1, company=$2, email=$3, phone=$4,
         status=$5, tags=$6, notes=$7, updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [
        name.trim(),
        company  || null,
        email.trim().toLowerCase(),
        phone    || null,
        status   || 'lead',
        tags     || null,
        notes    || null,
        req.params.id,
      ]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'ไม่พบ contact' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email นี้มีอยู่แล้ว' });
    console.error('PUT /contacts/:id:', err.message);
    res.status(500).json({ error: 'อัปเดตไม่สำเร็จ' });
  }
});

// ── DELETE /api/contacts/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM contacts WHERE id=$1 RETURNING id, name',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'ไม่พบ contact' });
    res.json({ message: `ลบ "${result.rows[0].name}" สำเร็จ`, id: result.rows[0].id });
  } catch (err) {
    console.error('DELETE /contacts/:id:', err.message);
    res.status(500).json({ error: 'ลบไม่สำเร็จ' });
  }
});

module.exports = router;
