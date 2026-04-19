const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

const INTERNAL_ROLES = ['admin', 'engineer_head', 'service_engineer', 'claim_return', 'claim_dispatch', 'store'];

// GET / — list internal system users
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      role,
      is_active,
      search,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [`role = ANY($1)`];
    const params = [INTERNAL_ROLES];
    let paramIndex = 2;

    if (role && INTERNAL_ROLES.includes(role)) {
      conditions.push(`role = $${paramIndex++}`);
      params.push(role);
    }

    if (is_active !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      params.push(is_active === 'true');
    }

    if (search) {
      conditions.push(
        `(name ILIKE $${paramIndex} OR username ILIKE $${paramIndex} OR mobile ILIKE $${paramIndex} OR emp_code ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query(
      `SELECT COUNT(*) FROM users ${whereClause}`,
      params
    );

    const dataResult = await query(
      `SELECT id, name, username, mobile, email, emp_code, role, is_active, created_at, updated_at
       FROM users
       ${whereClause}
       ORDER BY name ASC
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
    console.error('GET /users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST / — create system user
router.post('/', async (req, res) => {
  try {
    const { name, username, password, mobile, email, emp_code, role } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({ error: 'Name, username, and password are required' });
    }

    if (!role || !INTERNAL_ROLES.includes(role)) {
      return res.status(400).json({
        error: `Role must be one of: ${INTERNAL_ROLES.join(', ')}`,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (name, username, password, mobile, email, emp_code, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING id, name, username, mobile, email, emp_code, role, is_active, created_at`,
      [name, username, hashedPassword, mobile, email, emp_code, role]
    );

    res.status(201).json({ data: result.rows[0], message: 'User created successfully' });
  } catch (err) {
    console.error('POST /users error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /:id — update user
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, username, password, mobile, email, emp_code, role, is_active } = req.body;

    if (role && !INTERNAL_ROLES.includes(role)) {
      return res.status(400).json({
        error: `Role must be one of: ${INTERNAL_ROLES.join(', ')}`,
      });
    }

    const existing = await query('SELECT id FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
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
         is_active = COALESCE($8, is_active),
         updated_at = NOW()
       WHERE id = $9
       RETURNING id, name, username, mobile, email, emp_code, role, is_active, created_at, updated_at`,
      [name, username, hashedPassword, mobile, email, emp_code, role, is_active, id]
    );

    res.json({ data: result.rows[0], message: 'User updated successfully' });
  } catch (err) {
    console.error('PUT /users/:id error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /:id — soft delete (is_active = false)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }

    const result = await query(
      `UPDATE users SET is_active = false, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, username, role, is_active`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ data: result.rows[0], message: 'User deactivated successfully' });
  } catch (err) {
    console.error('DELETE /users/:id error:', err);
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

module.exports = router;
