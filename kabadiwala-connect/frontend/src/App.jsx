import { BarChart3, Gauge, LayoutDashboard, Recycle, ShieldCheck, Store, Truck, Users } from 'lucide-react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { DashboardLayout } from './components/Layout.jsx';
import { ROLE_HOME } from './lib/constants.js';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Reset from './pages/Reset.jsx';
import PublicCollector from './pages/PublicCollector.jsx';
import Legal from './pages/Legal.jsx';
import NotFound from './pages/NotFound.jsx';
import TrackRequest from './pages/TrackRequest.jsx';
import TransactionDetail from './pages/TransactionDetail.jsx';
import Analytics from './pages/Analytics.jsx';
import HouseholdDashboard from './dashboards/HouseholdDashboard.jsx';
import CollectorDashboard from './dashboards/CollectorDashboard.jsx';
import DealerDashboard from './dashboards/DealerDashboard.jsx';
import RecyclerDashboard from './dashboards/RecyclerDashboard.jsx';
import AdminDashboard from './dashboards/AdminDashboard.jsx';

const NAV = {
  household: [
    { to: '/app/household', label: 'My pickups', icon: LayoutDashboard, end: true },
    { to: '/app/analytics', label: 'Reports', icon: BarChart3 },
  ],
  collector: [
    { to: '/app/collector', label: 'Dashboard', icon: Gauge, end: true },
    { to: '/app/analytics', label: 'Earnings & reports', icon: BarChart3 },
  ],
  dealer: [
    { to: '/app/dealer', label: 'Material & inventory', icon: Store, end: true },
    { to: '/app/analytics', label: 'Reports', icon: BarChart3 },
  ],
  recycler: [
    { to: '/app/recycler', label: 'Recycling', icon: Recycle, end: true },
    { to: '/app/analytics', label: 'Reports', icon: BarChart3 },
  ],
  admin: [
    { to: '/app/admin', label: 'Administration', icon: ShieldCheck, end: true },
    { to: '/app/analytics', label: 'Platform reports', icon: BarChart3 },
  ],
};
const TITLES = { household: 'Household', collector: 'Kabadiwala', dealer: 'Scrap dealer', recycler: 'Recycling unit', admin: 'Administrator' };

function AppIndex() {
  const { user } = useAuth();
  return <Navigate to={ROLE_HOME[user.role] || '/'} replace />;
}

// Shell that shows the navigation for the signed-in user's role.
function RoleShell() {
  const { user } = useAuth();
  return <DashboardLayout title={TITLES[user.role]} nav={NAV[user.role] || []} />;
}

function RequestRedirect() {
  const { id } = useParams();
  return <TrackRequest key={id} />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset" element={<Reset />} />
          <Route path="/verify/collector/:code" element={<PublicCollector />} />
          <Route path="/privacy" element={<Legal title="Privacy Policy" />} />
          <Route path="/terms" element={<Legal title="Terms and Conditions" />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<AppIndex />} />
            <Route element={<RoleShell />}>
              <Route element={<ProtectedRoute roles={['household']} />}>
                <Route path="/app/household" element={<HouseholdDashboard />} />
              </Route>
              <Route element={<ProtectedRoute roles={['collector']} />}>
                <Route path="/app/collector" element={<CollectorDashboard />} />
              </Route>
              <Route element={<ProtectedRoute roles={['dealer']} />}>
                <Route path="/app/dealer" element={<DealerDashboard />} />
              </Route>
              <Route element={<ProtectedRoute roles={['recycler']} />}>
                <Route path="/app/recycler" element={<RecyclerDashboard />} />
              </Route>
              <Route element={<ProtectedRoute roles={['admin']} />}>
                <Route path="/app/admin" element={<AdminDashboard />} />
              </Route>
              <Route path="/app/analytics" element={<Analytics />} />
              <Route path="/app/requests/:id" element={<RequestRedirect />} />
              <Route path="/app/transactions/:id" element={<TransactionDetail />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
