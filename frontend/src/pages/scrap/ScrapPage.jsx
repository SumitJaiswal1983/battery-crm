import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import { RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ScrapPage() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/scrap', { params: { page, limit: 50 } });
      setData(res.data); setTotal(res.total);
    } catch { toast.error('Failed'); } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    { key: 'dealer_name', label: 'Dealer', render: (r) => <span className="font-medium">{r.dealer_name || r.distributor_name || '—'}</span> },
    { key: 'want_to_give', label: 'Want to Give', render: (r) => <span className="text-center">{r.want_to_give}</span> },
    { key: 'want_to_receive_virtual', label: 'Receive (Virtual)' },
    { key: 'want_to_receive_actual', label: 'Receive (Actual)' },
    { key: 'updated_at', label: 'Updated', render: (r) => <span className="text-xs text-gray-500">{new Date(r.updated_at).toLocaleDateString()}</span> },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Scrap List</h1><p className="text-gray-500 text-sm">{total} records</p></div>
      <div className="flex gap-3">
        <button onClick={fetchData} className="btn-secondary flex items-center gap-2"><RefreshCw size={14} /> Refresh</button>
      </div>
      <Table columns={columns} data={data} loading={loading} />
      <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
    </div>
  );
}
