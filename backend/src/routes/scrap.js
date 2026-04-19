const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/scrap
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countRes = await db.query('SELECT COUNT(*) FROM scrap_list');
    const { rows } = await db.query(`
      SELECT sl.*, d.name AS dealer_name, d.code AS dealer_code,
             dist.name AS distributor_name, dist.code AS distributor_code
      FROM scrap_list sl
      LEFT JOIN dealers d ON d.id = sl.dealer_id
      LEFT JOIN distributors dist ON dist.id = sl.distributor_id
      ORDER BY sl.updated_at DESC
      LIMIT $1 OFFSET $2
    `, [parseInt(limit), offset]);

    res.json({ data: rows, total: parseInt(countRes.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/scrap/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT sl.*, d.name AS dealer_name, dist.name AS distributor_name
      FROM scrap_list sl
      LEFT JOIN dealers d ON d.id = sl.dealer_id
      LEFT JOIN distributors dist ON dist.id = sl.distributor_id
      WHERE sl.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/scrap
router.post('/', authenticate, authorize('admin', 'store'), async (req, res) => {
  const { dealer_id, distributor_id, want_to_give, want_to_receive_virtual, want_to_receive_actual } = req.body;
  try {
    const { rows } = await db.query(`
      INSERT INTO scrap_list (dealer_id, distributor_id, want_to_give, want_to_receive_virtual, want_to_receive_actual)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [dealer_id || null, distributor_id || null, want_to_give || 0, want_to_receive_virtual || 0, want_to_receive_actual || 0]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/scrap/:id
router.put('/:id', authenticate, authorize('admin', 'store'), async (req, res) => {
  const { want_to_give, want_to_receive_virtual, want_to_receive_actual } = req.body;
  try {
    const { rows } = await db.query(`
      UPDATE scrap_list SET want_to_give = $1, want_to_receive_virtual = $2, want_to_receive_actual = $3, updated_at = NOW()
      WHERE id = $4 RETURNING *
    `, [want_to_give || 0, want_to_receive_virtual || 0, want_to_receive_actual || 0, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
