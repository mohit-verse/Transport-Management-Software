import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, type UserRole } from '../store/authStore';
import { login, getMe } from '../services/api';
import { Input } from '../components/Input';
import { Button } from '../components/Button';

export const LoginPage: React.FC = () => {
  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();

  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!mobileNumber || mobileNumber.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    try {
      setLoading(true);
      const loginRes = await login({
        mobile_number: mobileNumber.trim(),
        password,
      });

      const token = loginRes.data.token;
      localStorage.setItem('token', token);

      const meRes = await getMe();
      const userData = meRes.data.user;

      setAuth(
        {
          id: userData.id,
          name: userData.name,
          mobile_number: userData.mobile_number,
          role: userData.role,
        },
        token
      );

      navigate('/dashboard');
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Authentication failed. Please verify your credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (role: UserRole) => {
    setAuth(
      {
        id: '1',
        name: `Test ${role}`,
        email: 'test@example.com',
        role,
      },
      'fake-jwt-token'
    );
    navigate('/dashboard');
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm rounded bg-red-50 text-red-700 border border-red-200" role="alert">
            {error}
          </div>
        )}

        <Input
          label="Mobile Number"
          id="mobile_number"
          name="mobile_number"
          type="tel"
          placeholder="e.g. 9876543210"
          value={mobileNumber}
          onChange={(e) => setMobileNumber(e.target.value)}
          required
          autoFocus
        />

        <Input
          label="Password"
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <Button
          type="submit"
          className="w-full"
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>

      {import.meta.env.DEV && (
        <>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or development quick login</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleQuickLogin('OWNER')}
            >
              Owner
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleQuickLogin('STAFF')}
            >
              Staff
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleQuickLogin('CA')}
            >
              CA
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default LoginPage;
