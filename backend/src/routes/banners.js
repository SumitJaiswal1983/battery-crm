const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// GET /api/banners
router.get('/', async (req, res) => {
  try {
    const { is_active } = req.query;
    let where = '';
    const params = [];
    if (is_active !== undefined) { params.push(is_active === 'true'); where = 'WHERE is_active = $1'; }
    const { rows } = await db.query(`SELECT * FROM banners ${where} ORDER BY created_at DESC`, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/banners
router.post('/', authenticate, authorize('admin'), (req, res, next) => {
  req.uploadFolder = 'banners';
  next();
}, upload.single('image'), async (req, res) => {
  const { title, is_active } = req.body;
  if (!req.file) return res.status(400).json({ error: 'Image required' });
  try {
    const image_url = `/uploads/banners/${req.file.filename}`;
    const { rows } = await db.query(`
      INSERT INTO banners (image_url, title, is_active, created_by)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [image_url, title || null, is_active !== 'false', req.user.id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/banners/:id/toggle
router.put('/:id/toggle', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { rows } = await db.query(`
      UPDATE banners SET is_active = NOT is_active WHERE id = $1 RETURNING *
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/banners/:id
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM banners WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
