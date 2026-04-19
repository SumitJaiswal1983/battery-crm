const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const ENGINEER_ROLES = ['engineer_head', 'service_engineer', 'claim_return', 'claim_dispatch'];

// All routes require authentication
router.use(authenticate);

// GET / — list engineers, optionally filter by role
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      role,
      search,
      is_active,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [`u.role = ANY($1)`];
    const params = [ENGINEER_ROLES];
    let paramIndex = 2;

    if (role && ENGINEER_ROLES.includes(role)) {
      conditions.push(`u.role = $${paramIndex++}`);
      params.push(role);
    }

    if (is_active !== undefined) {
      conditions.push(`u.is_active = $${paramIndex++}`);
      params.push(is_active === 'true');
    }

    if (search) {
      conditions.push(
        `(u.name ILIKE $${paramIndex} OR u.username ILIKE $${paramIndex} OR u.mobile ILIKE $${paramIndex} OR u.emp_code ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query(
      `SELECT COUNT(*) FROM users u ${whereClause}`,
      params
    );

    const dataResult = await query(
      `SELECT u.id, u.name, u.username, u.mobile, u.email, u.emp_code, u.role, u.is_active, u.created_at, u.updated_at
       FROM users u
       ${whereClause}
       ORDER BY u.name ASC
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
    console.error('GET /engineers error:', err);
    res.status(500).json({ error: 'Failed to fetch engineers' });
  }
});

// GET /:id — single engineer
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT u.id, u.name, u.username, u.mobile, u.email, u.emp_code, u.role, u.is_active, u.created_at, u.updated_at
       FROM users u
       WHERE u.id = $1 AND u.role = ANY($2)`,
      [id, ENGINEER_ROLES]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Engineer not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('GET /engineers/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch engineer' });
  }
});

// POST / — create engineer user
router.post('/', async (req, res) => {
  try {
    const { name, username, password, mobile, email, emp_code, role } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({ error: 'Name, username, and password are required' });
    }

    if (!role || !ENGINEER_ROLES.includes(role)) {
      return res.status(400).json({
        error: `Role must be one of: ${ENGINEER_ROLES.join(', ')}`,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (name, username, password, mobile, email, emp_code, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING id, name, username, mobile, email, emp_code, role, is_active, created_at`,
      [name, username, hashedPassword, mobile, email, emp_code, role]
    );

    res.status(201).json({ data: result.rows[0], message: 'Engineer created successfully' });
  } catch (err) {
    console.error('POST /engineers error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Failed to create engineer' });
  }
});

// PUT /:id — update engineer
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, username, password, mobile, email, emp_code, role } = req.body;

    if (role && !ENGINEER_ROLES.includes(role)) {
      return res.status(400).json({
        error: `Role must be one of: ${ENGINEER_ROLES.join(', ')}`,
      });
    }

    const existing = await query(
      'SELECT id FROM users WHERE id = $1 AND role = ANY($2)',
      [id, ENGINEER_ROLES]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Engineer not found' });
    }

    let hashedPassword;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const result = await query(
      `UPDATE users SET
         name = COALESCE($1, name),
         username = COALESCE($2, username),
         password = COALESCE($3, password),
         mobile = COALESCE($4, mobile),
         email = COALESCE($5, email),
         emp_code = COALESCE($6, emp_code),
         role = COALESCE($7, role),
         updated_at = NOW()
       WHERE id = $8
       RETURNING id, name, username, mobile, email, emp_code, role, is_active, created_at, updated_at`,
      [name, username, hashedPassword, mobile, email, emp_code, role, id]
    );

    res.json({ data: result.rows[0], message: 'Engineer updated successfully' });
  } catch (err) {
    console.error('PUT /engineers/:id error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Failed to update engineer' });
  }
});

// DELETE /:id — soft delete (is_active = false)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE users SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND role = ANY($2)
       RETURNING id, name, role, is_active`,
      [id, ENGINEER_ROLES]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Engineer not found' });
    }

    res.json({ data: result.rows[0], message: 'Engineer deactivated successfully' });
  } catch (err) {
    console.error('DELETE /engineers/:id error:', err);
    res.status(500).json({ error: 'Failed to deactivate engineer' });
  }
});

module.exports = router;
