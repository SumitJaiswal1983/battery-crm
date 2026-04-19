const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET / — list dealers with pagination, filters, search
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      distributor_id,
      state_id,
      search,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`dl.status = $${paramIndex++}`);
      params.push(status);
    }

    if (distributor_id) {
      conditions.push(`dl.distributor_id = $${paramIndex++}`);
      params.push(distributor_id);
    }

    if (state_id) {
      conditions.push(`dl.state_id = $${paramIndex++}`);
      params.push(state_id);
    }

    if (search) {
      conditions.push(
        `(dl.name ILIKE $${paramIndex} OR dl.code ILIKE $${paramIndex} OR dl.mobile ILIKE $${paramIndex} OR dl.contact_person ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM dealers dl ${whereClause}`,
      params
    );

    const dataResult = await query(
      `SELECT dl.*, d.name AS distributor_name, s.name AS state_name,
              dist.name AS district_name, cb.name AS created_by_name
       FROM dealers dl
       LEFT JOIN distributors d ON dl.distributor_id = d.id
       LEFT JOIN states s ON dl.state_id = s.id
       LEFT JOIN districts dist ON dl.district_id = dist.id
       LEFT JOIN users cb ON dl.created_by = cb.id
       ${whereClause}
       ORDER BY dl.created_at DESC
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
    console.error('GET /dealers error:', err);
    res.status(500).json({ error: 'Failed to fetch dealers' });
  }
});

// GET /:id — single dealer
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT dl.*, d.name AS distributor_name, s.name AS state_name,
              dist.name AS district_name, cb.name AS created_by_name
       FROM dealers dl
       LEFT JOIN distributors d ON dl.distributor_id = d.id
       LEFT JOIN states s ON dl.state_id = s.id
       LEFT JOIN districts dist ON dl.district_id = dist.id
       LEFT JOIN users cb ON dl.created_by = cb.id
       WHERE dl.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dealer not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('GET /dealers/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch dealer' });
  }
});

// POST / — create dealer
router.post('/', async (req, res) => {
  try {
    const {
      distributor_id, name, code, party_code, contact_person,
      mobile, email, gst_no, address, state_id, district_id,
      city, pincode, username, password,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    let password_hash = null;
    if (password) {
      password_hash = await bcrypt.hash(password, 10);
    }

    const result = await query(
      `INSERT INTO dealers
         (distributor_id, name, code, party_code, contact_person, mobile, email,
          gst_no, address, state_id, district_id, city, pincode, username,
          password_hash, status, login_active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'pending',false,$16)
       RETURNING *`,
      [
        distributor_id, name, code, party_code, contact_person,
        mobile, email, gst_no, address, state_id, district_id,
        city, pincode, username, password_hash, req.user.id,
      ]
    );

    res.status(201).json({ data: result.rows[0], message: 'Dealer created successfully' });
  } catch (err) {
    console.error('POST /dealers error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Dealer code or username already exists' });
    }
    res.status(500).json({ error: 'Failed to create dealer' });
  }
});

// PUT /:id — update dealer
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      distributor_id, name, code, party_code, contact_person,
      mobile, email, gst_no, address, state_id, district_id,
      city, pincode, username, password, login_active,
    } = req.body;

    const existing = await query('SELECT id FROM dealers WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Dealer not found' });
    }

    let password_hash;
    if (password) {
      password_hash = await bcrypt.hash(password, 10);
    }

    const result = await query(
      `UPDATE dealers SET
         distributor_id = COALESCE($1, distributor_id),
         name = COALESCE($2, name),
         code = COALESCE($3, code),
         party_code = COALESCE($4, party_code),
         contact_person = COALESCE($5, contact_person),
         mobile = COALESCE($6, mobile),
         email = COALESCE($7, email),
         gst_no = COALESCE($8, gst_no),
         address = COALESCE($9, address),
         state_id = COALESCE($10, state_id),
         district_id = COALESCE($11, district_id),
         city = COALESCE($12, city),
         pincode = COALESCE($13, pincode),
         username = COALESCE($14, username),
         password_hash = COALESCE($15, password_hash),
         login_active = COALESCE($16, login_active),
         updated_at = NOW()
       WHERE id = $17
       RETURNING *`,
      [
        distributor_id, name, code, party_code, contact_person,
        mobile, email, gst_no, address, state_id, district_id,
        city, pincode, username, password_hash, login_active, id,
      ]
    );

    res.json({ data: result.rows[0], message: 'Dealer updated successfully' });
  } catch (err) {
    console.error('PUT /dealers/:id error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Dealer code or username already exists' });
    }
    res.status(500).json({ error: 'Failed to update dealer' });
  }
});

// PUT /:id/approve — approve dealer
router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE dealers SET status = 'approved', login_active = true, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dealer not found' });
    }

    res.json({ data: result.rows[0], message: 'Dealer approved successfully' });
  } catch (err) {
    console.error('PUT /dealers/:id/approve error:', err);
    res.status(500).json({ error: 'Failed to approve dealer' });
  }
});

// PUT /:id/reject — reject dealer
router.put('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE dealers SET status = 'deleted', login_active = false, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dealer not found' });
    }

    res.json({ data: result.rows[0], message: 'Dealer rejected successfully' });
  } catch (err) {
    console.error('PUT /dealers/:id/reject error:', err);
    res.status(500).json({ error: 'Failed to reject dealer' });
  }
});

// GET /:id/complaints — complaints for this dealer
router.get('/:id/complaints', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const dealerCheck = await query('SELECT id FROM dealers WHERE id = $1', [id]);
    if (dealerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Dealer not found' });
    }

    const conditions = ['c.dealer_id = $1'];
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
              p.name AS product_name, u.name AS engineer_name
       FROM complaints c
       LEFT JOIN customers cu ON c.customer_id = cu.id
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
    console.error('GET /dealers/:id/complaints error:', err);
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
});

module.exports = router;
