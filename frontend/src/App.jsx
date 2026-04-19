import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';

// Pages
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import ComplaintsPage from './pages/complaint/ComplaintsPage';
import ComplaintDetailPage from './pages/complaint/ComplaintDetailPage';
import DistributorsPage from './pages/distributor/DistributorsPage';
import DealersPage from './pages/dealer/DealersPage';
import EngineersPage from './pages/engineer/EngineersPage';
import CustomersPage from './pages/customer/CustomersPage';
import ProductsPage from './pages/master/ProductsPage';
import SerialsPage from './pages/serial/SerialsPage';
import DispatchPage from './pages/dispatch/DispatchPage';
import ReturnsPage from './pages/return/ReturnsPage';
import ReceivedPage from './pages/received/ReceivedPage';
import CounterPage from './pages/counter/CounterPage';
import OutwardPage from './pages/outward/OutwardPage';
import ScrapPage from './pages/scrap/ScrapPage';
import DriversPage from './pages/driver/DriversPage';
import GracePeriodPage from './pages/master/GracePeriodPage';
import BannersPage from './pages/master/BannersPage';
import GalleryPage from './pages/master/GalleryPage';
import UsersPage from './pages/master/UsersPage';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard"    element={<DashboardPage />} />
        <Route path="complaints"   element={<ComplaintsPage />} />
        <Route path="complaints/:id" element={<ComplaintDetailPage />} />
        <Route path="distributors" element={<DistributorsPage />} />
        <Route path="dealers"      element={<DealersPage />} />
        <Route path="engineers"    element={<EngineersPage />} />
        <Route path="customers"    element={<CustomersPage />} />
        <Route path="products"     element={<ProductsPage />} />
        <Route path="serials"      element={<SerialsPage />} />
        <Route path="dispatch"     element={<DispatchPage />} />
        <Route path="returns"      element={<ReturnsPage />} />
        <Route path="received"     element={<ReceivedPage />} />
        <Route path="counter"      element={<CounterPage />} />
        <Route path="outward"      element={<OutwardPage />} />
        <Route path="scrap"        element={<ScrapPage />} />
        <Route path="drivers"      element={<DriversPage />} />
        <Route path="grace"        element={<GracePeriodPage />} />
        <Route path="banners"      element={<BannersPage />} />
        <Route path="gallery"      element={<GalleryPage />} />
        <Route path="users"        element={<UsersPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      </BrowserRouter>
    </AuthProvider>
  );
}
