import { getOwners, getOwnerFinancials, getOwnerVehicles, getOwnerTrips, getOwnerPayments } from '../src/modules/vehicle-owners/owners.service';
import { query } from '../src/db';

jest.mock('../src/db', () => ({
  query: jest.fn(),
  pool: { query: jest.fn() }
}));

describe('Vehicle Owners Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getOwners', () => {
    it('should retrieve owners with owned_vehicle_numbers', async () => {
      const mockRows = [{
        id: '123',
        name: 'Test Owner',
        owned_vehicle_numbers: ['MH12AB1234']
      }];
      (query as jest.Mock).mockResolvedValue({ rows: mockRows });

      const result = await getOwners();

      expect(query).toHaveBeenCalledTimes(1);
      const sql = (query as jest.Mock).mock.calls[0][0];
      expect(sql).toContain('ARRAY_AGG(mv.vehicle_number)');
      expect(result).toHaveLength(1);
      expect(result[0].owned_vehicle_numbers).toContain('MH12AB1234');
    });
  });

  describe('getOwnerFinancials', () => {
    it('should calculate totalPayable, amountPaid, and outstanding', async () => {
      (query as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM vehicle_owners WHERE id =')) {
          return Promise.resolve({ rows: [{ id: '123' }] });
        }
        return Promise.resolve({
          rows: [{
            totalPayable: '5000',
            amountPaid: '2000',
            outstanding: '3000'
          }]
        });
      });

      const result = await getOwnerFinancials('123');

      expect(result).toEqual({
        totalPayable: 5000,
        amountPaid: 2000,
        outstanding: 3000
      });
      expect(query).toHaveBeenCalledTimes(2);
    });
  });

  describe('getOwnerVehicles', () => {
    it('should return active market vehicles for the owner', async () => {
      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'v1', vehicle_number: 'MH12AB1234' }] });
      const result = await getOwnerVehicles('123');
      expect(query).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });
  });

  describe('getOwnerTrips', () => {
    it('should return trips for the owner', async () => {
      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 't1', trip_number: 'TRP-1' }] });
      const result = await getOwnerTrips('123');
      expect(query).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });
  });

  describe('getOwnerPayments', () => {
    it('should return payments for the owner', async () => {
      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'p1', amount: '1000' }] });
      const result = await getOwnerPayments('123');
      expect(query).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });
  });
});
