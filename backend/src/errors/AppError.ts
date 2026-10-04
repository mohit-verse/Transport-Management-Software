export type ErrorCode = 
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'BUSINESS_RULE_VIOLATION'
  | 'CONFLICT'
  | 'CONSTRAINT_VIOLATION'
  | 'IMMUTABLE_RECORD'
  | 'PAYMENT_INTEGRITY_VIOLATION'
  | 'BILLING_VIOLATION'
  | 'FILE_OPERATION_FAILED'
  | 'INTERNAL_SERVER_ERROR';

export class AppError extends Error {
  public statusCode: number;
  public code: ErrorCode;
  public fields?: Record<string, string>;

  constructor(code: ErrorCode, message: string, statusCode: number, fields?: Record<string, string>) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.fields = fields;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
