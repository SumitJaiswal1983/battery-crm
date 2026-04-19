import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, total, limit, onPageChange }) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
      <span>Showing {start}–{end} of {total}</span>
      <div className="flex gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="p-1.5 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-100"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="px-3 py-1 rounded-lg border border-gray-300 bg-white">{page} / {totalPages}</span>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="p-1.5 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-100"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
