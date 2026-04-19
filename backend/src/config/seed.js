require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    // Admin user
    const hash = await bcrypt.hash('Admin@123', 10);
    await db.query(`
      INSERT INTO users (name, username, password, role, mobile, emp_code, is_active)
      VALUES
        ('Super Admin', 'admin', $1, 'admin', '9999999999', 'EMP001', true),
        ('Claim Dispatch', 'dispatch', $1, 'claim_dispatch', '9999999998', 'EMP002', true),
        ('Claim Return', 'returns', $1, 'claim_return', '9999999997', 'EMP003', true),
        ('Store Manager', 'store', $1, 'store', '9999999996', 'EMP004', true),
        ('Engineer Head', 'enghead', $1, 'engineer_head', '9999999995', 'EMP005', true),
        ('Service Engineer 1', 'engineer1', $1, 'service_engineer', '9888888881', 'EMP006', true),
        ('Service Engineer 2', 'engineer2', $1, 'service_engineer', '9888888882', 'EMP007', true)
      ON CONFLICT (username) DO NOTHING
    `, [hash]);
    console.log('✅ Users seeded');

    // States
    await db.query(`
      INSERT INTO states (name) VALUES
        ('Maharashtra'), ('Gujarat'), ('Rajasthan'), ('Delhi'),
        ('Uttar Pradesh'), ('Karnataka'), ('Tamil Nadu'), ('Punjab')
      ON CONFLICT (name) DO NOTHING
    `);
    console.log('✅ States seeded');

    // Districts
    const { rows: states } = await db.query('SELECT id, name FROM states');
    const mh = states.find(s => s.name === 'Maharashtra');
    const gj = states.find(s => s.name === 'Gujarat');

    if (mh) {
      await db.query(`
        INSERT INTO districts (state_id, name) VALUES
          ($1, 'Mumbai'), ($1, 'Pune'), ($1, 'Nagpur'), ($1, 'Nashik'), ($1, 'Aurangabad')
        ON CONFLICT DO NOTHING
      `, [mh.id]);
    }
    if (gj) {
      await db.query(`
        INSERT INTO districts (state_id, name) VALUES
          ($1, 'Ahmedabad'), ($1, 'Surat'), ($1, 'Vadodara'), ($1, 'Rajkot')
        ON CONFLICT DO NOTHING
      `, [gj.id]);
    }
    console.log('✅ Districts seeded');

    // Products
    await db.query(`
      INSERT INTO products (name, code, category, warranty_months, grace_period_days, is_active) VALUES
        ('HF 100AH SMF Battery', 'HF-100AH', 'Battery', 24, 30, true),
        ('HF 150AH SMF Battery', 'HF-150AH', 'Battery', 24, 30, true),
        ('HF 200AH SMF Battery', 'HF-200AH', 'Battery', 36, 45, true),
        ('HF 75AH Tall Tubular', 'HF-75TT', 'Battery', 36, 45, true),
        ('HF 100AH Tall Tubular', 'HF-100TT', 'Battery', 48, 60, true),
        ('HF 150AH Tall Tubular', 'HF-150TT', 'Battery', 48, 60, true),
        ('HF 12V 7AH VRLA', 'HF-12V7', 'Battery', 12, 15, true),
        ('HF Solar 150AH', 'HF-SOL150', 'Solar Battery', 60, 90, true)
      ON CONFLICT (code) DO NOTHING
    `);
    console.log('✅ Products seeded');

    // Get admin user ID
    const { rows: adminRows } = await db.query("SELECT id FROM users WHERE username = 'admin'");
    const adminId = adminRows[0]?.id;

    const { rows: mhState } = await db.query("SELECT id FROM states WHERE name = 'Maharashtra'");
    const { rows: gjState } = await db.query("SELECT id FROM states WHERE name = 'Gujarat'");
    const mhId = mhState[0]?.id;
    const gjId = gjState[0]?.id;

    const distHash = await bcrypt.hash('Dist@123', 10);

    // Distributors
    await db.query(`
      INSERT INTO distributors (name, code, party_code, contact_person, mobile, email, city, state_id, status, login_active, created_by, password_hash) VALUES
        ('Sharma Batteries Pvt Ltd', 'DIST0001', 'SBP001', 'Rajesh Sharma', '9811111111', 'rajesh@sharma.com', 'Mumbai', $1, 'approved', true, $3, $4),
        ('Patel Power Solutions', 'DIST0002', 'PPS001', 'Amit Patel', '9822222222', 'amit@patel.com', 'Ahmedabad', $2, 'approved', true, $3, $4),
        ('Verma Electric Works', 'DIST0003', 'VEW001', 'Suresh Verma', '9833333333', 'suresh@verma.com', 'Pune', $1, 'approved', true, $3, $4),
        ('Singh Auto Parts', 'DIST0004', 'SAP001', 'Gurpreet Singh', '9844444444', 'gurpreet@singh.com', 'Surat', $2, 'pending', false, $3, $4)
      ON CONFLICT (code) DO NOTHING
    `, [mhId, gjId, adminId, distHash]);
    console.log('✅ Distributors seeded');

    // Dealers
    const { rows: dists } = await db.query("SELECT id FROM distributors WHERE status = 'approved' LIMIT 3");
    if (dists.length >= 2) {
      await db.query(`
        INSERT INTO dealers (distributor_id, name, code, contact_person, mobile, city, state_id, status, login_active, created_by) VALUES
          ($1, 'Ram Battery House', 'DLR0001', 'Ram Kumar', '9900001111', 'Mumbai', $3, 'approved', true, $5),
          ($1, 'Shree Battery Centre', 'DLR0002', 'Shree Nath', '9900002222', 'Thane', $3, 'approved', true, $5),
          ($2, 'Gujarat Battery Mart', 'DLR0003', 'Hiren Shah', '9900003333', 'Ahmedabad', $4, 'approved', true, $5),
          ($2, 'Anand Power Store', 'DLR0004', 'Manish Joshi', '9900004444', 'Surat', $4, 'approved', true, $5),
          ($1, 'Pending Dealer', 'DLR0005', 'Test User', '9900005555', 'Pune', $3, 'pending', false, $5)
        ON CONFLICT (code) DO NOTHING
      `, [dists[0].id, dists[1].id, mhId, gjId, adminId]);
      console.log('✅ Dealers seeded');
    }

    // Customers
    await db.query(`
      INSERT INTO customers (name, mobile, email, city, state_id) VALUES
        ('Mohan Lal', '8800001111', 'mohan@email.com', 'Mumbai', $1),
        ('Priya Singh', '8800002222', 'priya@email.com', 'Pune', $1),
        ('Ahmed Khan', '8800003333', 'ahmed@email.com', 'Ahmedabad', $2),
        ('Sunita Devi', '8800004444', null, 'Surat', $2),
        ('Ravi Shankar', '8800005555', null, 'Mumbai', $1),
        ('Kavita Sharma', '8800006666', null, 'Nashik', $1)
      ON CONFLICT (mobile) DO NOTHING
    `, [mhId, gjId]);
    console.log('✅ Customers seeded');

    // Serial Numbers
    const { rows: products } = await db.query('SELECT id FROM products LIMIT 4');
    const { rows: dealers } = await db.query("SELECT id FROM dealers WHERE status = 'approved' LIMIT 4");
    const { rows: distributors } = await db.query("SELECT id FROM distributors WHERE status = 'approved' LIMIT 2");

    if (products.length && dealers.length) {
      for (let i = 1; i <= 20; i++) {
        const prod = products[i % products.length];
        const dlr = dealers[i % dealers.length];
        const dist = distributors[i % distributors.length];
        await db.query(`
          INSERT INTO serial_numbers (serial_no, product_id, dealer_id, distributor_id, warranty_status, created_by)
          VALUES ($1, $2, $3, $4, 'registered', $5)
          ON CONFLICT (serial_no) DO NOTHING
        `, [`HF2024${String(i).padStart(6, '0')}`, prod.id, dlr.id, dist.id, adminId]);
      }
      console.log('✅ Serial numbers seeded (20)');
    }

    // Drivers
    await db.query(`
      INSERT INTO drivers (driver_id, name, mobile, state_id, created_by) VALUES
        ('DRV0001', 'Ramu Driver', '7700001111', $1, $2),
        ('DRV0002', 'Shyam Driver', '7700002222', $1, $2),
        ('DRV0003', 'Vinod Driver', '7700003333', $3, $2)
      ON CONFLICT (driver_id) DO NOTHING
    `, [mhId, adminId, gjId]);
    console.log('✅ Drivers seeded');

    // Sample complaints
    const { rows: customers } = await db.query('SELECT id FROM customers LIMIT 6');
    const { rows: serials } = await db.query("SELECT serial_no, product_id FROM serial_numbers LIMIT 6");
    const { rows: engineer } = await db.query("SELECT id FROM users WHERE role = 'service_engineer' LIMIT 1");

    const complaintStatuses = ['pending', 'inspection_pending', 'inspection_fail', 'battery_replaced', 'closed', 'cancelled'];
    const warrantyStatuses = ['In Warranty', 'In Warranty', 'In Warranty', 'Out of Warranty', 'In Warranty', 'Out of Warranty'];

    for (let i = 0; i < Math.min(6, customers.length, serials.length); i++) {
      const complaintNo = `202401${String(i+1).padStart(8, '0')}`;
      const status = complaintStatuses[i];
      const warrantyStatus = warrantyStatuses[i];

      try {
        await db.query(`
          INSERT INTO complaints (complaint_no, serial_no, product_id, distributor_id, dealer_id, customer_id,
            warranty_status, complaint_remark, status, created_by, engineer_id, engineer_assign)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (complaint_no) DO NOTHING
        `, [
          complaintNo,
          serials[i].serial_no,
          serials[i].product_id,
          distributors[i % distributors.length].id,
          dealers[i % dealers.length].id,
          customers[i].id,
          warrantyStatus,
          `Battery not working properly. Customer complaint #${i+1}.`,
          status,
          adminId,
          engineer[0]?.id || null,
          status !== 'pending'
        ]);
      } catch (e) { /* skip duplicate */ }
    }
    console.log('✅ Sample complaints seeded');

    // Banners placeholder
    await db.query(`
      INSERT INTO banners (image_url, title, is_active, created_by) VALUES
        ('/uploads/banners/sample1.jpg', 'Welcome to HighFlow', true, $1),
        ('/uploads/banners/sample2.jpg', 'Battery Warranty Support', true, $1)
      ON CONFLICT DO NOTHING
    `, [adminId]).catch(() => {});

    console.log('\n✅ Database seeded successfully!');
    console.log('\n🔐 Login credentials:');
    console.log('  Admin:    admin / Admin@123');
    console.log('  Dispatch: dispatch / Admin@123');
    console.log('  Returns:  returns / Admin@123');
    console.log('  Store:    store / Admin@123');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
  } finally {
    process.exit();
  }
}

seed();
