import { Menu, LogOut, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Header({ onToggleSidebar }) {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-30">
      <button onClick={onToggleSidebar} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
        <Menu size={20} className="text-gray-600" />
      </button>

      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-gray-900">{user?.name}</p>
          <p className="text-xs text-gray-500 capitalize">{user?.role?.replace(/_/g, ' ')}</p>
        </div>
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
          <User size={16} className="text-white" />
        </div>
        <button
          onClick={logout}
          className="p-2 rounded-lg hover:bg-red-50 hover:text-red-600 text-gray-500 transition-colors"
          title="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
