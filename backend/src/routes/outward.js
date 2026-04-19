const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/outward - claim outward list
router.get('/', authenticate, async (req, res) => {
  try {
    const { dispatched, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = '';

    if (dispatched !== undefined) {
      params.push(dispatched === 'true');
      where = `WHERE co.dispatched = $1`;
    }

    const countRes = await db.query(`SELECT COUNT(*) FROM claim_outward co ${where}`, params);
    params.push(parseInt(limit), offset);

    const { rows } = await db.query(`
      SELECT co.*, c.complaint_no, c.serial_no, c.warranty_status,
             cu.name AS customer_name, dist.name AS distributor_name, d.name AS dealer_name
      FROM claim_outward co
      JOIN complaints c ON c.id = co.complaint_id
      LEFT JOIN customers cu ON cu.id = c.customer_id
      LEFT JOIN distributors dist ON dist.id = c.distributor_id
      LEFT JOIN dealers d ON d.id = c.dealer_id
      ${where}
      ORDER BY co.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({ data: rows, total: parseInt(countRes.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/outward - create outward record
router.post('/', authenticate, authorize('admin', 'store'), async (req, res) => {
  const { complaint_id } = req.body;
  if (!complaint_id) return res.status(400).json({ error: 'complaint_id required' });
  try {
    const { rows } = await db.query(`
      INSERT INTO claim_outward (complaint_id, dispatched, created_by) VALUES ($1, false, $2) RETURNING *
    `, [complaint_id, req.user.id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/outward/:id/dispatch - mark dispatched
router.put('/:id/dispatch', authenticate, authorize('admin', 'store'), async (req, res) => {
  try {
    const { rows } = await db.query(`
      UPDATE claim_outward SET dispatched = true WHERE id = $1 RETURNING *
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
