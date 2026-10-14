
import { z } from 'zod';

const safeFileName = z.string()
  .min(1, 'File name is required')
  .max(255, 'File name must not exceed 255 characters')
  .refine(
    (name) => !name.includes('..') && !name.includes('/') && !name.includes('\\') && !name.includes('\0'),
    'File name must not contain path traversal sequences or null bytes'
  )
  .refine(
    (name) => {
      const parts = name.split('.');
      if (parts.length < 2) return false;
      const ext = parts.pop()?.toLowerCase();
      return ['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(ext || '');
    },
    'File extension must be one of: pdf, jpg, jpeg, png, webp'
  );

const allowedMimeType = z.enum([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/webp'
]);

const safeFileSize = z.number().int().positive().max(10 * 1024 * 1024, 'File size must not exceed 10MB (10,485,760 bytes)');

export const uploadPODSchema = z.object({
  body: z.object({
    trip_id: z.string().uuid(),
    courier_docket_number: z.string().optional(),
    file_name: safeFileName.optional(),
    mime_type: allowedMimeType.optional(),
    file_size_bytes: safeFileSize.optional()
  })
});

export const uploadOwnFleetDocSchema = z.object({
  body: z.object({
    vehicle_id: z.string().uuid(),
    document_type: z.string().min(1),
    expiry_date: z.string().optional().nullable(),
    file_name: safeFileName.optional(),
    mime_type: allowedMimeType.optional(),
    file_size_bytes: safeFileSize.optional()
  })
});

export const uploadPaymentDocSchema = z.object({
  body: z.object({
    payment_id: z.string().uuid(),
    document_type: z.string().min(1).default('PAYMENT_RECEIPT'),
    file_name: safeFileName.optional(),
    mime_type: allowedMimeType.optional(),
    file_size_bytes: safeFileSize.optional()
  })
});


export const uploadDocumentSchema = z.object({
  body: z.object({
    entity_type: z.enum(['TRIP', 'OWN_FLEET_VEHICLE', 'PAYMENT', 'BILL', 'PARTY', 'VEHICLE_OWNER', 'MARKET_VEHICLE']),
    entity_id: z.string().uuid(),
    document_type: z.string().min(1),
    expiry_date: z.string().optional().nullable(),
    file_name: safeFileName.optional(),
    mime_type: allowedMimeType.optional(),
    file_size_bytes: safeFileSize.optional()
  })
});

export const replaceDocumentSchema = z.object({
  body: z.object({
    document_type: z.string().min(1).optional(),
    expiry_date: z.string().optional().nullable(),
    reason: z.string().min(3).optional(),
    file_name: safeFileName.optional(),
    mime_type: allowedMimeType.optional(),
    file_size_bytes: safeFileSize.optional()
  })
});

export const deleteDocumentSchema = z.object({
  body: z.object({
    reason: z.string().min(3).optional()
  }).optional()
});

export const listDocumentsQuerySchema = z.object({
  query: z.object({
    entity_type: z.string().optional(),
    entity_id: z.string().optional(),
    trip_id: z.string().optional(),
    document_type: z.string().optional(),
    expiry_status: z.enum(['ALL', 'EXPIRED', 'EXPIRING_SOON', 'ACTIVE']).optional(),
    search: z.string().optional(),
    q: z.string().optional()
  }).optional()
});
