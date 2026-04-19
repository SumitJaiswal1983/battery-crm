import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import StatusBadge from '../../components/ui/StatusBadge';
import { ArrowLeft, User, MapPin, Package, AlertCircle, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-500 mb-0.5">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value || '—'}</span>
    </div>
  );
}

export default function ComplaintDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/complaints/${id}`)
      .then(({ data }) => setComplaint(data))
      .catch(() => toast.error('Failed to load complaint'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!complaint) return <p className="text-red-500">Complaint not found</p>;

  const c = complaint;
  const fmtDate = (d) => d ? format(new Date(d), 'dd MMM yyyy') : '—';

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Complaint #{c.complaint_no}</h1>
          <div className="flex items-center gap-3 mt-1">
            <StatusBadge status={c.status} />
            <StatusBadge status={c.warranty_status} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Battery Info */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Package size={18} className="text-blue-600" />
            <h3 className="font-semibold">Battery Details</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Serial Number" value={c.serial_no} />
            <InfoRow label="Product" value={c.product_name} />
            <InfoRow label="Warranty Start" value={fmtDate(c.warranty_start)} />
            <InfoRow label="Warranty End" value={fmtDate(c.warranty_end)} />
            <InfoRow label="Date of Purchase" value={fmtDate(c.date_of_purchase)} />
            <InfoRow label="Warranty Status" value={c.warranty_status} />
          </div>
        </div>

        {/* Customer Info */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <User size={18} className="text-blue-600" />
            <h3 className="font-semibold">Customer</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Name" value={c.customer_name} />
            <InfoRow label="Mobile" value={c.customer_mobile} />
            <InfoRow label="Dealer" value={c.dealer_name} />
            <InfoRow label="Distributor" value={c.distributor_name} />
          </div>
        </div>

        {/* Complaint Remark */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={18} className="text-blue-600" />
            <h3 className="font-semibold">Complaint Remark</h3>
          </div>
          <p className="text-sm text-gray-700">{c.complaint_remark || 'No remark provided'}</p>
        </div>

        {/* Inspection */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Wrench size={18} className="text-blue-600" />
            <h3 className="font-semibold">Inspection</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Status" value={c.inspection_status} />
            <InfoRow label="Result" value={c.inspection_result} />
            <InfoRow label="Engineer" value={c.engineer_name} />
            <InfoRow label="Stock Action" value={c.stock_action} />
          </div>
        </div>
      </div>

      {/* Images */}
      {c.images && c.images.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-4">Attached Images</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {c.images.map((img) => (
              <div key={img.id} className="space-y-1">
                <a href={img.image_url} target="_blank" rel="noreferrer">
                  <img src={img.image_url} alt={img.image_type} className="w-full h-32 object-cover rounded-lg border border-gray-200 hover:opacity-90 transition-opacity" />
                </a>
                <p className="text-xs text-center text-gray-500 capitalize">{img.image_type?.replace(/_/g, ' ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inspection Logs */}
      {c.inspection_logs && c.inspection_logs.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-4">Inspection History</h3>
          <div className="space-y-3">
            {c.inspection_logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${log.result === 'pass' ? 'bg-green-500' : 'bg-red-500'}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={log.result} />
                    <span className="text-xs text-gray-400">{fmtDate(log.inspection_date)}</span>
                  </div>
                  {log.remark && <p className="text-sm text-gray-600 mt-1">{log.remark}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
