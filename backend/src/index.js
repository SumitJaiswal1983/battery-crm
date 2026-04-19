require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

async function runMigrations() {
  const db = require('./config/db');
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'config/schema.sql'), 'utf8');
    await db.query(sql);
    console.log('✅ Database schema ready');
  } catch (err) {
    console.error('⚠️  Migration warning:', err.message);
    return;
  }
  try {
    const { rows } = await db.query('SELECT COUNT(*) FROM users');
    if (parseInt(rows[0].count) === 0) {
      console.log('🌱 Empty database detected, running seed...');
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('Admin@123', 10);
      await db.query(`
        INSERT INTO users (name, username, password, role, mobile, emp_code, is_active) VALUES
          ('Super Admin', 'admin', $1, 'admin', '9999999999', 'EMP001', true),
          ('Claim Dispatch', 'dispatch', $1, 'claim_dispatch', '9999999998', 'EMP002', true),
          ('Claim Return', 'returns', $1, 'claim_return', '9999999997', 'EMP003', true),
          ('Store Manager', 'store', $1, 'store', '9999999996', 'EMP004', true)
        ON CONFLICT (username) DO NOTHING
      `, [hash]);
      console.log('✅ Default users created (admin / Admin@123)');
    }
  } catch (err) {
    console.error('⚠️  Seed warning:', err.message);
  }
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/distributors', require('./routes/distributors'));
app.use('/api/dealers',      require('./routes/dealers'));
app.use('/api/engineers',    require('./routes/engineers'));
app.use('/api/customers',    require('./routes/customers'));
app.use('/api/products',     require('./routes/products'));
app.use('/api/serials',      require('./routes/serials'));
app.use('/api/complaints',   require('./routes/complaints'));
app.use('/api/dispatch',     require('./routes/dispatch'));
app.use('/api/returns',      require('./routes/returns'));
app.use('/api/received',     require('./routes/received'));
app.use('/api/counter',      require('./routes/counter'));
app.use('/api/outward',      require('./routes/outward'));
app.use('/api/scrap',        require('./routes/scrap'));
app.use('/api/drivers',      require('./routes/drivers'));
app.use('/api/grace',        require('./routes/grace'));
app.use('/api/banners',      require('./routes/banners'));
app.use('/api/gallery',      require('./routes/gallery'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/dashboard',    require('./routes/dashboard'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Battery CRM API running' });
});

// Serve React frontend in production
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (require('fs').existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  // 404 handler for API-only mode
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });
}

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
runMigrations().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
});
