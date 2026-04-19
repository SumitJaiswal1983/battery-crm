const router = require('express').Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');

// GET /api/dashboard - main stats
router.get('/', authenticate, async (req, res) => {
  try {
    const [
      complaintsTotal,
      complaintsByStatus,
      complaintsToday,
      complaintsThisMonth,
      pendingDispatch,
      pendingReturn,
      pendingGrace,
      distributorsCount,
      dealersCount,
      customersCount,
      recentComplaints
    ] = await Promise.all([
      db.query('SELECT COUNT(*) FROM complaints'),
      db.query(`SELECT status, COUNT(*) AS count FROM complaints GROUP BY status ORDER BY count DESC`),
      db.query(`SELECT COUNT(*) FROM complaints WHERE DATE(created_at) = CURRENT_DATE`),
      db.query(`SELECT COUNT(*) FROM complaints WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())`),
      db.query(`SELECT COUNT(*) FROM claim_dispatch WHERE status = 'pending'`),
      db.query(`SELECT COUNT(*) FROM claim_return WHERE status = 'pending'`),
      db.query(`SELECT COUNT(*) FROM grace_period_requests WHERE status = 'pending'`),
      db.query(`SELECT COUNT(*) FROM distributors WHERE status = 'approved'`),
      db.query(`SELECT COUNT(*) FROM dealers WHERE status = 'approved'`),
      db.query('SELECT COUNT(*) FROM customers'),
      db.query(`
        SELECT c.complaint_no, c.serial_no, c.status, c.warranty_status, c.created_at,
               cu.name AS customer_name, cu.mobile AS customer_mobile,
               d.name AS dealer_name, dist.name AS distributor_name
        FROM complaints c
        LEFT JOIN customers cu ON cu.id = c.customer_id
        LEFT JOIN dealers d ON d.id = c.dealer_id
        LEFT JOIN distributors dist ON dist.id = c.distributor_id
        ORDER BY c.created_at DESC LIMIT 10
      `)
    ]);

    // Monthly trend (last 6 months)
    const monthlyTrend = await db.query(`
      SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS month,
             DATE_TRUNC('month', created_at) AS month_date,
             COUNT(*) AS count
      FROM complaints
      WHERE created_at >= NOW() - INTERVAL '6 months'
      GROUP BY month_date, month
      ORDER BY month_date ASC
    `);

    res.json({
      summary: {
        total_complaints: parseInt(complaintsTotal.rows[0].count),
        today_complaints: parseInt(complaintsToday.rows[0].count),
        month_complaints: parseInt(complaintsThisMonth.rows[0].count),
        pending_dispatch: parseInt(pendingDispatch.rows[0].count),
        pending_return: parseInt(pendingReturn.rows[0].count),
        pending_grace: parseInt(pendingGrace.rows[0].count),
        total_distributors: parseInt(distributorsCount.rows[0].count),
        total_dealers: parseInt(dealersCount.rows[0].count),
        total_customers: parseInt(customersCount.rows[0].count),
      },
      complaints_by_status: complaintsByStatus.rows,
      monthly_trend: monthlyTrend.rows,
      recent_complaints: recentComplaints.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/engineer-stats - per-engineer complaint stats
router.get('/engineer-stats', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT u.name AS engineer_name, u.id AS engineer_id,
             COUNT(c.id) AS total,
             SUM(CASE WHEN c.status = 'pending' THEN 1 ELSE 0 END) AS pending,
             SUM(CASE WHEN c.status = 'inspection_pending' THEN 1 ELSE 0 END) AS in_inspection,
             SUM(CASE WHEN c.status = 'closed' THEN 1 ELSE 0 END) AS closed
      FROM users u
      LEFT JOIN complaints c ON c.engineer_id = u.id
      WHERE u.role = 'service_engineer'
      GROUP BY u.id, u.name
      ORDER BY total DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
