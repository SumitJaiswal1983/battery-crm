import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import SearchBar from '../../components/ui/SearchBar';
import StatusBadge from '../../components/ui/StatusBadge';
import { Plus, Filter, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const STATUSES = ['pending','inspection_pending','inspection_fail','battery_replaced','battery_return','closed','cancelled'];

export default function ComplaintsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [counts, setCounts] = useState({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50, search, status: statusFilter };
      const { data: res } = await api.get('/complaints', { params });
      setData(res.data);
      setTotal(res.total);
      if (res.status_counts) setCounts(res.status_counts);
    } catch (err) {
      toast.error('Failed to load complaints');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    { key: 'complaint_no', label: 'Complaint No', render: (r) => <span className="font-mono text-xs font-semibold text-blue-600">{r.complaint_no}</span> },
    { key: 'serial_no', label: 'Serial No', render: (r) => <span className="font-mono text-xs">{r.serial_no}</span> },
    { key: 'customer_name', label: 'Customer', render: (r) => <div><p className="font-medium">{r.customer_name || '—'}</p><p className="text-xs text-gray-400">{r.customer_mobile}</p></div> },
    { key: 'dealer_name', label: 'Dealer', render: (r) => <span className="text-sm">{r.dealer_name || '—'}</span> },
    { key: 'warranty_status', label: 'Warranty', render: (r) => <StatusBadge status={r.warranty_status} /> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'created_at', label: 'Date', render: (r) => <span className="text-xs text-gray-500">{format(new Date(r.created_at), 'dd MMM yyyy')}</span> },
    { key: 'actions', label: '', render: (r) => (
      <button onClick={() => navigate(`/complaints/${r.id}`)} className="text-blue-600 hover:underline text-xs">View</button>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Complaints</h1>
          <p className="text-gray-500 text-sm">{total.toLocaleString()} total complaints</p>
        </div>
        <button onClick={() => navigate('/complaints/new')} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Complaint
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => { setStatusFilter(''); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!statusFilter ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
        >All</button>
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            {s.replace(/_/g, ' ')} {counts[s] ? `(${counts[s]})` : ''}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search complaints..." />
        <button onClick={fetchData} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <Table columns={columns} data={data} loading={loading} />
      <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
    </div>
  );
}
