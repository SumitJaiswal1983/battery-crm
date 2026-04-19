const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/returns
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = '';
    if (status) { params.push(status); where = `WHERE cr.status = $1`; }

    const countRes = await db.query(`SELECT COUNT(*) FROM claim_return cr ${where}`, params);
    params.push(parseInt(limit), offset);

    const { rows } = await db.query(`
      SELECT cr.*, c.complaint_no, c.serial_no, c.warranty_status,
             cu.name AS customer_name, cu.mobile AS customer_mobile,
             dist.name AS distributor_name, d.name AS dealer_name
      FROM claim_return cr
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

// GET /api/returns/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT cr.*, c.complaint_no, c.serial_no,
             cu.name AS customer_name, dist.name AS distributor_name, d.name AS dealer_name
      FROM claim_return cr
      JOIN complaints c ON c.id = cr.complaint_id
      LEFT JOIN customers cu ON cu.id = c.customer_id
      LEFT JOIN distributors dist ON dist.id = c.distributor_id
      LEFT JOIN dealers d ON d.id = c.dealer_id
      WHERE cr.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/returns - create return record
router.post('/', authenticate, authorize('admin', 'claim_return'), async (req, res) => {
  const { complaint_id } = req.body;
  if (!complaint_id) return res.status(400).json({ error: 'complaint_id required' });
  try {
    const existing = await db.query('SELECT id FROM claim_return WHERE complaint_id = $1', [complaint_id]);
    if (existing.rows.length) return res.status(400).json({ error: 'Return record already exists' });

    const { rows } = await db.query(`
      INSERT INTO claim_return (complaint_id, status, created_by) VALUES ($1, 'pending', $2) RETURNING *
    `, [complaint_id, req.user.id]);

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/returns/:id/complete - mark return as done
router.put('/:id/complete', authenticate, authorize('admin', 'claim_return'), async (req, res) => {
  try {
    const { rows } = await db.query(`
      UPDATE claim_return SET status = 'done', return_date = NOW() WHERE id = $1 RETURNING *
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });

    // Update complaint return_status
    await db.query(`UPDATE complaints SET return_status = 'done', updated_at = NOW() WHERE id = $1`, [rows[0].complaint_id]);

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
