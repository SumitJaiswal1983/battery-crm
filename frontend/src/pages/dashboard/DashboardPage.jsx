import { useEffect, useState } from 'react';
import api from '../../services/api';
import { AlertCircle, Users, Store, Package, Truck, RotateCcw, Clock, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import StatusBadge from '../../components/ui/StatusBadge';

const COLORS = ['#3b82f6','#f59e0b','#ef4444','#10b981','#8b5cf6','#06b6d4','#f97316','#6366f1'];

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(({ data }) => setData(data)).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!data) return <p className="text-red-500">Failed to load dashboard</p>;

  const { summary, complaints_by_status, monthly_trend, recent_complaints } = data;

  const statCards = [
    { label: 'Total Complaints',   value: summary.total_complaints,  icon: AlertCircle, color: 'bg-blue-500' },
    { label: "Today's Complaints", value: summary.today_complaints,  icon: TrendingUp,  color: 'bg-green-500' },
    { label: 'This Month',         value: summary.month_complaints,  icon: AlertCircle, color: 'bg-purple-500' },
    { label: 'Pending Dispatch',   value: summary.pending_dispatch,  icon: Truck,       color: 'bg-orange-500' },
    { label: 'Pending Return',     value: summary.pending_return,    icon: RotateCcw,   color: 'bg-red-500' },
    { label: 'Grace Requests',     value: summary.pending_grace,     icon: Clock,       color: 'bg-yellow-500' },
    { label: 'Distributors',       value: summary.total_distributors,icon: Users,       color: 'bg-indigo-500' },
    { label: 'Dealers',            value: summary.total_dealers,     icon: Store,       color: 'bg-teal-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Battery Warranty CRM Overview</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card flex items-center gap-4">
            <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
              <Icon size={22} className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{(value || 0).toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Monthly Complaints (6 months)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthly_trend}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Breakdown */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Complaints by Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={complaints_by_status} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80}>
                {complaints_by_status.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n.replace(/_/g, ' ')]} />
              <Legend formatter={(v) => (v || '').replace(/_/g, ' ')} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Complaints */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Recent Complaints</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-gray-600 font-medium">Complaint No</th>
                <th className="text-left py-2 px-3 text-gray-600 font-medium">Serial No</th>
                <th className="text-left py-2 px-3 text-gray-600 font-medium">Customer</th>
                <th className="text-left py-2 px-3 text-gray-600 font-medium">Dealer</th>
                <th className="text-left py-2 px-3 text-gray-600 font-medium">Status</th>
                <th className="text-left py-2 px-3 text-gray-600 font-medium">Warranty</th>
              </tr>
            </thead>
            <tbody>
              {recent_complaints.map((c) => (
                <tr key={c.complaint_no} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3 font-mono text-xs">{c.complaint_no}</td>
                  <td className="py-2 px-3 font-mono text-xs">{c.serial_no}</td>
                  <td className="py-2 px-3">{c.customer_name || '—'}</td>
                  <td className="py-2 px-3 text-gray-500">{c.dealer_name || '—'}</td>
                  <td className="py-2 px-3"><StatusBadge status={c.status} /></td>
                  <td className="py-2 px-3"><StatusBadge status={c.warranty_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
