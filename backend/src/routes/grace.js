const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/grace - grace period requests
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, page = 1, limit = 50, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = [];

    if (status) { params.push(status); conditions.push(`gp.status = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(gp.serial_no ILIKE $${params.length} OR gp.customer_name ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await db.query(`SELECT COUNT(*) FROM grace_period_requests gp ${where}`, params);
    params.push(parseInt(limit), offset);

    const { rows } = await db.query(`
      SELECT gp.*, p.name AS product_name, p.code AS product_code,
             dist.name AS distributor_name, d.name AS dealer_name,
             u.name AS actioned_by_name
      FROM grace_period_requests gp
      LEFT JOIN products p ON p.id = gp.product_id
      LEFT JOIN distributors dist ON dist.id = gp.distributor_id
      LEFT JOIN dealers d ON d.id = gp.dealer_id
      LEFT JOIN users u ON u.id = gp.actioned_by
      ${where}
      ORDER BY gp.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({ data: rows, total: parseInt(countRes.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/grace/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT gp.*, p.name AS product_name, dist.name AS distributor_name, d.name AS dealer_name
      FROM grace_period_requests gp
      LEFT JOIN products p ON p.id = gp.product_id
      LEFT JOIN distributors dist ON dist.id = gp.distributor_id
      LEFT JOIN dealers d ON d.id = gp.dealer_id
      WHERE gp.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/grace - submit grace period request
router.post('/', authenticate, async (req, res) => {
  const { serial_no, product_id, distributor_id, dealer_id, customer_name, request_type, reason } = req.body;
  if (!serial_no) return res.status(400).json({ error: 'serial_no required' });
  try {
    const { rows } = await db.query(`
      INSERT INTO grace_period_requests (serial_no, product_id, distributor_id, dealer_id, customer_name, request_type, reason, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *
    `, [serial_no, product_id || null, distributor_id || null, dealer_id || null, customer_name || null, request_type || null, reason || null]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/grace/:id/approve
router.put('/:id/approve', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { rows } = await db.query(`
      UPDATE grace_period_requests SET status = 'approved', actioned_by = $1, actioned_at = NOW()
      WHERE id = $2 RETURNING *
    `, [req.user.id, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/grace/:id/reject
router.put('/:id/reject', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { rows } = await db.query(`
      UPDATE grace_period_requests SET status = 'rejected', actioned_by = $1, actioned_at = NOW()
      WHERE id = $2 RETURNING *
    `, [req.user.id, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
