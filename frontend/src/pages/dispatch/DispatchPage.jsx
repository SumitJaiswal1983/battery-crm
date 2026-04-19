import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import SearchBar from '../../components/ui/SearchBar';
import StatusBadge from '../../components/ui/StatusBadge';
import { RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function DispatchPage() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/dispatch', { params: { page, limit: 50, search, status: statusFilter } });
      setData(res.data); setTotal(res.total);
    } catch { toast.error('Failed'); } finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    { key: 'complaint_no', label: 'Complaint No', render: (r) => <span className="font-mono text-xs font-semibold text-blue-600">{r.complaint_no}</span> },
    { key: 'serial_no', label: 'Serial No', render: (r) => <span className="font-mono text-xs">{r.serial_no}</span> },
    { key: 'customer_name', label: 'Customer' },
    { key: 'driver_name', label: 'Driver' },
    { key: 'vehicle_no', label: 'Vehicle No' },
    { key: 'gatepass_no', label: 'Gatepass No' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'dispatch_date', label: 'Dispatch Date', render: (r) => r.dispatch_date ? format(new Date(r.dispatch_date), 'dd MMM yyyy') : '—' },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Claim Dispatch</h1><p className="text-gray-500 text-sm">{total.toLocaleString()} records</p></div>
      <div className="flex gap-2">
        {['','pending','gatepass','dispatched'].map(s => (
          <button key={s || 'all'} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search dispatch..." />
        <button onClick={fetchData} className="btn-secondary flex items-center gap-2"><RefreshCw size={14} /> Refresh</button>
      </div>
      <Table columns={columns} data={data} loading={loading} />
      <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
    </div>
  );
}
