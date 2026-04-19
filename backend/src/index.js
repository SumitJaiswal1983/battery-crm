require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

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
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
