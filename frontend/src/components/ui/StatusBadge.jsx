const statusMap = {
  pending:            'bg-yellow-100 text-yellow-800',
  approved:           'bg-green-100 text-green-800',
  rejected:           'bg-red-100 text-red-800',
  closed:             'bg-gray-100 text-gray-700',
  cancelled:          'bg-red-50 text-red-600',
  inspection_pending: 'bg-orange-100 text-orange-800',
  inspection_fail:    'bg-red-100 text-red-800',
  battery_replaced:   'bg-blue-100 text-blue-800',
  battery_return:     'bg-purple-100 text-purple-800',
  dispatched:         'bg-green-100 text-green-800',
  gatepass:           'bg-blue-100 text-blue-800',
  done:               'bg-green-100 text-green-800',
  registered:         'bg-blue-100 text-blue-800',
  'In Warranty':      'bg-green-100 text-green-800',
  'Out of Warranty':  'bg-red-100 text-red-800',
  active:             'bg-green-100 text-green-800',
  inactive:           'bg-gray-100 text-gray-700',
};

export default function StatusBadge({ status }) {
  if (!status) return <span className="text-gray-400">—</span>;
  const cls = statusMap[status] || 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
