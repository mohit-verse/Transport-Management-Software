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

export interface OwnFleetVehicle {
  id: string;
  vehicle_number: string;
  vehicle_type: string;
  capacity_tonnage: number;
  purchase_date: string;
  status: 'AVAILABLE' | 'IN_TRIP' | 'MAINTENANCE' | 'SOLD';
  created_at: string;
  updated_at: string;
}

export const getOwnFleetVehicles = async (): Promise<{ success: boolean; data: OwnFleetVehicle[] }> => {
  const response = await api.get('/api/own-fleet');
  return response.data;
};

export const getOwnFleetVehicle = async (id: string): Promise<{ success: boolean; data: OwnFleetVehicle }> => {
  const response = await api.get(`/api/own-fleet/${id}`);
  return response.data;
};

export const createOwnFleetVehicle = async (data: Partial<OwnFleetVehicle>): Promise<{ success: boolean; data: OwnFleetVehicle }> => {
  const response = await api.post('/api/own-fleet', data);
  return response.data;
};

export const updateOwnFleetVehicle = async (id: string, data: Partial<OwnFleetVehicle>): Promise<{ success: boolean; data: OwnFleetVehicle }> => {
  const response = await api.patch(`/api/own-fleet/${id}`, data);
  return response.data;
};

export const setOwnFleetMaintenance = async (id: string): Promise<{ success: boolean; data: OwnFleetVehicle }> => {
  const response = await api.post(`/api/own-fleet/${id}/maintenance`);
  return response.data;
};

export const setOwnFleetSold = async (id: string): Promise<{ success: boolean; data: OwnFleetVehicle }> => {
  const response = await api.post(`/api/own-fleet/${id}/sold`);
  return response.data;
};

export const getOwnFleetTrips = async (id: string): Promise<{ success: boolean; data: any[] }> => {
  const response = await api.get(`/api/own-fleet/${id}/trips`);
  return response.data;
};

export const getOwnFleetExpenses = async (id: string): Promise<{ success: boolean; data: any[] }> => {
  const response = await api.get(`/api/own-fleet/${id}/expenses`);
  return response.data;
};

export const uploadOwnFleetDocument = async (id: string, formData: FormData): Promise<{ success: boolean; data: any }> => {
  const response = await api.post(`/api/own-fleet/${id}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const getDocuments = async (params?: { entity_type?: string; entity_id?: string }): Promise<{ success: boolean; data: any[] }> => {
  const response = await api.get('/api/documents', { params });
  return response.data;
};

// ==========================================
// Payments API
// ==========================================

export interface PaymentAllocation {
  id: string;
  payment_id: string;
  allocation_type: 'BILL' | 'TRIP' | 'CREDIT_GENERATED' | 'CREDIT_UTILIZED' | 'VEHICLE_OWNER' | 'OWN_FLEET_EXPENSE' | 'OTHER_BUSINESS';
  allocation_amount: number | string;
  allocation_status: 'ACTIVE' | 'REVERSED';
  bill_id?: string | null;
  bill_number?: string | null;
  trip_id?: string | null;
  trip_number?: string | null;
  vehicle_owner_id?: string | null;
  vehicle_owner_name?: string | null;
  own_fleet_expense_detail_id?: string | null;
  party_credit_source_id?: string | null;
  created_at: string;
}

export interface PaymentFifoRunAllocation {
  id: string;
  allocation_id: string;
  target_trip_id?: string | null;
  target_bill_id?: string | null;
  allocation_sequence: number;
  receivable_before: number | string;
  receivable_after: number | string;
  bill_number?: string | null;
  trip_number?: string | null;
}

export interface PaymentFifoRun {
  id: string;
  run_number: number;
  run_status: string;
  created_at: string;
  allocations: PaymentFifoRunAllocation[];
}

export interface PaymentAudit {
  id: string;
  action_type: string;
  event_time: string;
  actor_user_id: string;
  actor_name?: string | null;
  before_state?: any;
  after_state?: any;
}

export interface Payment {
  id: string;
  payment_id: string;
  payment_date: string;
  payment_type: 'INCOMING' | 'OUTGOING';
  category: 'COMPANY_PAYMENT' | 'MARKET_PARTY_PAYMENT' | 'OTHER_BUSINESS_RECEIPT' | 'VEHICLE_OWNER_PAYMENT' | 'OWN_FLEET_EXPENSE' | 'OTHER_BUSINESS_PAYMENT';
  amount: number | string;
  payment_mode: 'UPI' | 'BANK_TRANSFER' | 'CASH';
  payment_status: 'ACTIVE' | 'REVERSED';
  party_id?: string | null;
  party_name?: string | null;
  party_type?: string | null;
  vehicle_owner_id?: string | null;
  vehicle_owner_name?: string | null;
  other_business_category_id?: string | null;
  other_business_category_name?: string | null;
  reversal_reason?: string | null;
  reversed_by?: string | null;
  reversed_at?: string | null;
  reverser_name?: string | null;
  created_by?: string;
  creator_name?: string | null;
  created_at: string;
  updated_at: string;
  allocations?: PaymentAllocation[];
  fifo_runs?: PaymentFifoRun[];
  documents?: any[];
  audit_history?: PaymentAudit[];
}

export interface OtherBusinessCategory {
  id: string;
  category_name: string;
  category_type: 'PAYMENT' | 'RECEIPT';
  is_active: boolean;
}

export interface AvailableCredit {
  credit_allocation_id: string;
  payment_id: string;
  payment_id_code: string;
  payment_date: string;
  party_id: string;
  generated_amount: number | string;
  utilized_amount: number | string;
  remaining_amount: number | string;
  created_at: string;
}

export interface PaymentListParams {
  search?: string;
  from_date?: string;
  to_date?: string;
  payment_type?: 'INCOMING' | 'OUTGOING';
  category?: string;
  payment_mode?: 'UPI' | 'BANK_TRANSFER' | 'CASH';
  payment_status?: 'ACTIVE' | 'REVERSED';
  party_id?: string;
  vehicle_owner_id?: string;
  trip_id?: string;
  bill_id?: string;
  page?: number;
  limit?: number;
  sort_by?: 'payment_date' | 'created_at' | 'amount';
  sort_order?: 'ASC' | 'DESC';
}

export interface PaymentListResponse {
  success: boolean;
  data: Payment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const getPayments = async (params?: PaymentListParams): Promise<PaymentListResponse> => {
  const response = await api.get('/api/payments', { params });
  return response.data;
};

export const getPayment = async (id: string): Promise<{ success: boolean; data: Payment }> => {
  const response = await api.get(`/api/payments/${id}`);
  return response.data;
};

export const createPayment = async (data: any): Promise<{ success: boolean; data: Payment }> => {
  const response = await api.post('/api/payments', data);
  return response.data;
};

export const updatePayment = async (id: string, data: any): Promise<{ success: boolean; data: Payment }> => {
  const response = await api.patch(`/api/payments/${id}`, data);
  return response.data;
};

export const reallocatePayment = async (id: string, data: any): Promise<{ success: boolean; data: Payment }> => {
  const response = await api.post(`/api/payments/${id}/reallocate`, data);
  return response.data;
};

export const reversePayment = async (id: string, reversal_reason: string): Promise<{ success: boolean; data: Payment }> => {
  const response = await api.post(`/api/payments/${id}/reverse`, { reversal_reason });
  return response.data;
};

export const utilizeCredit = async (data: any): Promise<{ success: boolean; data: any }> => {
  const response = await api.post('/api/payments/credits/utilize', data);
  return response.data;
};

export const fifoAllocation = async (data: any): Promise<{ success: boolean; data: any }> => {
  const response = await api.post('/api/payments/fifo', data);
  return response.data;
};

export const getPaymentFifoRuns = async (id: string): Promise<{ success: boolean; data: any[] }> => {
  const response = await api.get(`/api/payments/${id}/fifo`);
  return response.data;
};

export const getPaymentAudit = async (id: string): Promise<{ success: boolean; data: PaymentAudit[] }> => {
  const response = await api.get(`/api/payments/${id}/audit`);
  return response.data;
};

export const getOtherBusinessCategories = async (type?: string): Promise<{ success: boolean; data: OtherBusinessCategory[] }> => {
  const response = await api.get('/api/other-business-categories', { params: type ? { type } : undefined });
  return response.data;
};

export const getPartyAvailableCredits = async (partyId: string): Promise<{ success: boolean; data: AvailableCredit[] }> => {
  const response = await api.get(`/api/parties/${partyId}/credits/available`);
  return response.data;
};

export const uploadPaymentDocument = async (paymentId: string, documentType = 'PAYMENT_RECEIPT'): Promise<{ success: boolean; data: any }> => {
  const response = await api.post('/api/documents/payment', { payment_id: paymentId, document_type: documentType });
  return response.data;
};
