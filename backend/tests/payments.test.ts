import request from 'supertest';
import { app } from '../src/app';

// Mock DB
const mockPayment = {
  id: 'a0000000-0000-0000-0000-000000000001',
  payment_id: 'PAY-20261013-1001',
  payment_date: '2026-10-13',
  payment_mode: 'BANK_TRANSFER',
  amount: '10000.00',
  payment_type: 'INCOMING',
  category: 'COMPANY_PAYMENT',
  party_id: 'b0000000-0000-0000-0000-000000000001',
  vehicle_owner_id: null,
  other_business_category_id: null,
  payment_status: 'ACTIVE',
  reversal_reason: null,
  reversed_by: null,
  reversed_at: null,
  created_by: 'u1',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

let currentRole = 'OWNER';

jest.mock('../src/db', () => ({
  query: jest.fn().mockImplementation((q: string, values?: any[]) => {
    // Other business categories
    if (q.includes('FROM other_business_categories')) {
      return Promise.resolve({
        rows: [
          { id: 'obc-1', category_name: 'Rent', category_type: 'PAYMENT', is_active: true },
          { id: 'obc-2', category_name: 'Scrap Sale', category_type: 'RECEIPT', is_active: true }
        ]
      });
    }

    // Available credits
    if (q.includes('FROM payment_allocations pa') && q.includes('CREDIT_GENERATED')) {
      return Promise.resolve({
        rows: [
          {
            credit_allocation_id: 'ca-1',
            payment_id: mockPayment.id,
            payment_id_code: mockPayment.payment_id,
            payment_date: mockPayment.payment_date,
            party_id: mockPayment.party_id,
            generated_amount: '5000.00',
            utilized_amount: '2000.00',
            remaining_amount: '3000.00',
            created_at: new Date().toISOString()
          }
        ]
      });
    }

    // Party check
    if (q.includes('SELECT * FROM parties WHERE id =')) {
      return Promise.resolve({ rows: [{ id: values?.[0], name: 'Test Party' }] });
    }

    // Payment count
    if (q.includes('COUNT(*) AS total')) {
      return Promise.resolve({ rows: [{ total: '1' }] });
    }

    // Payment list
    if (q.includes('FROM payments p') && q.includes('ORDER BY')) {
      return Promise.resolve({ rows: [{ ...mockPayment, party_name: 'Test Party' }] });
    }

    // Payment detail
    if (q.includes('SELECT') && q.includes('FROM payments p') && q.includes('WHERE p.id = $1')) {
      if (values?.[0] === 'nonexistent') return Promise.resolve({ rowCount: 0, rows: [] });
      return Promise.resolve({ rowCount: 1, rows: [{ ...mockPayment, party_name: 'Test Party' }] });
    }

    // Allocations
    if (q.includes('FROM payment_allocations pa') && q.includes('WHERE pa.payment_id = $1')) {
      return Promise.resolve({
        rows: [
          {
            id: 'alloc-1',
            allocation_type: 'BILL',
            allocation_amount: '10000.00',
            allocation_status: 'ACTIVE',
            bill_id: 'bill-1',
            bill_number: 'SRL/26-27/001'
          }
        ]
      });
    }

    // FIFO runs query
    if (q.includes('FROM payment_fifo_runs r')) {
      return Promise.resolve({ rows: [] });
    }

    // Documents query
    if (q.includes('FROM documents d') && q.includes("entity_type = 'PAYMENT'")) {
      return Promise.resolve({ rows: [] });
    }

    // Audit query
    if (q.includes('FROM audit_events a') && q.includes('WHERE a.entity_id = $1')) {
      return Promise.resolve({
        rows: [
          {
            id: 'aud-1',
            action_type: 'CREATE',
            event_time: new Date().toISOString(),
            actor_name: 'Owner User'
          }
        ]
      });
    }

    // Simple payment lookup
    if (q.includes('SELECT id FROM payments WHERE id = $1')) {
      if (values?.[0] === 'nonexistent') return Promise.resolve({ rowCount: 0, rows: [] });
      return Promise.resolve({ rowCount: 1, rows: [{ id: values?.[0] }] });
    }

    return Promise.resolve({ rowCount: 0, rows: [] });
  }),
  pool: {
    query: jest.fn().mockImplementation(() => Promise.resolve({ rows: [] })),
    end: jest.fn()
  }
}));

jest.mock('../src/db/transaction', () => ({
  withTransaction: jest.fn().mockImplementation(async (callback) => {
    const mockClient = {
      query: jest.fn().mockImplementation((sql: string, params?: any[]) => {
        if (sql.includes('INSERT INTO payments')) {
          return Promise.resolve({
            rows: [{ ...mockPayment, id: 'new-pay-id', amount: params?.[3] }]
          });
        }
        if (sql.includes('INSERT INTO payment_allocations')) {
          return Promise.resolve({
            rows: [{ id: 'new-alloc-id', allocation_type: params?.[1], allocation_amount: params?.[2] }]
          });
        }
        if (sql.includes('INSERT INTO party_credits')) {
          return Promise.resolve({ rows: [{ id: 'new-pc-id' }] });
        }
        if (sql.includes('SELECT * FROM payments WHERE id = $1')) {
          return Promise.resolve({ rows: [mockPayment] });
        }
        if (sql.includes('UPDATE payments SET payment_status =')) {
          return Promise.resolve({ rows: [{ ...mockPayment, payment_status: 'REVERSED' }] });
        }
        if (sql.includes('UPDATE payments SET')) {
          return Promise.resolve({ rows: [{ ...mockPayment, payment_mode: 'CASH' }] });
        }
        if (sql.includes('SELECT allocation_amount, payment_id FROM payment_allocations')) {
          return Promise.resolve({ rows: [{ allocation_amount: '5000', payment_id: mockPayment.id }] });
        }
        if (sql.includes('INSERT INTO documents')) {
          return Promise.resolve({ rows: [{ id: 'doc-1', document_type: params?.[0], original_name: params?.[1] }] });
        }
        if (sql.includes('INSERT INTO payment_fifo_runs')) {
          return Promise.resolve({ rows: [{ id: 'run-1', run_number: 1, run_status: 'COMPLETED' }] });
        }
        if (sql.includes('SELECT id AS bill_id')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('SELECT NULL::uuid AS bill_id, t.id AS trip_id')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('SELECT COALESCE(SUM(allocation_amount), 0) AS total_active')) {
          return Promise.resolve({ rows: [{ total_active: 0 }] });
        }
        if (sql.includes('SELECT pa.id, pa.allocation_amount')) {
          return Promise.resolve({ rows: [{ id: 'pa-1', allocation_amount: '5000', utilized_amount: 0 }] });
        }
        if (sql.includes('SELECT * FROM payment_allocations WHERE payment_id = $1')) {
          return Promise.resolve({ rows: [{ id: 'old-alloc-1', allocation_amount: 10000 }] });
        }
        if (sql.includes('SELECT COALESCE(MAX(run_number), 0) + 1')) {
          return Promise.resolve({ rows: [{ next_run: 1 }] });
        }
        return Promise.resolve({ rowCount: 1, rows: [] });
      })
    };
    return callback(mockClient);
  })
}));

// Mock auth middleware to be role-aware
jest.mock('../src/middlewares/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    if (req.headers['x-unauthenticated']) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    req.user = { id: 'u1', name: 'User', role: currentRole };
    next();
  }
}));

describe('Phase 3M - Payment Backend Contract Integration Tests', () => {
  beforeEach(() => {
    currentRole = 'OWNER';
  });

  describe('1. Authentication & RBAC', () => {
    it('GET /api/payments requires authentication', async () => {
      const res = await request(app).get('/api/payments').set('x-unauthenticated', 'true');
      expect(res.status).toBe(401);
    });

    it('GET /api/payments/:id requires authentication', async () => {
      const res = await request(app).get(`/api/payments/${mockPayment.id}`).set('x-unauthenticated', 'true');
      expect(res.status).toBe(401);
    });

    it('POST /api/payments/:id/reallocate rejects non-OWNER (STAFF)', async () => {
      currentRole = 'STAFF';
      const res = await request(app)
        .post(`/api/payments/${mockPayment.id}/reallocate`)
        .send({
          allocations: [{ allocation_type: 'OTHER_BUSINESS', allocated_amount: 10000 }]
        });
      expect(res.status).toBe(403);
    });

    it('POST /api/payments/:id/reverse rejects non-OWNER (STAFF)', async () => {
      currentRole = 'STAFF';
      const res = await request(app)
        .post(`/api/payments/${mockPayment.id}/reverse`)
        .send({ reversal_reason: 'Mistake in entry' });
      expect(res.status).toBe(403);
    });

    it('POST /api/payments/fifo rejects non-OWNER (STAFF)', async () => {
      currentRole = 'STAFF';
      const res = await request(app)
        .post('/api/payments/fifo')
        .send({ party_id: 'b0000000-0000-0000-0000-000000000001', payment_id: mockPayment.id });
      expect(res.status).toBe(403);
    });

    it('CA role has read access to payments and details, but no write access', async () => {
      currentRole = 'CA';
      const listRes = await request(app).get('/api/payments');
      expect(listRes.status).toBe(200);

      const detailRes = await request(app).get(`/api/payments/${mockPayment.id}`);
      expect(detailRes.status).toBe(200);

      const createRes = await request(app).post('/api/payments').send({});
      expect(createRes.status).toBe(403);
    });
  });

  describe('2. Payment List & Filtering', () => {
    it('GET /api/payments returns list with pagination structure', async () => {
      const res = await request(app).get('/api/payments?page=1&limit=10&payment_type=INCOMING');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(10);
    });
  });

  describe('3. Payment Detail', () => {
    it('GET /api/payments/:id returns complete payment graph', async () => {
      const res = await request(app).get(`/api/payments/${mockPayment.id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.payment_id).toBe(mockPayment.payment_id);
      expect(res.body.data.allocations).toBeDefined();
      expect(res.body.data.fifo_runs).toBeDefined();
      expect(res.body.data.documents).toBeDefined();
      expect(res.body.data.audit_history).toBeDefined();
    });

    it('GET /api/payments/:id returns 404 for nonexistent payment', async () => {
      const res = await request(app).get('/api/payments/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('4. Payment Creation', () => {
    it('creates an incoming party payment with allocations', async () => {
      const res = await request(app)
        .post('/api/payments')
        .send({
          payment_date: '2026-10-13',
          payment_mode: 'BANK_TRANSFER',
          amount: 15000,
          payment_direction: 'INCOMING',
          payment_category: 'COMPANY_PAYMENT',
          party_id: 'b0000000-0000-0000-0000-000000000001',
          allocations: [
            { allocation_type: 'BILL', allocated_amount: 10000, target_bill_id: 'c0000000-0000-0000-0000-000000000001' },
            { allocation_type: 'CREDIT_GENERATED', allocated_amount: 5000 }
          ]
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('rejects creation if allocations do not equal payment amount', async () => {
      const res = await request(app)
        .post('/api/payments')
        .send({
          payment_date: '2026-10-13',
          payment_mode: 'CASH',
          amount: 15000,
          payment_direction: 'INCOMING',
          payment_category: 'COMPANY_PAYMENT',
          party_id: 'b0000000-0000-0000-0000-000000000001',
          allocations: [
            { allocation_type: 'BILL', allocated_amount: 10000, target_bill_id: 'c0000000-0000-0000-0000-000000000001' }
          ]
        });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('PAYMENT_INTEGRITY_VIOLATION');
    });

    it('supports Other Business Payment with other_business_category_id', async () => {
      const res = await request(app)
        .post('/api/payments')
        .send({
          payment_date: '2026-10-13',
          payment_mode: 'UPI',
          amount: 2500,
          payment_direction: 'OUTGOING',
          payment_category: 'OTHER_BUSINESS_PAYMENT',
          other_business_category_id: 'd0000000-0000-0000-0000-000000000001',
          allocations: [
            { allocation_type: 'OTHER_BUSINESS', allocated_amount: 2500 }
          ]
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe('5. Other Business Categories API', () => {
    it('GET /api/other-business-categories returns active categories', async () => {
      const res = await request(app).get('/api/other-business-categories');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].category_name).toBe('Rent');
    });
  });

  describe('6. Party Available Credits API', () => {
    it('GET /api/parties/:id/credits/available returns unexhausted credits', async () => {
      const res = await request(app).get('/api/parties/b0000000-0000-0000-0000-000000000001/credits/available');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].remaining_amount).toBe('3000.00');
    });
  });

  describe('7. Payment Editing', () => {
    it('PATCH /api/payments/:id updates allowed mutable fields', async () => {
      const res = await request(app)
        .patch(`/api/payments/${mockPayment.id}`)
        .send({ payment_mode: 'CASH' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('PATCH /api/payments/:id rejects empty payload', async () => {
      const res = await request(app)
        .patch(`/api/payments/${mockPayment.id}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('8. Payment Reallocation', () => {
    it('POST /api/payments/:id/reallocate reallocates active payment allocations', async () => {
      const res = await request(app)
        .post(`/api/payments/${mockPayment.id}/reallocate`)
        .send({
          allocations: [
            { allocation_type: 'BILL', allocated_amount: 5000, target_bill_id: 'c0000000-0000-0000-0000-000000000001' },
            { allocation_type: 'CREDIT_GENERATED', allocated_amount: 5000 }
          ],
          reason: 'Correction of allocation distribution'
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('9. Payment Reversal', () => {
    it('POST /api/payments/:id/reverse marks payment reversed with reason', async () => {
      const res = await request(app)
        .post(`/api/payments/${mockPayment.id}/reverse`)
        .send({ reversal_reason: 'Cheque bounced' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.payment_status).toBe('REVERSED');
    });

    it('rejects reversal if reason is shorter than 5 characters', async () => {
      const res = await request(app)
        .post(`/api/payments/${mockPayment.id}/reverse`)
        .send({ reversal_reason: 'bad' });
      expect(res.status).toBe(400);
    });
  });

  describe('10. FIFO Allocation', () => {
    it('POST /api/payments/fifo allocates payment and creates run', async () => {
      const res = await request(app)
        .post('/api/payments/fifo')
        .send({
          party_id: 'b0000000-0000-0000-0000-000000000001',
          payment_id: mockPayment.id,
          amount: 10000
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.run).toBeDefined();
    });

    it('GET /api/payments/:id/fifo returns runs for payment', async () => {
      const res = await request(app).get(`/api/payments/${mockPayment.id}/fifo`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('11. Secure Payment Attachments', () => {
    it('POST /api/documents/payment links document to payment', async () => {
      const res = await request(app)
        .post('/api/documents/payment')
        .send({
          payment_id: mockPayment.id,
          document_type: 'PAYMENT_RECEIPT'
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.document_type).toBe('PAYMENT_RECEIPT');
    });
  });

  describe('12. Payment Audit History', () => {
    it('GET /api/payments/:id/audit returns chronological audit events', async () => {
      const res = await request(app).get(`/api/payments/${mockPayment.id}/audit`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].action_type).toBe('CREATE');
    });
  });
});
