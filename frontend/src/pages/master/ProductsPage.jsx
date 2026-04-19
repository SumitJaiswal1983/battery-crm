import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import Table from '../../components/ui/Table';
import StatusBadge from '../../components/ui/StatusBadge';
import { RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProductsPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/products', { params: { page: 1, limit: 100 } });
      setData(res.data || res);
    } catch { toast.error('Failed'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    { key: 'code', label: 'Code', render: (r) => <span className="font-mono text-xs font-semibold">{r.code}</span> },
    { key: 'name', label: 'Product Name', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'category', label: 'Category' },
    { key: 'warranty_months', label: 'Warranty (Months)' },
    { key: 'grace_period_days', label: 'Grace (Days)' },
    { key: 'is_active', label: 'Status', render: (r) => <StatusBadge status={r.is_active ? 'active' : 'inactive'} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Products</h1><p className="text-gray-500 text-sm">{data.length} products</p></div>
        <button onClick={fetchData} className="btn-secondary flex items-center gap-2"><RefreshCw size={14} /> Refresh</button>
      </div>
      <Table columns={columns} data={data} loading={loading} />
    </div>
  );
}
