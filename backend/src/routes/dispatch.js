const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/dispatch - list claim dispatches
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, page = 1, limit = 50, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = [];

    if (status) { params.push(status); conditions.push(`cd.status = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(c.complaint_no ILIKE $${params.length} OR c.serial_no ILIKE $${params.length} OR cu.name ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await db.query(`
      SELECT COUNT(*) FROM claim_dispatch cd
      JOIN complaints c ON c.id = cd.complaint_id
      LEFT JOIN customers cu ON cu.id = c.customer_id
      ${where}
    `, params);

    params.push(parseInt(limit), offset);
    const { rows } = await db.query(`
      SELECT cd.*, c.complaint_no, c.serial_no, c.warranty_status,
             cu.name AS customer_name, cu.mobile AS customer_mobile,
             dist.name AS distributor_name, d.name AS dealer_name,
             dr.name AS driver_name, dr.vehicle_no AS driver_vehicle
      FROM claim_dispatch cd
      JOIN complaints c ON c.id = cd.complaint_id
      LEFT JOIN customers cu ON cu.id = c.customer_id
      LEFT JOIN distributors dist ON dist.id = c.distributor_id
      LEFT JOIN dealers d ON d.id = c.dealer_id
      LEFT JOIN drivers dr ON dr.id = cd.driver_id
      ${where}
      ORDER BY cd.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({ data: rows, total: parseInt(countRes.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dispatch/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT cd.*, c.complaint_no, c.serial_no, c.warranty_status,
             cu.name AS customer_name, cu.mobile AS customer_mobile,
             dist.name AS distributor_name, d.name AS dealer_name,
             dr.name AS driver_name, dr.mobile AS driver_mobile, dr.vehicle_no AS driver_vehicle
      FROM claim_dispatch cd
      JOIN complaints c ON c.id = cd.complaint_id
      LEFT JOIN customers cu ON cu.id = c.customer_id
      LEFT JOIN distributors dist ON dist.id = c.distributor_id
      LEFT JOIN dealers d ON d.id = c.dealer_id
      LEFT JOIN drivers dr ON dr.id = cd.driver_id
      WHERE cd.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dispatch - create dispatch record for a complaint
router.post('/', authenticate, authorize('admin', 'claim_dispatch'), async (req, res) => {
  const { complaint_id, driver_id, vehicle_no } = req.body;
  if (!complaint_id) return res.status(400).json({ error: 'complaint_id required' });
  try {
    const existing = await db.query('SELECT id FROM claim_dispatch WHERE complaint_id = $1', [complaint_id]);
    if (existing.rows.length) return res.status(400).json({ error: 'Dispatch record already exists for this complaint' });

    const { rows } = await db.query(`
      INSERT INTO claim_dispatch (complaint_id, driver_id, vehicle_no, status, created_by)
      VALUES ($1, $2, $3, 'pending', $4) RETURNING *
    `, [complaint_id, driver_id || null, vehicle_no || null, req.user.id]);

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/dispatch/:id/gatepass - generate gatepass
router.put('/:id/gatepass', authenticate, authorize('admin', 'claim_dispatch'), async (req, res) => {
  const { gatepass_no, driver_id, vehicle_no } = req.body;
  try {
    const { rows } = await db.query(`
      UPDATE claim_dispatch
      SET status = 'gatepass', gatepass_no = $1, gatepass_date = NOW(),
          driver_id = $2, vehicle_no = $3, updated_at = NOW()
      WHERE id = $4 RETURNING *
    `, [gatepass_no, driver_id || null, vehicle_no || null, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/dispatch/:id/dispatch - mark as dispatched
router.put('/:id/dispatch', authenticate, authorize('admin', 'claim_dispatch'), async (req, res) => {
  try {
    const { rows } = await db.query(`
      UPDATE claim_dispatch SET status = 'dispatched', dispatch_date = NOW(), updated_at = NOW()
      WHERE id = $1 RETURNING *
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });

    // Update complaint dispatch_status
    await db.query(`UPDATE complaints SET dispatch_status = 'dispatched', updated_at = NOW() WHERE id = $1`, [rows[0].complaint_id]);

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
