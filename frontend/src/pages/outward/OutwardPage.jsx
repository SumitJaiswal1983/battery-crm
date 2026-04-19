import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import { RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function OutwardPage() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/outward', { params: { page, limit: 50 } });
      setData(res.data); setTotal(res.total);
    } catch { toast.error('Failed'); } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const markDispatched = async (id) => {
    try { await api.put(`/outward/${id}/dispatch`); toast.success('Marked dispatched'); fetchData(); }
    catch { toast.error('Failed'); }
  };

  const columns = [
    { key: 'complaint_no', label: 'Complaint No', render: (r) => <span className="font-mono text-xs font-semibold text-blue-600">{r.complaint_no}</span> },
    { key: 'serial_no', label: 'Serial No', render: (r) => <span className="font-mono text-xs">{r.serial_no}</span> },
    { key: 'customer_name', label: 'Customer' },
    { key: 'distributor_name', label: 'Distributor' },
    { key: 'dispatched', label: 'Dispatched', render: (r) => <span className={`text-xs font-medium ${r.dispatched ? 'text-green-600' : 'text-yellow-600'}`}>{r.dispatched ? 'Yes' : 'No'}</span> },
    { key: 'created_at', label: 'Date', render: (r) => <span className="text-xs text-gray-500">{format(new Date(r.created_at), 'dd MMM yyyy')}</span> },
    { key: 'actions', label: '', render: (r) => !r.dispatched ? (
      <button onClick={() => markDispatched(r.id)} className="text-blue-600 hover:underline text-xs">Mark Dispatched</button>
    ) : null },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Claim Outward</h1><p className="text-gray-500 text-sm">{total.toLocaleString()} records</p></div>
      <div className="flex gap-3">
        <button onClick={fetchData} className="btn-secondary flex items-center gap-2"><RefreshCw size={14} /> Refresh</button>
      </div>
      <Table columns={columns} data={data} loading={loading} />
      <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
    </div>
  );
}
