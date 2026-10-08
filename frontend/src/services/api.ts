import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401s
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // Optionally trigger a custom event or store update to log out the user
      window.dispatchEvent(new Event('unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default api;

export interface VehicleOwner {
  id: string;
  name: string;
  mobile_number: string;
  address?: string;
  city?: string;
  state?: string;
  pan_number?: string;
  bank_details?: any;
  created_at: string;
  updated_at: string;
}

export interface MarketVehicle {
  id: string;
  vehicle_number: string;
  vehicle_type?: string;
  vehicle_owner_id: string;
  owner_name: string;
  owner_mobile_number: string;
  trips?: any[];
}

export const getVehicleOwners = async (): Promise<{ success: boolean; data: VehicleOwner[] }> => {
  const response = await api.get('/api/vehicle-owners');
  return response.data;
};

export const getVehicleOwner = async (id: string): Promise<{ success: boolean; data: VehicleOwner }> => {
  const response = await api.get(`/api/vehicle-owners/${id}`);
  return response.data;
};

export const createVehicleOwner = async (data: Partial<VehicleOwner>): Promise<{ success: boolean; data: VehicleOwner }> => {
  const response = await api.post('/api/vehicle-owners', data);
  return response.data;
};

export const updateVehicleOwner = async (id: string, data: Partial<VehicleOwner>): Promise<{ success: boolean; data: VehicleOwner }> => {
  const response = await api.patch(`/api/vehicle-owners/${id}`, data);
  return response.data;
};

export const getVehicleOwnerFinancials = async (id: string): Promise<{ success: boolean; data: any }> => {
  const response = await api.get(`/api/vehicle-owners/${id}/financials`);
  return response.data;
};

export const getVehicleOwnerVehicles = async (id: string): Promise<{ success: boolean; data: any[] }> => {
  const response = await api.get(`/api/vehicle-owners/${id}/vehicles`);
  return response.data;
};

export const getVehicleOwnerTrips = async (id: string): Promise<{ success: boolean; data: any[] }> => {
  const response = await api.get(`/api/vehicle-owners/${id}/trips`);
  return response.data;
};

export const getVehicleOwnerPayments = async (id: string): Promise<{ success: boolean; data: any[] }> => {
  const response = await api.get(`/api/vehicle-owners/${id}/payments`);
  return response.data;
};

export const getMarketVehicles = async (): Promise<{ success: boolean; data: MarketVehicle[] }> => {
  const response = await api.get('/api/market-vehicles');
  return response.data;
};

export const getMarketVehicle = async (id: string): Promise<{ success: boolean; data: MarketVehicle }> => {
  const response = await api.get(`/api/market-vehicles/${id}`);
  return response.data;
};

export const createMarketVehicle = async (data: Partial<MarketVehicle>): Promise<{ success: boolean; data: MarketVehicle }> => {
  const response = await api.post('/api/market-vehicles', data);
  return response.data;
};

export const updateMarketVehicle = async (id: string, data: Partial<MarketVehicle>): Promise<{ success: boolean; data: MarketVehicle }> => {
  const response = await api.patch(`/api/market-vehicles/${id}`, data);
  return response.data;
};


export interface Party {
  id: string;
  party_type: 'COMPANY' | 'MARKET_PARTY';
  name: string;
  primary_mobile: string;
  address?: string;
  city?: string;
  state?: string;
  pin_code?: string;
  gstin?: string;
  pan_number?: string;
  is_tds_applicable: boolean;
  billing_configuration?: any;
  current_balance?: number;
  created_at: string;
  updated_at: string;
  outstanding?: number; // Depending on API response
  credit?: number;
}

export const getParties = async (): Promise<{ success: boolean; data: Party[] }> => {
  const response = await api.get('/api/parties');
  return response.data;
};

export const getParty = async (id: string): Promise<{ success: boolean; data: Party }> => {
  const response = await api.get(`/api/parties/${id}`);
  return response.data;
};

export const createParty = async (data: Partial<Party>): Promise<{ success: boolean; data: Party }> => {
  const response = await api.post('/api/parties', data);
  return response.data;
};

export const updateParty = async (id: string, data: Partial<Party>): Promise<{ success: boolean; data: Party }> => {
  const response = await api.patch(`/api/parties/${id}`, data);
  return response.data;
};

export const getPartyFinancials = async (id: string): Promise<{ success: boolean; data: any }> => {
  const response = await api.get(`/api/parties/${id}/financials`);
  return response.data;
};

export const getPartyTrips = async (id: string): Promise<{ success: boolean; data: any[] }> => {
  const response = await api.get(`/api/parties/${id}/trips`);
  return response.data;
};

export const getPartyBills = async (id: string): Promise<{ success: boolean; data: any[] }> => {
  const response = await api.get(`/api/parties/${id}/bills`);
  return response.data;
};

export const getPartyPayments = async (id: string): Promise<{ success: boolean; data: any[] }> => {
  const response = await api.get(`/api/parties/${id}/payments`);
  return response.data;
};

export const updatePartyBillingConfig = async (id: string, billing_configuration: any): Promise<{ success: boolean; data: Party }> => {
  const response = await api.patch(`/api/parties/${id}/billing-config`, { billing_configuration });
  return response.data;
};
