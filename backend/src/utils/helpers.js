// Generate unique codes
const generateCode = (prefix, number) => `${prefix}${String(number).padStart(4, '0')}`;
const generateComplaintNo = () => {
  const d = new Date();
  const ts = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}${Date.now().toString().slice(-8)}`;
  return ts;
};

// Pagination helper
const paginate = (page = 1, limit = 50) => {
  const offset = (parseInt(page) - 1) * parseInt(limit);
  return { limit: parseInt(limit), offset };
};

// Build search WHERE clause
const buildSearch = (fields, search) => {
  if (!search) return { where: '', params: [] };
  const conditions = fields.map((f, i) => `${f} ILIKE $${i + 1}`);
  const params = fields.map(() => `%${search}%`);
  return { where: `WHERE (${conditions.join(' OR ')})`, params };
};

module.exports = { generateCode, generateComplaintNo, paginate, buildSearch };
