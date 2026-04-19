const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/counter - counter replacements
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = '';

    if (search) {
      params.push(`%${search}%`);
      where = `WHERE (cr.serial_no ILIKE $1 OR c.complaint_no ILIKE $1)`;
    }

    const countRes = await db.query(`
      SELECT COUNT(*) FROM counter_replacements cr JOIN complaints c ON c.id = cr.complaint_id ${where}
    `, params);

    params.push(parseInt(limit), offset);
    const { rows } = await db.query(`
      SELECT cr.*, c.complaint_no, c.serial_no AS old_serial_no, c.warranty_status,
             cu.name AS customer_name, dist.name AS distributor_name, d.name AS dealer_name
      FROM counter_replacements cr
      JOIN complaints c ON c.id = cr.complaint_id
      LEFT JOIN customers cu ON cu.id = c.customer_id
      LEFT JOIN distributors dist ON dist.id = c.distributor_id
      LEFT JOIN dealers d ON d.id = c.dealer_id
      ${where}
      ORDER BY cr.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({ data: rows, total: parseInt(countRes.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/counter - record counter replacement
router.post('/', authenticate, authorize('admin', 'store'), async (req, res) => {
  const { complaint_id, serial_no } = req.body;
  if (!complaint_id || !serial_no) return res.status(400).json({ error: 'complaint_id and serial_no required' });
  try {
    const { rows } = await db.query(`
      INSERT INTO counter_replacements (complaint_id, serial_no, created_by, stock_updated)
      VALUES ($1, $2, $3, false) RETURNING *
    `, [complaint_id, serial_no, req.user.id]);

    await db.query(`UPDATE complaints SET stock_action = 'Counter Replacement', status = 'battery_replaced', updated_at = NOW() WHERE id = $1`, [complaint_id]);

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/counter/:id/stock - mark stock updated
router.put('/:id/stock', authenticate, authorize('admin', 'store'), async (req, res) => {
  try {
    const { rows } = await db.query(`
      UPDATE counter_replacements SET stock_updated = true WHERE id = $1 RETURNING *
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
