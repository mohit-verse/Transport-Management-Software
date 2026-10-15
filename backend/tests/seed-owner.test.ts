import bcrypt from 'bcrypt';
import { pool } from '../src/db';
import { seedOwner } from '../src/scripts/seed-owner';

describe('Initial Owner Provisioning (seed:owner)', () => {
  beforeEach(async () => {
    // Clean users and related tables before each test
    await pool.query('TRUNCATE users, audit_events, user_sessions CASCADE');
  });

  afterAll(async () => {
    await pool.query('TRUNCATE users, audit_events, user_sessions CASCADE');
  });

  it('successfully provisions initial Owner account', async () => {
    const result = await seedOwner({
      name: 'Primary Owner',
      mobile: '9876543210',
      password: 'strongAdminPassword123',
    });

    expect(result.status).toBe('CREATED');
    expect(result.userId).toBeDefined();

    // Verify in database
    const res = await pool.query('SELECT * FROM users WHERE id = $1', [result.userId]);
    expect(res.rows.length).toBe(1);

    const user = res.rows[0];
    expect(user.role).toBe('OWNER');
    expect(user.name).toBe('Primary Owner');
    expect(user.mobile_number).toBe('9876543210');
    expect(user.is_active).toBe(true);

    // Verify password was hashed with bcrypt
    const match = await bcrypt.compare('strongAdminPassword123', user.password_hash);
    expect(match).toBe(true);
  });

  it('is idempotent and skips creation when an active Owner already exists', async () => {
    // First run creates Owner
    await seedOwner({
      name: 'First Owner',
      mobile: '9876543210',
      password: 'password12345',
    });

    // Second run should recognize existing Owner and skip
    const secondResult = await seedOwner({
      name: 'Second Attempt',
      mobile: '9876543211',
      password: 'anotherPassword123',
    });

    expect(secondResult.status).toBe('ALREADY_EXISTS');
    expect(secondResult.message).toContain('Active Owner account already exists');

    // Verify only 1 owner exists in database
    const countRes = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'OWNER'");
    expect(parseInt(countRes.rows[0].count, 10)).toBe(1);
  });

  it('fails explicitly when mobile number conflicts with an existing non-Owner account', async () => {
    // Insert a Staff account directly
    const staffHash = await bcrypt.hash('staffpass123', 10);
    await pool.query(
      `INSERT INTO users (name, mobile_number, password_hash, role, is_active)
       VALUES ('Staff Person', '9876543210', $1, 'STAFF', true)`,
      [staffHash]
    );

    // Attempting to seed owner with the same mobile number must fail
    await expect(
      seedOwner({
        name: 'New Owner',
        mobile: '9876543210',
        password: 'adminPassword123',
      })
    ).rejects.toThrow(/Mobile number conflict.*STAFF/);
  });

  it('rejects invalid mobile number format', async () => {
    await expect(
      seedOwner({
        name: 'Owner',
        mobile: '12345', // too short
        password: 'validPassword123',
      })
    ).rejects.toThrow(/Invalid mobile number format/);

    await expect(
      seedOwner({
        name: 'Owner',
        mobile: 'not-a-number',
        password: 'validPassword123',
      })
    ).rejects.toThrow(/Invalid mobile number format/);
  });

  it('rejects passwords shorter than 8 characters', async () => {
    await expect(
      seedOwner({
        name: 'Owner',
        mobile: '9876543210',
        password: 'short',
      })
    ).rejects.toThrow(/at least 8 characters/);
  });

  it('rejects missing credentials', async () => {
    await expect(
      seedOwner({
        mobile: '',
        password: '',
      })
    ).rejects.toThrow(/INITIAL_OWNER_MOBILE and INITIAL_OWNER_PASSWORD are required/);
  });
});
