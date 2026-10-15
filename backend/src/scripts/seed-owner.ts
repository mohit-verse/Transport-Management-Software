import { pool } from '../db';
import { hashPassword } from '../modules/auth/auth.service';

export interface SeedOwnerOptions {
  name?: string;
  mobile?: string;
  password?: string;
}

export interface SeedOwnerResult {
  status: 'CREATED' | 'ALREADY_EXISTS';
  message: string;
  userId?: string;
}

export async function seedOwner(options?: SeedOwnerOptions): Promise<SeedOwnerResult> {
  const name = (options?.name || process.env.INITIAL_OWNER_NAME || 'SSRL Owner').trim();
  const mobile = (options?.mobile || process.env.INITIAL_OWNER_MOBILE || '').trim();
  const password = (options?.password || process.env.INITIAL_OWNER_PASSWORD || '').trim();

  if (!mobile || !password) {
    throw new Error('INITIAL_OWNER_MOBILE and INITIAL_OWNER_PASSWORD are required');
  }

  // Validate mobile number: 10-15 digits with optional leading +
  const mobileRegex = /^\+?[0-9]{10,15}$/;
  if (!mobileRegex.test(mobile)) {
    throw new Error(`Invalid mobile number format: "${mobile}". Must be 10-15 digits.`);
  }

  // Validate password strength: minimum 8 characters
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check if an active Owner account already exists
    const ownerRes = await client.query(
      "SELECT id, name, mobile_number FROM users WHERE role = 'OWNER' AND is_active = true LIMIT 1"
    );

    if (ownerRes.rows.length > 0) {
      const existing = ownerRes.rows[0];
      const maskedMobile = existing.mobile_number.length > 6
        ? `${existing.mobile_number.slice(0, 3)}****${existing.mobile_number.slice(-3)}`
        : '***';

      await client.query('COMMIT');
      return {
        status: 'ALREADY_EXISTS',
        message: `Active Owner account already exists (${existing.name}, mobile: ${maskedMobile}). Skipping creation.`,
        userId: existing.id,
      };
    }

    // 2. Check if mobile number conflicts with an existing non-Owner user
    const mobileConflictRes = await client.query(
      'SELECT id, role, is_active FROM users WHERE mobile_number = $1',
      [mobile]
    );

    if (mobileConflictRes.rows.length > 0) {
      const conflictUser = mobileConflictRes.rows[0];
      await client.query('ROLLBACK');
      throw new Error(
        `Mobile number conflict: User with mobile number already exists with role '${conflictUser.role}'. Cannot provision as Owner.`
      );
    }

    // 3. Hash password using auth.service hashPassword
    const hashedPassword = await hashPassword(password);

    // 4. Insert initial Owner record
    const insertRes = await client.query(
      `INSERT INTO users (name, mobile_number, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'OWNER', true)
       RETURNING id, name, mobile_number, role, is_active`,
      [name, mobile, hashedPassword]
    );

    await client.query('COMMIT');

    const createdUser = insertRes.rows[0];
    const maskedMobile = createdUser.mobile_number.length > 6
      ? `${createdUser.mobile_number.slice(0, 3)}****${createdUser.mobile_number.slice(-3)}`
      : '***';

    return {
      status: 'CREATED',
      message: `Initial Owner account provisioned successfully (${createdUser.name}, mobile: ${maskedMobile}).`,
      userId: createdUser.id,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// CLI execution handler
if (require.main === module) {
  seedOwner()
    .then((result) => {
      console.log(`[seed:owner] ${result.message}`);
      pool.end().then(() => process.exit(0));
    })
    .catch((err) => {
      console.error(`[seed:owner] ❌ Failed: ${err.message}`);
      pool.end().then(() => process.exit(1));
    });
}
