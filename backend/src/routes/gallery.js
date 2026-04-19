const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// GET /api/gallery
router.get('/', async (req, res) => {
  try {
    const { is_active } = req.query;
    let where = '';
    const params = [];
    if (is_active !== undefined) { params.push(is_active === 'true'); where = 'WHERE is_active = $1'; }
    const { rows } = await db.query(`SELECT * FROM gallery ${where} ORDER BY created_at DESC`, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/gallery
router.post('/', authenticate, authorize('admin'), (req, res, next) => {
  req.uploadFolder = 'gallery';
  next();
}, upload.single('thumbnail'), async (req, res) => {
  const { title, video_url, is_active } = req.body;
  if (!title || !video_url) return res.status(400).json({ error: 'Title and video_url required' });
  try {
    const thumbnail = req.file ? `/uploads/gallery/${req.file.filename}` : null;
    const { rows } = await db.query(`
      INSERT INTO gallery (title, video_url, thumbnail, is_active, created_by)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [title, video_url, thumbnail, is_active !== 'false', req.user.id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/gallery/:id
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  const { title, video_url, is_active } = req.body;
  try {
    const { rows } = await db.query(`
      UPDATE gallery SET title = $1, video_url = $2, is_active = $3 WHERE id = $4 RETURNING *
    `, [title, video_url, is_active !== false, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/gallery/:id
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM gallery WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
