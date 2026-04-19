const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/received
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = '';

    if (search) {
      params.push(`%${search}%`);
      where = `WHERE (rb.serial_no ILIKE $1 OR c.complaint_no ILIKE $1 OR rb.receiving_by ILIKE $1)`;
    }

    const countRes = await db.query(`SELECT COUNT(*) FROM received_batteries rb JOIN complaints c ON c.id = rb.complaint_id ${where}`, params);
    params.push(parseInt(limit), offset);

    const { rows } = await db.query(`
      SELECT rb.*, c.complaint_no, cu.name AS customer_name,
             dist.name AS distributor_name, d.name AS dealer_name, p.name AS product_name
      FROM received_batteries rb
      JOIN complaints c ON c.id = rb.complaint_id
      LEFT JOIN customers cu ON cu.id = c.customer_id
      LEFT JOIN distributors dist ON dist.id = c.distributor_id
      LEFT JOIN dealers d ON d.id = c.dealer_id
      LEFT JOIN products p ON p.id = c.product_id
      ${where}
      ORDER BY rb.receiving_date DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({ data: rows, total: parseInt(countRes.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/received - receive a battery
router.post('/', authenticate, authorize('admin', 'store'), async (req, res) => {
  const { complaint_id, serial_no, receiving_by, warranty_start, warranty_end, warranty_status } = req.body;
  if (!complaint_id) return res.status(400).json({ error: 'complaint_id required' });
  try {
    const { rows } = await db.query(`
      INSERT INTO received_batteries (complaint_id, serial_no, receiving_by, warranty_start, warranty_end, warranty_status, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [complaint_id, serial_no, receiving_by, warranty_start || null, warranty_end || null, warranty_status || null, req.user.id]);

    // Update complaint status to closed after receiving
    await db.query(`UPDATE complaints SET status = 'closed', updated_at = NOW() WHERE id = $1`, [complaint_id]);

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
