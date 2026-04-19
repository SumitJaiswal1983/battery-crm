import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Users, Store, UserCheck, Package, Smartphone,
  AlertCircle, Truck, RotateCcw, PackageCheck, RefreshCw, Send,
  Trash2, Car, Clock, Image, Video, Settings, ChevronRight, Battery
} from 'lucide-react';

const navItems = [
  { to: '/dashboard',    label: 'Dashboard',       icon: LayoutDashboard },
  { to: '/complaints',   label: 'Complaints',       icon: AlertCircle },
  { to: '/distributors', label: 'Distributors',     icon: Users },
  { to: '/dealers',      label: 'Dealers',          icon: Store },
  { to: '/engineers',    label: 'Engineers',        icon: UserCheck },
  { to: '/customers',    label: 'Customers',        icon: Users },
  { to: '/products',     label: 'Products',         icon: Package },
  { to: '/serials',      label: 'Serial Numbers',   icon: Smartphone },
  { to: '/dispatch',     label: 'Claim Dispatch',   icon: Truck },
  { to: '/returns',      label: 'Claim Return',     icon: RotateCcw },
  { to: '/received',     label: 'Received',         icon: PackageCheck },
  { to: '/counter',      label: 'Counter Replace',  icon: RefreshCw },
  { to: '/outward',      label: 'Claim Outward',    icon: Send },
  { to: '/scrap',        label: 'Scrap List',       icon: Trash2 },
  { to: '/drivers',      label: 'Drivers',          icon: Car },
  { to: '/grace',        label: 'Grace Period',     icon: Clock },
  { to: '/banners',      label: 'Banners',          icon: Image },
  { to: '/gallery',      label: 'Gallery',          icon: Video },
  { to: '/users',        label: 'Users',            icon: Settings },
];

export default function Sidebar({ collapsed }) {
  return (
    <aside className={`fixed left-0 top-0 h-full bg-gray-900 text-white transition-all duration-300 z-40 flex flex-col ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-800">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Battery size={18} />
        </div>
        {!collapsed && <span className="font-bold text-lg">HighFlow CRM</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors duration-150 ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Icon size={18} className="flex-shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
