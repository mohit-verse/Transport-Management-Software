import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { useAuthStore, type UserRole } from './store/authStore';
import * as Pages from './pages/Placeholders';
import DashboardPage from './pages/Dashboard';
import TripsPage from './pages/Trips';
import CreateTrip from './pages/CreateTrip';
import EditTrip from './pages/EditTrip';
import TripDetails from './pages/TripDetails';
import MarketVehicles from './pages/MarketVehicles';
import CreateMarketVehicle from './pages/CreateMarketVehicle';
import EditMarketVehicle from './pages/EditMarketVehicle';
import MarketVehicleDetail from './pages/MarketVehicleDetail';
import Parties from './pages/Parties';
import CreateParty from './pages/CreateParty';
import EditParty from './pages/EditParty';
import PartyDetail from './pages/PartyDetail';
import VehicleOwners from './pages/VehicleOwners';
import CreateVehicleOwner from './pages/CreateVehicleOwner';
import EditVehicleOwner from './pages/EditVehicleOwner';
import VehicleOwnerDetail from './pages/VehicleOwnerDetail';

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: UserRole[] }) => {
  const user = useAuthStore((state) => state.user);
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <Routes>
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<Pages.LoginPage />} />
            </Route>

            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              
              <Route path="/trips" element={<ProtectedRoute allowedRoles={['OWNER', 'STAFF']}><TripsPage /></ProtectedRoute>} />
              <Route path="/trips/new" element={<ProtectedRoute allowedRoles={['OWNER', 'STAFF']}><CreateTrip /></ProtectedRoute>} />
              <Route path="/trips/:id/edit" element={<ProtectedRoute allowedRoles={['OWNER', 'STAFF']}><EditTrip /></ProtectedRoute>} />
              <Route path="/trips/:id" element={<ProtectedRoute allowedRoles={['OWNER', 'STAFF']}><TripDetails /></ProtectedRoute>} />
              
              <Route path="/parties" element={<ProtectedRoute allowedRoles={['OWNER', 'STAFF', 'CA']}><Parties /></ProtectedRoute>} />
              <Route path="/parties/new" element={<ProtectedRoute allowedRoles={['OWNER', 'STAFF']}><CreateParty /></ProtectedRoute>} />
              <Route path="/parties/:id/edit" element={<ProtectedRoute allowedRoles={['OWNER', 'STAFF']}><EditParty /></ProtectedRoute>} />
              <Route path="/parties/:id" element={<ProtectedRoute allowedRoles={['OWNER', 'STAFF', 'CA']}><PartyDetail /></ProtectedRoute>} />
              
              <Route path="/vehicle-owners" element={<ProtectedRoute allowedRoles={['OWNER', 'STAFF']}><VehicleOwners /></ProtectedRoute>} />
              <Route path="/vehicle-owners/new" element={<ProtectedRoute allowedRoles={['OWNER', 'STAFF']}><CreateVehicleOwner /></ProtectedRoute>} />
              <Route path="/vehicle-owners/:id/edit" element={<ProtectedRoute allowedRoles={['OWNER', 'STAFF']}><EditVehicleOwner /></ProtectedRoute>} />
              <Route path="/vehicle-owners/:id" element={<ProtectedRoute allowedRoles={['OWNER', 'STAFF']}><VehicleOwnerDetail /></ProtectedRoute>} />
              
              <Route path="/market-vehicles" element={<ProtectedRoute allowedRoles={['OWNER', 'STAFF', 'CA']}><MarketVehicles /></ProtectedRoute>} />
              <Route path="/market-vehicles/new" element={<ProtectedRoute allowedRoles={['OWNER', 'STAFF']}><CreateMarketVehicle /></ProtectedRoute>} />
              <Route path="/market-vehicles/:id/edit" element={<ProtectedRoute allowedRoles={['OWNER', 'STAFF']}><EditMarketVehicle /></ProtectedRoute>} />
              <Route path="/market-vehicles/:id" element={<ProtectedRoute allowedRoles={['OWNER', 'STAFF', 'CA']}><MarketVehicleDetail /></ProtectedRoute>} />
              
              <Route path="/own-fleet" element={<ProtectedRoute allowedRoles={['OWNER', 'STAFF']}><Pages.OwnFleetPage /></ProtectedRoute>} />
              <Route path="/own-fleet/:id" element={<ProtectedRoute allowedRoles={['OWNER', 'STAFF']}><Pages.OwnFleetDetailsPage /></ProtectedRoute>} />
              
              <Route path="/payments" element={<ProtectedRoute allowedRoles={['OWNER', 'STAFF', 'CA']}><Pages.PaymentsPage /></ProtectedRoute>} />
              <Route path="/payments/new" element={<ProtectedRoute allowedRoles={['OWNER', 'STAFF']}><Pages.PaymentFormPage /></ProtectedRoute>} />
              <Route path="/payments/:id" element={<ProtectedRoute allowedRoles={['OWNER', 'STAFF', 'CA']}><Pages.PaymentDetailsPage /></ProtectedRoute>} />
              
              <Route path="/bills" element={<ProtectedRoute allowedRoles={['OWNER', 'STAFF', 'CA']}><Pages.BillsPage /></ProtectedRoute>} />
              <Route path="/bills/new" element={<ProtectedRoute allowedRoles={['OWNER', 'STAFF']}><Pages.BillFormPage /></ProtectedRoute>} />
              <Route path="/bills/:id" element={<ProtectedRoute allowedRoles={['OWNER', 'STAFF', 'CA']}><Pages.BillDetailsPage /></ProtectedRoute>} />
              
              <Route path="/reports" element={<ProtectedRoute allowedRoles={['OWNER', 'CA']}><Pages.ReportsPage /></ProtectedRoute>} />
              <Route path="/documents" element={<ProtectedRoute allowedRoles={['OWNER', 'STAFF']}><Pages.DocumentsPage /></ProtectedRoute>} />
              
              <Route path="/settings/billing" element={<ProtectedRoute allowedRoles={['OWNER']}><Pages.SettingsBillingPage /></ProtectedRoute>} />
              <Route path="/settings/users" element={<ProtectedRoute allowedRoles={['OWNER']}><Pages.SettingsUsersPage /></ProtectedRoute>} />
              <Route path="/settings/system" element={<ProtectedRoute allowedRoles={['OWNER']}><Pages.SettingsSystemPage /></ProtectedRoute>} />
            </Route>
          </Routes>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
