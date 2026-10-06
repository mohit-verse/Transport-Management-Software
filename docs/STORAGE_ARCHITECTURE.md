# Document Storage Architecture

## 1. Storage Provider/Model
The application uses a provider-agnostic storage abstraction. 
- **Development**: Local filesystem storage (`/storage/development/`) for isolated testing.
- **Production**: A secure object storage provider (e.g., AWS S3, Google Cloud Storage, or secure private volumes).
The exact provider is configured via environment variables. The application code must never couple directly to a specific provider's SDK inside business logic.

## 2. Storage Abstraction
A centralized `StorageService` interface manages file interactions:
```typescript
interface StorageService {
  upload(fileStream: NodeJS.ReadableStream, key: string, mimeType: string): Promise<StorageResult>;
  getStream(key: string): Promise<NodeJS.ReadableStream>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
```

## 3. File Reference Model
The database securely references the stored object using the `documents` table.
Existing schema fields `storage_provider` (e.g., 'LOCAL', 'S3') and `storage_key` (e.g., `trips/123/pod_abc.pdf`) are explicitly sufficient. No internal filesystem paths or raw URLs are exposed to the frontend.

## 4. Upload Flow
1. API validates authenticated user and RBAC.
2. API validates file type (MIME) and size.
3. Binary is streamed to `StorageService.upload()`.
4. `documents` metadata is persisted transactionally.
5. `document_links` relationship is created transactionally.

## 5. Retrieval Flow (GET /api/documents/:id/file)
1. API validates authenticated user.
2. Checks RBAC for document access (via associated entity).
3. Looks up `storage_key` from the `documents` table.
4. Requests secure read stream from `StorageService.getStream(key)`.
5. Pipes the stream to the HTTP response with appropriate `Content-Type` and `Content-Disposition`.
*This prevents exposing storage credentials or internal paths.*

## 6. Authorization Flow
Authorization happens *before* the storage layer is invoked. The backend proves access by querying the `document_links` table, finding the parent entity (e.g., TRIP), and validating if the requesting user (OWNER/STAFF/CA) has read permissions for that specific entity.

## 7. Delete / Replace Flow
When a document is deleted/replaced (OWNER only):
1. `documents.is_deleted` is set to `true` (soft delete) to preserve audit history.
2. The physical file remains in storage or moves to a cold-storage/archival lifecycle depending on the exact business retention requirement. Hard-deletion of physical files is explicitly decoupled from the operational soft-delete.

## 8. Failure / Reconciliation Behavior
If database persistence fails after a successful storage upload, an asynchronous cleanup job or dead-letter queue should remove the orphaned file from storage. If storage upload fails, the database transaction is aborted.

## 9. Security Controls
- **Path Traversal**: `storage_key` is generated server-side (e.g. UUIDs), never from user input.
- **MIME Spoofing**: Validate magic bytes before upload, not just file extensions.
- **File Access**: Always proxied securely through the backend.

## 10. Database Impact
The existing `documents` schema is explicitly **SUFFICIENT**.
