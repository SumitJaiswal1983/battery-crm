const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET / — list all products
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      category,
      is_active,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (category) {
      conditions.push(`category ILIKE $${paramIndex++}`);
      params.push(`%${category}%`);
    }

    if (is_active !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      params.push(is_active === 'true');
    }

    if (search) {
      conditions.push(
        `(name ILIKE $${paramIndex} OR code ILIKE $${paramIndex} OR category ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM products ${whereClause}`,
      params
    );

    const dataResult = await query(
      `SELECT * FROM products
       ${whereClause}
       ORDER BY category ASC, name ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit), offset]
    );

    const total = parseInt(countResult.rows[0].count);

    res.json({
      data: dataResult.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('GET /products error:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// POST / — create product
router.post('/', async (req, res) => {
  try {
    const {
      category = 'Battery',
      name,
      code,
      warranty_months = 0,
      grace_period_days = 0,
      description,
    } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    const result = await query(
      `INSERT INTO products (category, name, code, warranty_months, grace_period_days, description, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING *`,
      [category, name, code, warranty_months, grace_period_days, description]
    );

    res.status(201).json({ data: result.rows[0], message: 'Product created successfully' });
  } catch (err) {
    console.error('POST /products error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Product code already exists' });
    }
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /:id — update product
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      category,
      name,
      code,
      warranty_months,
      grace_period_days,
      description,
      is_active,
    } = req.body;

    const existing = await query('SELECT id FROM products WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const result = await query(
      `UPDATE products SET
         category = COALESCE($1, category),
         name = COALESCE($2, name),
         code = COALESCE($3, code),
         warranty_months = COALESCE($4, warranty_months),
         grace_period_days = COALESCE($5, grace_period_days),
         description = COALESCE($6, description),
         is_active = COALESCE($7, is_active)
       WHERE id = $8
       RETURNING *`,
      [category, name, code, warranty_months, grace_period_days, description, is_active, id]
    );

    res.json({ data: result.rows[0], message: 'Product updated successfully' });
  } catch (err) {
    console.error('PUT /products/:id error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Product code already exists' });
    }
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /:id — soft delete product
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE products SET is_active = false
       WHERE id = $1
       RETURNING id, name, code, is_active`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ data: result.rows[0], message: 'Product deactivated successfully' });
  } catch (err) {
    console.error('DELETE /products/:id error:', err);
    res.status(500).json({ error: 'Failed to deactivate product' });
  }
});

module.exports = router;
