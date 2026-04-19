const router = require('express').Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authenticate);

// GET /api/complaints
router.get('/', async (req, res) => {
  try {
    const { status, search, page = 1, limit = 50, date_from, date_to, distributor_id, dealer_id } = req.query;
    const offset = (page - 1) * limit;
    let conditions = [];
    let params = [];
    let i = 1;

    if (status && status !== 'all') { conditions.push(`c.status = $${i++}`); params.push(status); }
    if (distributor_id) { conditions.push(`c.distributor_id = $${i++}`); params.push(distributor_id); }
    if (dealer_id) { conditions.push(`c.dealer_id = $${i++}`); params.push(dealer_id); }
    if (date_from) { conditions.push(`c.created_at >= $${i++}`); params.push(date_from); }
    if (date_to) { conditions.push(`c.created_at <= $${i++}`); params.push(date_to + ' 23:59:59'); }
    if (search) {
      conditions.push(`(c.complaint_no ILIKE $${i} OR c.serial_no ILIKE $${i} OR cu.name ILIKE $${i} OR cu.mobile ILIKE $${i})`);
      params.push(`%${search}%`); i++;
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const countRes = await db.query(
      `SELECT COUNT(*) FROM complaints c LEFT JOIN customers cu ON cu.id = c.customer_id ${where}`, params
    );
    const dataRes = await db.query(
      `SELECT c.*, cu.name as customer_name, cu.mobile as customer_mobile,
              p.name as product_name, p.code as product_code,
              d.name as distributor_name, dl.name as dealer_name,
              u.name as engineer_name
       FROM complaints c
       LEFT JOIN customers cu ON cu.id = c.customer_id
       LEFT JOIN products p ON p.id = c.product_id
       LEFT JOIN distributors d ON d.id = c.distributor_id
       LEFT JOIN dealers dl ON dl.id = c.dealer_id
       LEFT JOIN users u ON u.id = c.engineer_id
       ${where} ORDER BY c.created_at DESC LIMIT $${i} OFFSET $${i+1}`,
      [...params, limit, offset]
    );

    // Get status counts
    const countsRes = await db.query(`
      SELECT status, COUNT(*) as count FROM complaints GROUP BY status
    `);
    const counts = {};
    countsRes.rows.forEach(r => counts[r.status] = parseInt(r.count));
    counts.all = Object.values(counts).reduce((a, b) => a + b, 0);

    res.json({ total: parseInt(countRes.rows[0].count), counts, data: dataRes.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/complaints/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT c.*, cu.name as customer_name, cu.mobile as customer_mobile, cu.address as customer_address,
              p.name as product_name, p.code as product_code,
              d.name as distributor_name, dl.name as dealer_name,
              u.name as engineer_name, u.mobile as engineer_mobile
       FROM complaints c
       LEFT JOIN customers cu ON cu.id = c.customer_id
       LEFT JOIN products p ON p.id = c.product_id
       LEFT JOIN distributors d ON d.id = c.distributor_id
       LEFT JOIN dealers dl ON dl.id = c.dealer_id
       LEFT JOIN users u ON u.id = c.engineer_id
       WHERE c.id = $1`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });

    const images = await db.query('SELECT * FROM complaint_images WHERE complaint_id = $1', [req.params.id]);
    const logs = await db.query(
      `SELECT il.*, u.name as engineer_name FROM inspection_logs il
       LEFT JOIN users u ON u.id = il.engineer_id
       WHERE il.complaint_id = $1 ORDER BY il.created_at DESC`, [req.params.id]
    );

    res.json({ ...rows[0], images: images.rows, inspection_logs: logs.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/complaints — Add new complaint with images
router.post('/', upload.fields([
  { name: 'warranty_card', maxCount: 1 },
  { name: 'bill_copy', maxCount: 1 },
  { name: 'battery_image', maxCount: 1 },
  { name: 'battery_image_b', maxCount: 1 },
]), async (req, res) => {
  try {
    const { serial_no, product_id, dealer_id, distributor_id, customer_name, customer_mobile,
            customer_address, state_id, district_id, city, pincode, complaint_remark,
            date_of_purchase, warranty_start, warranty_end, warranty_status } = req.body;

    // Find or create customer
    let customerId;
    const existing = await db.query('SELECT id FROM customers WHERE mobile = $1', [customer_mobile]);
    if (existing.rows[0]) {
      customerId = existing.rows[0].id;
    } else {
      const newCust = await db.query(
        'INSERT INTO customers (name, mobile, address, state_id, district_id, city, pincode) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
        [customer_name, customer_mobile, customer_address, state_id, district_id, city, pincode]
      );
      customerId = newCust.rows[0].id;
    }

    // Generate complaint number
    const complaint_no = `${new Date().toISOString().slice(0,10).replace(/-/g,'')}${Date.now().toString().slice(-8)}`;

    const { rows } = await db.query(
      `INSERT INTO complaints (complaint_no, serial_no, product_id, dealer_id, distributor_id, customer_id,
        date_of_purchase, warranty_start, warranty_end, warranty_status, complaint_remark, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',$12) RETURNING *`,
      [complaint_no, serial_no, product_id, dealer_id, distributor_id, customerId,
       date_of_purchase, warranty_start, warranty_end, warranty_status, complaint_remark, req.user.id]
    );

    const complaintId = rows[0].id;

    // Save images
    const imageTypes = ['warranty_card', 'bill_copy', 'battery_image', 'battery_image_b'];
    for (const type of imageTypes) {
      if (req.files?.[type]?.[0]) {
        const url = `/uploads/complaints/${req.files[type][0].filename}`;
        await db.query(
          'INSERT INTO complaint_images (complaint_id, image_type, image_url) VALUES ($1,$2,$3)',
          [complaintId, type, url]
        );
      }
    }

    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/complaints/:id — Update complaint
router.put('/:id', async (req, res) => {
  try {
    const { serial_no, product_id, complaint_remark, warranty_status } = req.body;
    const { rows } = await db.query(
      `UPDATE complaints SET serial_no=$1, product_id=$2, complaint_remark=$3, warranty_status=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [serial_no, product_id, complaint_remark, warranty_status, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/complaints/:id/assign-engineer
router.put('/:id/assign-engineer', async (req, res) => {
  try {
    const { engineer_id } = req.body;
    const { rows } = await db.query(
      `UPDATE complaints SET engineer_id=$1, engineer_assign=true, status='inspection_pending',
       inspection_status='pending', updated_at=NOW() WHERE id=$2 RETURNING *`,
      [engineer_id, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/complaints/:id/inspect
router.put('/:id/inspect', async (req, res) => {
  try {
    const { result, remark } = req.body; // result: pass | fail
    const newStatus = result === 'pass' ? 'battery_replaced' : 'inspection_fail';
    const { rows } = await db.query(
      `UPDATE complaints SET inspection_result=$1, inspection_status='done', status=$2, updated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [result, newStatus, req.params.id]
    );
    await db.query(
      'INSERT INTO inspection_logs (complaint_id, engineer_id, result, remark) VALUES ($1,$2,$3,$4)',
      [req.params.id, req.user.id, result, remark]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/complaints/:id/cancel
router.put('/:id/cancel', async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE complaints SET status='cancelled', updated_at=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
