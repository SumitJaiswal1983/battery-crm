import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import SearchBar from '../../components/ui/SearchBar';
import StatusBadge from '../../components/ui/StatusBadge';
import { RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function GracePeriodPage() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/grace', { params: { page, limit: 50, search, status: statusFilter } });
      setData(res.data); setTotal(res.total);
    } catch { toast.error('Failed'); } finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const action = async (id, act) => {
    try { await api.put(`/grace/${id}/${act}`); toast.success(`${act === 'approve' ? 'Approved' : 'Rejected'}`); fetchData(); }
    catch { toast.error('Failed'); }
  };

  const columns = [
    { key: 'serial_no', label: 'Serial No', render: (r) => <span className="font-mono text-xs">{r.serial_no}</span> },
    { key: 'product_name', label: 'Product' },
    { key: 'customer_name', label: 'Customer' },
    { key: 'dealer_name', label: 'Dealer' },
    { key: 'request_type', label: 'Type' },
    { key: 'reason', label: 'Reason', render: (r) => <span className="text-xs text-gray-600 max-w-xs truncate block">{r.reason}</span> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'created_at', label: 'Date', render: (r) => <span className="text-xs text-gray-500">{format(new Date(r.created_at), 'dd MMM yyyy')}</span> },
    { key: 'actions', label: '', render: (r) => r.status === 'pending' ? (
      <div className="flex gap-2">
        <button onClick={() => action(r.id, 'approve')} className="text-green-600 hover:underline text-xs">Approve</button>
        <button onClick={() => action(r.id, 'reject')} className="text-red-600 hover:underline text-xs">Reject</button>
      </div>
    ) : null },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Grace Period Requests</h1><p className="text-gray-500 text-sm">{total} records</p></div>
      <div className="flex gap-2">
        {['','pending','approved','rejected'].map(s => (
          <button key={s || 'all'} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search..." />
        <button onClick={fetchData} className="btn-secondary flex items-center gap-2"><RefreshCw size={14} /> Refresh</button>
      </div>
      <Table columns={columns} data={data} loading={loading} />
      <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
    </div>
  );
}
