
import { PageContainer } from '../components/PageContainer';
import { Button } from '../components/Button';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

export const LoginPage = () => {
  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();

  const handleLogin = (role: 'OWNER' | 'STAFF' | 'CA') => {
    setAuth({ id: '1', name: `Test ${role}`, email: 'test@example.com', role }, 'fake-jwt-token');
    navigate('/dashboard');
  };

  return (
    <div className="flex flex-col gap-4">
      <Button onClick={() => handleLogin('OWNER')}>Login as OWNER</Button>
      <Button onClick={() => handleLogin('STAFF')} variant="secondary">Login as STAFF</Button>
      <Button onClick={() => handleLogin('CA')} variant="ghost">Login as CA</Button>
    </div>
  );
};



export const TripFormPage = () => <PageContainer title="New Trip">New Trip Form Placeholder</PageContainer>;
export const PartiesPage = () => <PageContainer title="Parties">Parties Module Placeholder</PageContainer>;
export const PartyDetailsPage = () => <PageContainer title="Party Details">Party Details Placeholder</PageContainer>;

export const PaymentsPage = () => <PageContainer title="Payments">Payments Module Placeholder</PageContainer>;
export const PaymentFormPage = () => <PageContainer title="New Payment">New Payment Form Placeholder</PageContainer>;
export const PaymentDetailsPage = () => <PageContainer title="Payment Details">Payment Details Placeholder</PageContainer>;
export const BillsPage = () => <PageContainer title="Bills">Bills Module Placeholder</PageContainer>;
export const BillFormPage = () => <PageContainer title="New Bill">New Bill Form Placeholder</PageContainer>;
export const BillDetailsPage = () => <PageContainer title="Bill Details">Bill Details Placeholder</PageContainer>;
export const ReportsPage = () => <PageContainer title="Reports">Reports Module Placeholder</PageContainer>;
export const DocumentsPage = () => <PageContainer title="Documents">Documents Module Placeholder</PageContainer>;
export const SettingsBillingPage = () => <PageContainer title="Billing Settings">Billing Settings Placeholder</PageContainer>;
export const SettingsUsersPage = () => <PageContainer title="User Management">User Management Placeholder</PageContainer>;
export const SettingsSystemPage = () => <PageContainer title="System Settings">System Settings Placeholder</PageContainer>;
