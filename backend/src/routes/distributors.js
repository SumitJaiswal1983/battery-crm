const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET / — list distributors with pagination, filters, search
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      state_id,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`d.status = $${paramIndex++}`);
      params.push(status);
    }

    if (state_id) {
      conditions.push(`d.state_id = $${paramIndex++}`);
      params.push(state_id);
    }

    if (search) {
      conditions.push(
        `(d.name ILIKE $${paramIndex} OR d.code ILIKE $${paramIndex} OR d.mobile ILIKE $${paramIndex} OR s.name ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM distributors d
       LEFT JOIN states s ON d.state_id = s.id
       ${whereClause}`,
      params
    );

    const dataResult = await query(
      `SELECT d.*, s.name AS state_name, dist.name AS district_name,
              u.name AS engineer_name, cb.name AS created_by_name
       FROM distributors d
       LEFT JOIN states s ON d.state_id = s.id
       LEFT JOIN districts dist ON d.district_id = dist.id
       LEFT JOIN users u ON d.engineer_id = u.id
       LEFT JOIN users cb ON d.created_by = cb.id
       ${whereClause}
       ORDER BY d.created_at DESC
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
    console.error('GET /distributors error:', err);
    res.status(500).json({ error: 'Failed to fetch distributors' });
  }
});

// GET /:id — single distributor with complaint count
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT d.*, s.name AS state_name, dist.name AS district_name,
              u.name AS engineer_name, cb.name AS created_by_name
       FROM distributors d
       LEFT JOIN states s ON d.state_id = s.id
       LEFT JOIN districts dist ON d.district_id = dist.id
       LEFT JOIN users u ON d.engineer_id = u.id
       LEFT JOIN users cb ON d.created_by = cb.id
       WHERE d.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Distributor not found' });
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM complaints WHERE distributor_id = $1`,
      [id]
    );

    const distributor = result.rows[0];
    distributor.complaint_count = parseInt(countResult.rows[0].count);

    res.json({ data: distributor });
  } catch (err) {
    console.error('GET /distributors/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch distributor' });
  }
});

// POST / — create new distributor
router.post('/', async (req, res) => {
  try {
    const {
      name, code, party_code, contact_person, mobile, email,
      gst_no, pan_no, address, state_id, district_id, city, pincode,
      username, password, engineer_id,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    let password_hash = null;
    if (password) {
      password_hash = await bcrypt.hash(password, 10);
    }

    const result = await query(
      `INSERT INTO distributors
         (name, code, party_code, contact_person, mobile, email, gst_no, pan_no,
          address, state_id, district_id, city, pincode, username, password_hash,
          engineer_id, status, login_active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'pending',false,$17)
       RETURNING *`,
      [
        name, code, party_code, contact_person, mobile, email,
        gst_no, pan_no, address, state_id, district_id, city, pincode,
        username, password_hash, engineer_id, req.user.id,
      ]
    );

    res.status(201).json({ data: result.rows[0], message: 'Distributor created successfully' });
  } catch (err) {
    console.error('POST /distributors error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Distributor code or username already exists' });
    }
    res.status(500).json({ error: 'Failed to create distributor' });
  }
});

// PUT /:id — update distributor
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, code, party_code, contact_person, mobile, email,
      gst_no, pan_no, address, state_id, district_id, city, pincode,
      username, password, engineer_id, login_active,
    } = req.body;

    const existing = await query('SELECT id FROM distributors WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Distributor not found' });
    }

    let password_hash;
    if (password) {
      password_hash = await bcrypt.hash(password, 10);
    }

    const result = await query(
      `UPDATE distributors SET
         name = COALESCE($1, name),
         code = COALESCE($2, code),
         party_code = COALESCE($3, party_code),
         contact_person = COALESCE($4, contact_person),
         mobile = COALESCE($5, mobile),
         email = COALESCE($6, email),
         gst_no = COALESCE($7, gst_no),
         pan_no = COALESCE($8, pan_no),
         address = COALESCE($9, address),
         state_id = COALESCE($10, state_id),
         district_id = COALESCE($11, district_id),
         city = COALESCE($12, city),
         pincode = COALESCE($13, pincode),
         username = COALESCE($14, username),
         password_hash = COALESCE($15, password_hash),
         engineer_id = COALESCE($16, engineer_id),
         login_active = COALESCE($17, login_active),
         updated_at = NOW()
       WHERE id = $18
       RETURNING *`,
      [
        name, code, party_code, contact_person, mobile, email,
        gst_no, pan_no, address, state_id, district_id, city, pincode,
        username, password_hash, engineer_id, login_active, id,
      ]
    );

    res.json({ data: result.rows[0], message: 'Distributor updated successfully' });
  } catch (err) {
    console.error('PUT /distributors/:id error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Distributor code or username already exists' });
    }
    res.status(500).json({ error: 'Failed to update distributor' });
  }
});

// PUT /:id/approve — approve distributor
router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE distributors SET status = 'approved', login_active = true, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Distributor not found' });
    }

    res.json({ data: result.rows[0], message: 'Distributor approved successfully' });
  } catch (err) {
    console.error('PUT /distributors/:id/approve error:', err);
    res.status(500).json({ error: 'Failed to approve distributor' });
  }
});

// PUT /:id/reject — reject/delete distributor
router.put('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE distributors SET status = 'deleted', login_active = false, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Distributor not found' });
    }

    res.json({ data: result.rows[0], message: 'Distributor rejected successfully' });
  } catch (err) {
    console.error('PUT /distributors/:id/reject error:', err);
    res.status(500).json({ error: 'Failed to reject distributor' });
  }
});

// GET /:id/complaints — list complaints for this distributor
router.get('/:id/complaints', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const distCheck = await query('SELECT id FROM distributors WHERE id = $1', [id]);
    if (distCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Distributor not found' });
    }

    const conditions = ['c.distributor_id = $1'];
    const params = [id];
    let paramIndex = 2;

    if (status) {
      conditions.push(`c.status = $${paramIndex++}`);
      params.push(status);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query(
      `SELECT COUNT(*) FROM complaints c ${whereClause}`,
      params
    );

    const dataResult = await query(
      `SELECT c.*, cu.name AS customer_name, cu.mobile AS customer_mobile,
              d.name AS dealer_name, p.name AS product_name, u.name AS engineer_name
       FROM complaints c
       LEFT JOIN customers cu ON c.customer_id = cu.id
       LEFT JOIN dealers d ON c.dealer_id = d.id
       LEFT JOIN products p ON c.product_id = p.id
       LEFT JOIN users u ON c.engineer_id = u.id
       ${whereClause}
       ORDER BY c.created_at DESC
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
    console.error('GET /distributors/:id/complaints error:', err);
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
});

module.exports = router;
