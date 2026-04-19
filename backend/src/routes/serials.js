const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET / — list serial numbers with filters
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      warranty_status,
      date_from,
      date_to,
      dealer_search,
      distributor_id,
      dealer_id,
      product_id,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (warranty_status) {
      conditions.push(`sn.warranty_status = $${paramIndex++}`);
      params.push(warranty_status);
    }

    if (distributor_id) {
      conditions.push(`sn.distributor_id = $${paramIndex++}`);
      params.push(distributor_id);
    }

    if (dealer_id) {
      conditions.push(`sn.dealer_id = $${paramIndex++}`);
      params.push(dealer_id);
    }

    if (product_id) {
      conditions.push(`sn.product_id = $${paramIndex++}`);
      params.push(product_id);
    }

    if (date_from) {
      conditions.push(`sn.created_at >= $${paramIndex++}`);
      params.push(date_from);
    }

    if (date_to) {
      conditions.push(`sn.created_at <= $${paramIndex++}`);
      params.push(date_to + ' 23:59:59');
    }

    if (dealer_search) {
      conditions.push(
        `(d.name ILIKE $${paramIndex} OR d.code ILIKE $${paramIndex} OR d.mobile ILIKE $${paramIndex})`
      );
      params.push(`%${dealer_search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM serial_numbers sn
       LEFT JOIN dealers d ON sn.dealer_id = d.id
       ${whereClause}`,
      params
    );

    const dataResult = await query(
      `SELECT sn.*, p.name AS product_name, p.code AS product_code,
              d.name AS dealer_name, d.mobile AS dealer_mobile,
              dist.name AS distributor_name, cb.name AS created_by_name
       FROM serial_numbers sn
       LEFT JOIN products p ON sn.product_id = p.id
       LEFT JOIN dealers d ON sn.dealer_id = d.id
       LEFT JOIN distributors dist ON sn.distributor_id = dist.id
       LEFT JOIN users cb ON sn.created_by = cb.id
       ${whereClause}
       ORDER BY sn.created_at DESC
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
    console.error('GET /serials error:', err);
    res.status(500).json({ error: 'Failed to fetch serial numbers' });
  }
});

// POST / — add single serial number
router.post('/', async (req, res) => {
  try {
    const {
      serial_no,
      product_id,
      dealer_id,
      distributor_id,
      party_invoice_date,
      bill_to,
      warranty_status = 'pending',
      warranty_start,
      warranty_end,
    } = req.body;

    if (!serial_no || !product_id) {
      return res.status(400).json({ error: 'Serial number and product_id are required' });
    }

    const result = await query(
      `INSERT INTO serial_numbers
         (serial_no, product_id, dealer_id, distributor_id, party_invoice_date,
          bill_to, warranty_status, warranty_start, warranty_end, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        serial_no, product_id, dealer_id, distributor_id, party_invoice_date,
        bill_to, warranty_status, warranty_start, warranty_end, req.user.id,
      ]
    );

    res.status(201).json({ data: result.rows[0], message: 'Serial number added successfully' });
  } catch (err) {
    console.error('POST /serials error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Serial number already exists' });
    }
    res.status(500).json({ error: 'Failed to add serial number' });
  }
});

// POST /bulk-request — create a bulk upload request
router.post('/bulk-request', async (req, res) => {
  try {
    const { party_name, party_mobile, items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required and must not be empty' });
    }

    // Validate each item
    for (const item of items) {
      if (!item.serial_no || !item.product_id) {
        return res.status(400).json({ error: 'Each item must have serial_no and product_id' });
      }
    }

    // Generate unique request number
    const timestamp = Date.now();
    const request_no = `BUR-${timestamp}`;

    // Insert request record
    const requestResult = await query(
      `INSERT INTO serial_upload_requests (request_no, party_name, party_mobile, total_items, status, created_by)
       VALUES ($1, $2, $3, $4, 'pending', $5)
       RETURNING *`,
      [request_no, party_name, party_mobile, items.length, req.user.id]
    );

    const request = requestResult.rows[0];

    // Insert individual items
    const insertedItems = [];
    for (const item of items) {
      const itemResult = await query(
        `INSERT INTO serial_upload_items (request_id, serial_no, product_id)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [request.id, item.serial_no, item.product_id]
      );
      insertedItems.push(itemResult.rows[0]);
    }

    res.status(201).json({
      data: { ...request, items: insertedItems },
      message: 'Bulk upload request created successfully',
    });
  } catch (err) {
    console.error('POST /serials/bulk-request error:', err);
    res.status(500).json({ error: 'Failed to create bulk upload request' });
  }
});

// GET /requests — list bulk upload requests
router.get('/requests', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`r.status = $${paramIndex++}`);
      params.push(status);
    }

    if (search) {
      conditions.push(
        `(r.request_no ILIKE $${paramIndex} OR r.party_name ILIKE $${paramIndex} OR r.party_mobile ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM serial_upload_requests r ${whereClause}`,
      params
    );

    const dataResult = await query(
      `SELECT r.*, u.name AS created_by_name
       FROM serial_upload_requests r
       LEFT JOIN users u ON r.created_by = u.id
       ${whereClause}
       ORDER BY r.created_at DESC
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
    console.error('GET /serials/requests error:', err);
    res.status(500).json({ error: 'Failed to fetch upload requests' });
  }
});

// PUT /requests/:id/approve — approve bulk request and register serials
router.put('/requests/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      dealer_id,
      distributor_id,
      party_invoice_date,
      warranty_start,
      warranty_end,
    } = req.body;

    // Fetch the request
    const requestResult = await query(
      `SELECT * FROM serial_upload_requests WHERE id = $1`,
      [id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Upload request not found' });
    }

    const request = requestResult.rows[0];

    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request is already ${request.status}` });
    }

    // Fetch all items in this request
    const itemsResult = await query(
      `SELECT * FROM serial_upload_items WHERE request_id = $1`,
      [id]
    );

    const items = itemsResult.rows;

    // Insert serial numbers as registered
    const registeredSerials = [];
    const failedItems = [];

    for (const item of items) {
      try {
        const insertResult = await query(
          `INSERT INTO serial_numbers
             (serial_no, product_id, dealer_id, distributor_id, party_invoice_date,
              warranty_status, warranty_start, warranty_end, created_by)
           VALUES ($1, $2, $3, $4, $5, 'registered', $6, $7, $8)
           ON CONFLICT (serial_no) DO UPDATE SET
             warranty_status = 'registered',
             dealer_id = COALESCE($3, serial_numbers.dealer_id),
             distributor_id = COALESCE($4, serial_numbers.distributor_id),
             party_invoice_date = COALESCE($5, serial_numbers.party_invoice_date),
             warranty_start = COALESCE($6, serial_numbers.warranty_start),
             warranty_end = COALESCE($7, serial_numbers.warranty_end)
           RETURNING *`,
          [
            item.serial_no, item.product_id, dealer_id, distributor_id,
            party_invoice_date, warranty_start, warranty_end, req.user.id,
          ]
        );
        registeredSerials.push(insertResult.rows[0]);
      } catch (itemErr) {
        failedItems.push({ serial_no: item.serial_no, error: itemErr.message });
      }
    }

    // Update request status
    const updatedRequest = await query(
      `UPDATE serial_upload_requests SET status = 'approved' WHERE id = $1 RETURNING *`,
      [id]
    );

    res.json({
      data: updatedRequest.rows[0],
      registered: registeredSerials.length,
      failed: failedItems,
      message: `Bulk request approved. ${registeredSerials.length} serials registered, ${failedItems.length} failed.`,
    });
  } catch (err) {
    console.error('PUT /serials/requests/:id/approve error:', err);
    res.status(500).json({ error: 'Failed to approve bulk request' });
  }
});

module.exports = router;
