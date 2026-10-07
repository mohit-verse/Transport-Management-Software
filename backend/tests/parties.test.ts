import { getParties, getPartyFinancials } from '../src/modules/parties/parties.service';
import { query } from '../src/db';

jest.mock('../src/db', () => ({
  query: jest.fn(),
  pool: { query: jest.fn() }
}));

describe('Parties Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getParties', () => {
    it('should compute current_outstanding and current_credit properly', async () => {
      const mockRows = [{
        id: '123',
        name: 'Test Party',
        current_outstanding: '1500.50',
        current_credit: '200.00'
      }];
      (query as jest.Mock).mockResolvedValue({ rows: mockRows });

      const result = await getParties();

      expect(query).toHaveBeenCalledTimes(1);
      const sql = (query as jest.Mock).mock.calls[0][0];
      expect(sql).toContain('current_outstanding');
      expect(sql).toContain('current_credit');
      expect(result).toHaveLength(1);
      expect(result[0].current_outstanding).toBe(1500.5);
      expect(result[0].current_credit).toBe(200);
    });
  });

  describe('getPartyFinancials', () => {
    it('should aggregate financials correctly', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{
            total_receivable: '5000',
            amount_received: '3000',
            tds_amount: '100',
            deductions: '50'
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            current_outstanding: '1900'
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            credit_generated: '500',
            credit_utilized: '100'
          }]
        });

      const res = await getPartyFinancials('123');
      
      expect(query).toHaveBeenCalledTimes(3);
      expect(res.financialPosition.totalReceivable).toBe(5000);
      expect(res.financialPosition.outstanding).toBe(1900);
      expect(res.creditPosition.creditRemaining).toBe(400);
      expect(res.creditPosition.currentCredit).toBe(400);
      expect(res.tdsInformation.totalTdsDeducted).toBe(100);
    });
  });
});
