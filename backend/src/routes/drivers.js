const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/drivers
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, is_active } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = [];

    if (is_active !== undefined) { params.push(is_active === 'true'); conditions.push(`d.is_active = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(d.name ILIKE $${params.length} OR d.mobile ILIKE $${params.length} OR d.driver_id ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await db.query(`SELECT COUNT(*) FROM drivers d ${where}`, params);
    params.push(parseInt(limit), offset);

    const { rows } = await db.query(`
      SELECT d.*, s.name AS state_name FROM drivers d
      LEFT JOIN states s ON s.id = d.state_id
      ${where} ORDER BY d.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({ data: rows, total: parseInt(countRes.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/drivers/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT d.*, s.name AS state_name FROM drivers d
      LEFT JOIN states s ON s.id = d.state_id WHERE d.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/drivers
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  const { name, mobile, state_id, address } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const countRes = await db.query('SELECT COUNT(*) FROM drivers');
    const driverNo = parseInt(countRes.rows[0].count) + 1;
    const driver_id = `DRV${String(driverNo).padStart(4, '0')}`;

    const { rows } = await db.query(`
      INSERT INTO drivers (driver_id, name, mobile, state_id, address, created_by)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [driver_id, name, mobile || null, state_id || null, address || null, req.user.id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/drivers/:id
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  const { name, mobile, state_id, address, is_active } = req.body;
  try {
    const { rows } = await db.query(`
      UPDATE drivers SET name = $1, mobile = $2, state_id = $3, address = $4, is_active = $5
      WHERE id = $6 RETURNING *
    `, [name, mobile || null, state_id || null, address || null, is_active !== false, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
