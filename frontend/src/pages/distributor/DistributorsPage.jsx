import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import SearchBar from '../../components/ui/SearchBar';
import StatusBadge from '../../components/ui/StatusBadge';
import { Plus, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function DistributorsPage() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('approved');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/distributors', { params: { page, limit: 50, search, status: statusFilter } });
      setData(res.data);
      setTotal(res.pagination?.total ?? res.total ?? 0);
    } catch { toast.error('Failed to load distributors'); } finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const approve = async (id) => {
    try { await api.put(`/distributors/${id}/approve`); toast.success('Approved'); fetchData(); }
    catch { toast.error('Failed'); }
  };

  const columns = [
    { key: 'code', label: 'Code', render: (r) => <span className="font-mono text-xs font-semibold">{r.code}</span> },
    { key: 'name', label: 'Name', render: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-gray-400">{r.contact_person}</p></div> },
    { key: 'mobile', label: 'Mobile' },
    { key: 'city', label: 'City' },
    { key: 'state_name', label: 'State' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'created_at', label: 'Created', render: (r) => <span className="text-xs text-gray-500">{format(new Date(r.created_at), 'dd MMM yyyy')}</span> },
    { key: 'actions', label: '', render: (r) => r.status === 'pending' ? (
      <button onClick={() => approve(r.id)} className="text-green-600 hover:underline text-xs">Approve</button>
    ) : null },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Distributors</h1>
          <p className="text-gray-500 text-sm">{total.toLocaleString()} total</p>
        </div>
      </div>
      <div className="flex gap-2">
        {['approved','pending','deleted'].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {s}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search distributors..." />
        <button onClick={fetchData} className="btn-secondary flex items-center gap-2"><RefreshCw size={14} /> Refresh</button>
      </div>
      <Table columns={columns} data={data} loading={loading} />
      <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
    </div>
  );
}
