const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET / — list customers with pagination and search
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      state_id,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (state_id) {
      conditions.push(`c.state_id = $${paramIndex++}`);
      params.push(state_id);
    }

    if (search) {
      conditions.push(
        `(c.name ILIKE $${paramIndex} OR c.mobile ILIKE $${paramIndex} OR s.name ILIKE $${paramIndex} OR c.city ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM customers c
       LEFT JOIN states s ON c.state_id = s.id
       ${whereClause}`,
      params
    );

    const dataResult = await query(
      `SELECT c.*, s.name AS state_name, d.name AS district_name
       FROM customers c
       LEFT JOIN states s ON c.state_id = s.id
       LEFT JOIN districts d ON c.district_id = d.id
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
    console.error('GET /customers error:', err);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// GET /:id — single customer with their complaints
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { complaints_page = 1, complaints_limit = 10 } = req.query;
    const offset = (parseInt(complaints_page) - 1) * parseInt(complaints_limit);

    const customerResult = await query(
      `SELECT c.*, s.name AS state_name, d.name AS district_name
       FROM customers c
       LEFT JOIN states s ON c.state_id = s.id
       LEFT JOIN districts d ON c.district_id = d.id
       WHERE c.id = $1`,
      [id]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const complaintsResult = await query(
      `SELECT c.*, p.name AS product_name, dl.name AS dealer_name, dist.name AS distributor_name
       FROM complaints c
       LEFT JOIN products p ON c.product_id = p.id
       LEFT JOIN dealers dl ON c.dealer_id = dl.id
       LEFT JOIN distributors dist ON c.distributor_id = dist.id
       WHERE c.customer_id = $1
       ORDER BY c.created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, parseInt(complaints_limit), offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) FROM complaints WHERE customer_id = $1',
      [id]
    );

    const customer = customerResult.rows[0];
    customer.complaints = complaintsResult.rows;
    customer.complaint_count = parseInt(countResult.rows[0].count);

    res.json({ data: customer });
  } catch (err) {
    console.error('GET /customers/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// POST / — create customer
router.post('/', async (req, res) => {
  try {
    const { name, mobile, email, address, state_id, district_id, city, pincode } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await query(
      `INSERT INTO customers (name, mobile, email, address, state_id, district_id, city, pincode)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [name, mobile, email, address, state_id, district_id, city, pincode]
    );

    res.status(201).json({ data: result.rows[0], message: 'Customer created successfully' });
  } catch (err) {
    console.error('POST /customers error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Mobile number already registered' });
    }
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// PUT /:id — update customer
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, mobile, email, address, state_id, district_id, city, pincode } = req.body;

    const existing = await query('SELECT id FROM customers WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const result = await query(
      `UPDATE customers SET
         name = COALESCE($1, name),
         mobile = COALESCE($2, mobile),
         email = COALESCE($3, email),
         address = COALESCE($4, address),
         state_id = COALESCE($5, state_id),
         district_id = COALESCE($6, district_id),
         city = COALESCE($7, city),
         pincode = COALESCE($8, pincode),
         updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [name, mobile, email, address, state_id, district_id, city, pincode, id]
    );

    res.json({ data: result.rows[0], message: 'Customer updated successfully' });
  } catch (err) {
    console.error('PUT /customers/:id error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Mobile number already registered' });
    }
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

module.exports = router;
