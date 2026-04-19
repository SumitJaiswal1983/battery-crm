import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import SearchBar from '../../components/ui/SearchBar';
import { RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function ReceivedPage() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/received', { params: { page, limit: 50, search } });
      setData(res.data); setTotal(res.total);
    } catch { toast.error('Failed'); } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    { key: 'complaint_no', label: 'Complaint No', render: (r) => <span className="font-mono text-xs font-semibold text-blue-600">{r.complaint_no}</span> },
    { key: 'serial_no', label: 'Serial No', render: (r) => <span className="font-mono text-xs">{r.serial_no}</span> },
    { key: 'product_name', label: 'Product' },
    { key: 'customer_name', label: 'Customer' },
    { key: 'receiving_by', label: 'Received By' },
    { key: 'warranty_status', label: 'Warranty Status' },
    { key: 'receiving_date', label: 'Received On', render: (r) => <span className="text-xs text-gray-500">{format(new Date(r.receiving_date), 'dd MMM yyyy')}</span> },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Received Batteries</h1><p className="text-gray-500 text-sm">{total.toLocaleString()} records</p></div>
      <div className="flex gap-3">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search received..." />
        <button onClick={fetchData} className="btn-secondary flex items-center gap-2"><RefreshCw size={14} /> Refresh</button>
      </div>
      <Table columns={columns} data={data} loading={loading} />
      <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
    </div>
  );
}
