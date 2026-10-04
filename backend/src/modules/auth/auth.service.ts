import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../../db';
import { config } from '../../config';
import { AppError } from '../../errors/AppError';

export const login = async (mobileNumber: string, plainTextPassword: string): Promise<string> => {
  const res = await query('SELECT id, password_hash, role, is_active FROM users WHERE mobile_number = $1', [mobileNumber]);
  
  if (res.rows.length === 0) {
    throw new AppError('UNAUTHENTICATED', 'Invalid credentials', 401);
  }

  const user = res.rows[0];

  if (!user.is_active) {
    throw new AppError('FORBIDDEN', 'Account is deactivated', 403);
  }

  const isValid = await bcrypt.compare(plainTextPassword, user.password_hash);
  if (!isValid) {
    throw new AppError('UNAUTHENTICATED', 'Invalid credentials', 401);
  }

  // Update last_login_at
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);

  const token = jwt.sign(
    { id: user.id, role: user.role },
    config.jwt.secret,
    { expiresIn: '8h' }
  );

  return token;
};

export const getUserById = async (id: string) => {
  const res = await query('SELECT id, name, mobile_number, role, is_active, last_login_at FROM users WHERE id = $1', [id]);
  if (res.rows.length === 0) {
    throw new AppError('NOT_FOUND', 'User not found', 404);
  }
  return res.rows[0];
};

export const hashPassword = async (password: string) => {
  return bcrypt.hash(password, 10);
};
