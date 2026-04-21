const router = require('express').Router();
const jwt = require('jsonwebtoken');
const axios = require('axios');
const db = require('../config/db');
const upload = require('../middleware/upload');
const { authenticateMobile } = require('../middleware/auth');

// ─── OTP helpers ────────────────────────────────────────────────────────────

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTP(mobile, otp) {
  console.log(`[OTP] mobile=${mobile} otp=${otp}`);
  if (!process.env.PINNACLE_API_KEY) return; // skip in dev if not configured

  try {
    // Pinnacle SMS API
    await axios.get('https://api.pinnaclesms.com/api/mt/SendSMS', {
      params: {
        APIKey: process.env.PINNACLE_API_KEY,
        senderid: process.env.PINNACLE_SENDER_ID || 'HFLWIN',
        channel: 'Trans',
        DCS: '0',
        flashsms: '0',
        number: `91${mobile}`,
        text: `Your Highflow Connect OTP is ${otp}. Valid for 10 minutes. Do not share with anyone.`,
        route: process.env.PINNACLE_ROUTE || 'T',
      },
    });
  } catch (err) {
    console.error('[OTP] Pinnacle SMS failed:', err.message);
  }
}

// ─── POST /api/mobile/auth/login ────────────────────────────────────────────
router.post('/auth/login', async (req, res) => {
  const { mobile, role } = req.body;
  if (!mobile || !role) return res.status(400).json({ error: 'mobile and role required' });
  if (!['dealer', 'distributor', 'service_engineer'].includes(role))
    return res.status(400).json({ error: 'Invalid role' });

  try {
    let entity = null;
    if (role === 'distributor') {
      const r = await db.query(
        `SELECT d.id, d.name, d.mobile, d.code, d.address, d.city, d.pincode,
                s.name as state_name, di.name as district_name
         FROM distributors d
         LEFT JOIN states s ON s.id=d.state_id
         LEFT JOIN districts di ON di.id=d.district_id
         WHERE d.mobile=$1 AND d.login_active=true`, [mobile]
      );
      entity = r.rows[0];
    } else if (role === 'dealer') {
      const r = await db.query(
        `SELECT d.id, d.name, d.mobile, d.code, d.address, d.city, d.pincode,
                d.distributor_id,
                s.name as state_name, di.name as district_name
         FROM dealers d
         LEFT JOIN states s ON s.id=d.state_id
         LEFT JOIN districts di ON di.id=d.district_id
         WHERE d.mobile=$1 AND d.login_active=true`, [mobile]
      );
      entity = r.rows[0];
    } else {
      const r = await db.query(
        "SELECT id, name, mobile, emp_code FROM users WHERE mobile=$1 AND role='service_engineer' AND is_active=true", [mobile]
      );
      entity = r.rows[0];
    }

    if (!entity) return res.status(404).json({ error: 'Mobile number not registered or not active' });

    const token = jwt.sign(
      { entity_id: entity.id, entity_type: role, name: entity.name, mobile, role, mobile_user: true },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token, user: entity, role });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/mobile/auth/send-otp ─────────────────────────────────────────
router.post('/auth/send-otp', async (req, res) => {
  const { mobile, role } = req.body;
  if (!mobile || !role) return res.status(400).json({ error: 'mobile and role required' });
  if (!['dealer', 'distributor', 'service_engineer'].includes(role))
    return res.status(400).json({ error: 'Invalid role' });

  try {
    let entity = null;
    if (role === 'distributor') {
      const { rows } = await db.query(
        'SELECT id, name, mobile FROM distributors WHERE mobile=$1 AND login_active=true', [mobile]
      );
      entity = rows[0];
    } else if (role === 'dealer') {
      const { rows } = await db.query(
        'SELECT id, name, mobile FROM dealers WHERE mobile=$1 AND login_active=true', [mobile]
      );
      entity = rows[0];
    } else if (role === 'service_engineer') {
      const { rows } = await db.query(
        "SELECT id, name, mobile FROM users WHERE mobile=$1 AND role='service_engineer' AND is_active=true", [mobile]
      );
      entity = rows[0];
    }

    if (!entity) return res.status(404).json({ error: 'Mobile number not registered or not active' });

    // Invalidate old OTPs
    await db.query('UPDATE mobile_otps SET used=true WHERE mobile=$1 AND role=$2 AND used=false', [mobile, role]);

    const otp = generateOTP();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    await db.query(
      'INSERT INTO mobile_otps (mobile, otp, role, expires_at) VALUES ($1,$2,$3,$4)',
      [mobile, otp, role, expires]
    );

    await sendOTP(mobile, otp);

    const response = { message: 'OTP sent successfully' };
    if (process.env.NODE_ENV !== 'production') response.dev_otp = otp;
    res.json(response);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/mobile/auth/verify-otp ───────────────────────────────────────
router.post('/auth/verify-otp', async (req, res) => {
  const { mobile, role, otp } = req.body;
  if (!mobile || !role || !otp) return res.status(400).json({ error: 'mobile, role and otp required' });

  try {
    const { rows } = await db.query(
      `SELECT * FROM mobile_otps
       WHERE mobile=$1 AND role=$2 AND otp=$3 AND used=false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [mobile, role, otp]
    );
    if (!rows[0]) return res.status(401).json({ error: 'Invalid or expired OTP' });

    await db.query('UPDATE mobile_otps SET used=true WHERE id=$1', [rows[0].id]);

    let entity = null;
    if (role === 'distributor') {
      const r = await db.query(
        `SELECT d.id, d.name, d.mobile, d.code, d.address, d.city, d.pincode,
                s.name as state_name, di.name as district_name
         FROM distributors d
         LEFT JOIN states s ON s.id=d.state_id
         LEFT JOIN districts di ON di.id=d.district_id
         WHERE d.mobile=$1`, [mobile]
      );
      entity = r.rows[0];
    } else if (role === 'dealer') {
      const r = await db.query(
        `SELECT d.id, d.name, d.mobile, d.code, d.address, d.city, d.pincode,
                d.distributor_id,
                s.name as state_name, di.name as district_name
         FROM dealers d
         LEFT JOIN states s ON s.id=d.state_id
         LEFT JOIN districts di ON di.id=d.district_id
         WHERE d.mobile=$1`, [mobile]
      );
      entity = r.rows[0];
    } else {
      const r = await db.query('SELECT id, name, mobile, emp_code FROM users WHERE mobile=$1', [mobile]);
      entity = r.rows[0];
    }

    const token = jwt.sign(
      { entity_id: entity.id, entity_type: role, name: entity.name, mobile, role, mobile_user: true },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token, user: entity, role });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── All routes below require mobile auth ───────────────────────────────────
router.use(authenticateMobile);

// ─── GET /api/mobile/me ──────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  res.json(req.mobileUser);
});

// ─── GET /api/mobile/dashboard ──────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  const { entity_id, entity_type } = req.mobileUser;
  try {
    let condition = '';
    if (entity_type === 'distributor') condition = `AND c.distributor_id = ${entity_id}`;
    else if (entity_type === 'dealer') condition = `AND c.dealer_id = ${entity_id}`;
    else if (entity_type === 'service_engineer') condition = `AND c.engineer_id = ${entity_id}`;

    const stats = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE true) as total_complaints,
        COUNT(*) FILTER (WHERE c.status NOT IN ('closed','cancelled')) as open_complaints,
        COUNT(*) FILTER (WHERE c.status = 'closed' AND c.inspection_result = 'pass') as closed_maintenance,
        COUNT(*) FILTER (WHERE c.status = 'closed' AND c.inspection_result = 'fail') as closed_replacement,
        COUNT(*) FILTER (WHERE c.status = 'inspection_pending') as inspection_pending
      FROM complaints c WHERE 1=1 ${condition}
    `);

    let warrantyStats = null;
    if (entity_type !== 'service_engineer') {
      const ws = await db.query(`
        SELECT
          COUNT(*) as total_registration,
          COUNT(*) FILTER (WHERE wr.warranty_end >= NOW()) as under_warranty,
          COUNT(*) FILTER (WHERE wr.warranty_end < NOW()) as out_of_warranty
        FROM warranty_registrations wr WHERE 1=1
        ${entity_type === 'distributor' ? `AND wr.distributor_id = ${entity_id}` : `AND wr.dealer_id = ${entity_id}`}
      `);
      warrantyStats = ws.rows[0];
    }

    res.json({ complaints: stats.rows[0], warranty: warrantyStats });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/mobile/serial/:serial_no ──────────────────────────────────────
router.get('/serial/:serial_no', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT sn.*, p.name as product_name, p.code as product_code, p.warranty_months,
              wr.warranty_code, wr.warranty_start, wr.warranty_end, wr.date_of_sale,
              c.name as customer_name, c.mobile as customer_mobile
       FROM serial_numbers sn
       LEFT JOIN products p ON p.id = sn.product_id
       LEFT JOIN warranty_registrations wr ON wr.serial_no = sn.serial_no
       LEFT JOIN customers c ON c.id = wr.customer_id
       WHERE sn.serial_no = $1`, [req.params.serial_no]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Serial number not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/mobile/warranty/register ─────────────────────────────────────
router.post('/warranty/register', upload.fields([
  { name: 'warranty_card', maxCount: 1 },
  { name: 'invoice', maxCount: 1 },
  { name: 'insurance', maxCount: 1 },
]), async (req, res) => {
  req.uploadFolder = 'warranty';
  const { entity_id, entity_type } = req.mobileUser;
  const {
    serial_no, product_id, date_of_sale,
    customer_name, customer_mobile, customer_address,
    state_id, district_id, city, pincode
  } = req.body;

  try {
    // Check if already registered
    const existing = await db.query(
      'SELECT id FROM warranty_registrations WHERE serial_no=$1', [serial_no]
    );
    if (existing.rows[0]) return res.status(409).json({ error: 'Serial number already registered' });

    // Find/create customer
    let customerId;
    const cust = await db.query('SELECT id FROM customers WHERE mobile=$1', [customer_mobile]);
    if (cust.rows[0]) {
      customerId = cust.rows[0].id;
    } else {
      const nc = await db.query(
        'INSERT INTO customers (name, mobile, address, state_id, district_id, city, pincode) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
        [customer_name, customer_mobile, customer_address, state_id || null, district_id || null, city, pincode]
      );
      customerId = nc.rows[0].id;
    }

    // Get product warranty months
    const prod = await db.query('SELECT warranty_months FROM products WHERE id=$1', [product_id]);
    const months = prod.rows[0]?.warranty_months || 0;
    const saleDate = date_of_sale ? new Date(date_of_sale) : new Date();
    const warrantyEnd = new Date(saleDate);
    warrantyEnd.setMonth(warrantyEnd.getMonth() + months);

    const warranty_code = 'War' + Date.now().toString().slice(-6);

    const imageFields = {};
    if (req.files?.warranty_card?.[0]) imageFields.warranty_card_url = `/uploads/warranty/${req.files.warranty_card[0].filename}`;
    if (req.files?.invoice?.[0]) imageFields.invoice_url = `/uploads/warranty/${req.files.invoice[0].filename}`;
    if (req.files?.insurance?.[0]) imageFields.insurance_url = `/uploads/warranty/${req.files.insurance[0].filename}`;

    const { rows } = await db.query(
      `INSERT INTO warranty_registrations
        (serial_no, product_id, dealer_id, distributor_id, customer_id, date_of_sale,
         warranty_code, warranty_start, warranty_end,
         warranty_card_url, invoice_url, insurance_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        serial_no, product_id,
        entity_type === 'dealer' ? entity_id : null,
        entity_type === 'distributor' ? entity_id : null,
        customerId, saleDate, warranty_code, saleDate, warrantyEnd,
        imageFields.warranty_card_url || null,
        imageFields.invoice_url || null,
        imageFields.insurance_url || null,
      ]
    );

    // Update serial_numbers warranty_status
    await db.query(
      `UPDATE serial_numbers SET warranty_status='registered', warranty_start=$1, warranty_end=$2
       WHERE serial_no=$3`,
      [saleDate, warrantyEnd, serial_no]
    );

    res.status(201).json({ ...rows[0], warranty_code });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/mobile/complaints ─────────────────────────────────────────────
router.get('/complaints', async (req, res) => {
  const { entity_id, entity_type } = req.mobileUser;
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let conditions = [];
    let params = [];
    let i = 1;

    if (entity_type === 'distributor') { conditions.push(`c.distributor_id = $${i++}`); params.push(entity_id); }
    else if (entity_type === 'dealer') { conditions.push(`c.dealer_id = $${i++}`); params.push(entity_id); }
    else if (entity_type === 'service_engineer') { conditions.push(`c.engineer_id = $${i++}`); params.push(entity_id); }

    if (status && status !== 'all') { conditions.push(`c.status = $${i++}`); params.push(status); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countRes = await db.query(`SELECT COUNT(*) FROM complaints c ${where}`, params);
    const dataRes = await db.query(
      `SELECT c.id, c.complaint_no, c.serial_no, c.status, c.warranty_status, c.complaint_remark,
              c.inspection_result, c.created_at, c.engineer_assign,
              cu.name as customer_name, cu.mobile as customer_mobile,
              p.name as product_name, u.name as engineer_name
       FROM complaints c
       LEFT JOIN customers cu ON cu.id = c.customer_id
       LEFT JOIN products p ON p.id = c.product_id
       LEFT JOIN users u ON u.id = c.engineer_id
       ${where} ORDER BY c.created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    );

    res.json({ total: parseInt(countRes.rows[0].count), data: dataRes.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/mobile/complaints ────────────────────────────────────────────
router.post('/complaints', upload.fields([
  { name: 'battery_image', maxCount: 1 },
  { name: 'battery_image_b', maxCount: 1 },
  { name: 'warranty_card', maxCount: 1 },
  { name: 'bill_copy', maxCount: 1 },
]), async (req, res) => {
  req.uploadFolder = 'complaints';
  const { entity_id, entity_type } = req.mobileUser;
  const {
    serial_no, product_id,
    customer_name, customer_mobile, customer_address,
    state_id, district_id, city, pincode,
    complaint_remark, date_of_purchase,
    warranty_start, warranty_end, warranty_status
  } = req.body;

  try {
    let customerId;
    const cust = await db.query('SELECT id FROM customers WHERE mobile=$1', [customer_mobile]);
    if (cust.rows[0]) {
      customerId = cust.rows[0].id;
    } else {
      const nc = await db.query(
        'INSERT INTO customers (name, mobile, address, state_id, district_id, city, pincode) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
        [customer_name, customer_mobile, customer_address, state_id || null, district_id || null, city, pincode]
      );
      customerId = nc.rows[0].id;
    }

    const complaint_no = new Date().toISOString().slice(0, 10).replace(/-/g, '') + Date.now().toString().slice(-8);

    const { rows } = await db.query(
      `INSERT INTO complaints
        (complaint_no, serial_no, product_id, dealer_id, distributor_id, customer_id,
         date_of_purchase, warranty_start, warranty_end, warranty_status,
         complaint_remark, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending') RETURNING *`,
      [
        complaint_no, serial_no, product_id,
        entity_type === 'dealer' ? entity_id : null,
        entity_type === 'distributor' ? entity_id : null,
        customerId, date_of_purchase || null,
        warranty_start || null, warranty_end || null,
        warranty_status || 'Unknown',
        complaint_remark,
      ]
    );

    const complaintId = rows[0].id;
    const imageTypes = ['battery_image', 'battery_image_b', 'warranty_card', 'bill_copy'];
    for (const type of imageTypes) {
      if (req.files?.[type]?.[0]) {
        await db.query(
          'INSERT INTO complaint_images (complaint_id, image_type, image_url) VALUES ($1,$2,$3)',
          [complaintId, type, `/uploads/complaints/${req.files[type][0].filename}`]
        );
      }
    }

    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/mobile/complaints/:id ─────────────────────────────────────────
router.get('/complaints/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT c.*, cu.name as customer_name, cu.mobile as customer_mobile, cu.address as customer_address,
              p.name as product_name, p.code as product_code,
              u.name as engineer_name, u.mobile as engineer_mobile
       FROM complaints c
       LEFT JOIN customers cu ON cu.id = c.customer_id
       LEFT JOIN products p ON p.id = c.product_id
       LEFT JOIN users u ON u.id = c.engineer_id
       WHERE c.id = $1`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });

    const images = await db.query('SELECT * FROM complaint_images WHERE complaint_id=$1', [req.params.id]);
    res.json({ ...rows[0], images: images.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PUT /api/mobile/engineer/complaints/:id/inspect ────────────────────────
router.put('/engineer/complaints/:id/inspect', upload.fields([
  { name: 'inspection_image', maxCount: 1 },
]), async (req, res) => {
  req.uploadFolder = 'inspections';
  const { entity_id } = req.mobileUser;
  const { result, remark } = req.body;

  if (!['pass', 'fail'].includes(result))
    return res.status(400).json({ error: 'result must be pass or fail' });

  try {
    const newStatus = result === 'pass' ? 'battery_replaced' : 'inspection_fail';
    const { rows } = await db.query(
      `UPDATE complaints SET inspection_result=$1, inspection_status='done', status=$2, updated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [result, newStatus, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Complaint not found' });

    await db.query(
      'INSERT INTO inspection_logs (complaint_id, engineer_id, result, remark) VALUES ($1,$2,$3,$4)',
      [req.params.id, entity_id, result, remark]
    );

    if (req.files?.inspection_image?.[0]) {
      await db.query(
        'INSERT INTO complaint_images (complaint_id, image_type, image_url) VALUES ($1,$2,$3)',
        [req.params.id, 'inspection_image', `/uploads/inspections/${req.files.inspection_image[0].filename}`]
      );
    }

    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/mobile/states ──────────────────────────────────────────────────
router.get('/states', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, name FROM states ORDER BY name');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/mobile/districts/:state_id ────────────────────────────────────
router.get('/districts/:state_id', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name FROM districts WHERE state_id=$1 ORDER BY name', [req.params.state_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/mobile/banners ─────────────────────────────────────────────────
router.get('/banners', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM banners WHERE is_active=true ORDER BY id DESC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/mobile/gallery ─────────────────────────────────────────────────
router.get('/gallery', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM gallery WHERE is_active=true ORDER BY id DESC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
