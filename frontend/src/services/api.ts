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

// ==========================================
// Bills API
// ==========================================

export interface BillListItem {
  id: string;
  bill_number: string;
  party_id: string;
  party_name: string;
  financial_year_id: string;
  financial_year_code: string;
  bill_status: 'GENERATED' | 'SUBMITTED' | 'PAID' | 'CANCELLED';
  billing_mode: 'INDIVIDUAL' | 'CONSOLIDATED';
  bill_date: string;
  current_version: number;
  total_amount: string | number;
  paid_amount: string | number;
  balance_amount: string | number;
  submitted_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
}

export interface BillListParams {
  search?: string;
  party_id?: string;
  bill_status?: 'GENERATED' | 'SUBMITTED' | 'PAID' | 'CANCELLED';
  from_date?: string;
  to_date?: string;
  financial_year_id?: string;
  billing_mode?: 'INDIVIDUAL' | 'CONSOLIDATED';
  page?: number;
  limit?: number;
  sort_by?: 'bill_date' | 'bill_number' | 'total_amount' | 'created_at';
  sort_order?: 'asc' | 'desc' | 'ASC' | 'DESC';
}

export interface BillListResponse {
  success: boolean;
  data: BillListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface BillItem {
  id: string;
  bill_id: string;
  trip_id?: string | null;
  sequence_no: number;
  description: string;
  quantity?: number | null;
  unit_price?: number | null;
  line_amount: string | number;
  is_active: boolean;
  trip_number?: string;
  trip_date?: string;
  vehicle_number?: string;
  route_origin?: string;
  route_destination?: string;
}

export interface BillVersion {
  id: string;
  bill_id: string;
  version_number: number;
  version_label: string;
  version_status: 'ACTIVE' | 'SUPERSEDED' | 'CANCELLED';
  template_id?: string | null;
  template_snapshot: Record<string, any>;
  header_snapshot: Record<string, any>;
  totals_snapshot: Record<string, any>;
  resolved_dynamic_fields?: Record<string, any> | null;
  created_by: string;
  creator_name?: string;
  created_at: string;
  items?: BillItem[];
}

export interface BillDetail {
  id: string;
  bill_number: string;
  party_id: string;
  party_name: string;
  financial_year_id: string;
  financial_year_code: string;
  bill_status: 'GENERATED' | 'SUBMITTED' | 'PAID' | 'CANCELLED';
  billing_mode: 'INDIVIDUAL' | 'CONSOLIDATED';
  bill_date: string;
  current_version: number;
  total_amount: string | number;
  paid_amount: string | number;
  balance_amount: string | number;
  submitted_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  cancelled_by?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  party: {
    id: string;
    name: string;
    primary_mobile?: string;
    gstin?: string;
    address?: string;
    city?: string;
    state?: string;
    pin_code?: string;
    billing_address?: string;
  };
  financial_year: {
    id: string;
    code: string;
    start_date: string;
    end_date: string;
  };
  creator?: { id: string; name: string };
  canceller?: { id: string; name: string } | null;
  items: BillItem[];
  versions: BillVersion[];
  allocations: Array<{
    id: string;
    payment_id: string;
    payment_number?: string;
    payment_date?: string;
    payment_type?: string;
    payment_mode?: string;
    payment_status?: string;
    allocation_type: string;
    allocation_amount: string | number;
    allocation_status: 'ACTIVE' | 'REVERSED';
    reversed_at: string | null;
    created_at: string;
    created_by_name?: string;
  }>;
}

export interface EligibleTrip {
  id: string;
  trip_number: string;
  trip_date: string;
  loading_date: string | null;
  unloading_date: string | null;
  route_origin: string;
  route_destination: string;
  vehicle_number: string;
  vehicle_relationship: string;
  status: string;
  pod_status: string;
  pod_received_at: string | null;
  receivable_amount: string | number;
  freight_amount: string | number;
  detention_amount: string | number;
}

export interface NumberingSeries {
  id: string;
  party_id: string;
  party_name?: string;
  financial_year_id: string;
  financial_year_code?: string;
  series_code: string;
  prefix: string;
  current_number: number;
  is_active: boolean;
}

export interface FinancialYear {
  id: string;
  code: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export const getBills = async (params?: BillListParams): Promise<BillListResponse> => {
  const response = await api.get('/api/bills', { params });
  return response.data;
};

export const getBill = async (id: string): Promise<{ success: boolean; data: BillDetail }> => {
  const response = await api.get(`/api/bills/${id}`);
  return response.data;
};

export const getEligibleTrips = async (partyId: string): Promise<{ success: boolean; data: EligibleTrip[] }> => {
  const response = await api.get('/api/bills/eligible-trips', { params: { party_id: partyId } });
  return response.data;
};

export const getNumberingSeries = async (partyId?: string, financialYearId?: string): Promise<{ success: boolean; data: NumberingSeries[] }> => {
  const response = await api.get('/api/bills/numbering-series', { params: { party_id: partyId, financial_year_id: financialYearId } });
  return response.data;
};

export const getFinancialYears = async (): Promise<{ success: boolean; data: FinancialYear[] }> => {
  const response = await api.get('/api/financial-years');
  return response.data;
};

export const generateBill = async (data: any): Promise<{ success: boolean; data: { bill: any; version: any } }> => {
  const response = await api.post('/api/bills', data);
  return response.data;
};

export const submitBill = async (id: string): Promise<{ success: boolean; data: any }> => {
  const response = await api.post(`/api/bills/${id}/submit`);
  return response.data;
};

export const cancelBill = async (id: string, cancel_reason: string): Promise<{ success: boolean; data: any }> => {
  const response = await api.post(`/api/bills/${id}/cancel`, { cancel_reason });
  return response.data;
};

export const createBillVersion = async (id: string, data: any): Promise<{ success: boolean; data: BillVersion }> => {
  const response = await api.post(`/api/bills/${id}/versions`, data);
  return response.data;
};

export const getBillVersion = async (id: string, versionNumber: number): Promise<{ success: boolean; data: BillVersion }> => {
  const response = await api.get(`/api/bills/${id}/versions/${versionNumber}`);
  return response.data;
};

export const downloadBillPdf = async (id: string, versionNumber?: number): Promise<Blob> => {
  const url = versionNumber ? `/api/bills/${id}/versions/${versionNumber}/pdf` : `/api/bills/${id}/pdf`;
  const response = await api.get(url, { responseType: 'blob' });
  return response.data;
};

