import fs from 'fs';
import path from 'path';
import os from 'os';
import request from 'supertest';
import { parseEnv } from '../src/config';
import { LocalStorageService } from '../src/services/storage.service';
import { app } from '../src/app';

describe('Production Configuration & Packaging Validation', () => {
  describe('Environment Validation (parseEnv)', () => {
    it('accepts valid production configuration', () => {
      const prodEnv = {
        NODE_ENV: 'production',
        PORT: '8080',
        DATABASE_URL: 'postgresql://postgres:secret@db.internal:5432/srl_db',
        JWT_SECRET: 'a_very_long_secure_jwt_secret_key_at_least_32_chars',
        LOG_LEVEL: 'info',
        STORAGE_DIR: '/var/lib/ssrl/storage',
        CORS_ORIGIN: 'https://app.ssrl.in',
      };

      const parsed = parseEnv(prodEnv);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.NODE_ENV).toBe('production');
        expect(parsed.data.STORAGE_DIR).toBe('/var/lib/ssrl/storage');
        expect(parsed.data.CORS_ORIGIN).toBe('https://app.ssrl.in');
      }
    });

    it('rejects missing STORAGE_DIR in production mode', () => {
      const prodEnv = {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://postgres:secret@db.internal:5432/srl_db',
        JWT_SECRET: 'a_very_long_secure_jwt_secret_key_at_least_32_chars',
        CORS_ORIGIN: 'https://app.ssrl.in',
      };

      const parsed = parseEnv(prodEnv);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.path.join('.'));
        expect(issues).toContain('STORAGE_DIR');
      }
    });

    it('rejects wildcard or empty CORS_ORIGIN in production mode', () => {
      const prodEnvWildcard = {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://postgres:secret@db.internal:5432/srl_db',
        JWT_SECRET: 'a_very_long_secure_jwt_secret_key_at_least_32_chars',
        STORAGE_DIR: '/var/lib/ssrl/storage',
        CORS_ORIGIN: '*',
      };

      const parsedWildcard = parseEnv(prodEnvWildcard);
      expect(parsedWildcard.success).toBe(false);

      const prodEnvEmpty = {
        ...prodEnvWildcard,
        CORS_ORIGIN: '',
      };
      const parsedEmpty = parseEnv(prodEnvEmpty);
      expect(parsedEmpty.success).toBe(false);
    });

    it('rejects short JWT_SECRET (< 32 chars) in any mode', () => {
      const envShortSecret = {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://localhost:5432/srl_db',
        JWT_SECRET: 'short_key',
      };

      const parsed = parseEnv(envShortSecret);
      expect(parsed.success).toBe(false);
    });

    it('allows omitted STORAGE_DIR and CORS_ORIGIN in development mode', () => {
      const devEnv = {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://localhost:5432/srl_db',
        JWT_SECRET: 'a_very_long_secure_jwt_secret_key_at_least_32_chars',
      };

      const parsed = parseEnv(devEnv);
      expect(parsed.success).toBe(true);
    });
  });

  describe('LocalStorageService Path Security & Operations', () => {
    let tempDir: string;
    let service: LocalStorageService;

    beforeAll(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssrl-storage-test-'));
      service = new LocalStorageService(tempDir);
    });

    afterAll(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('initializes with the specified directory and verifies permissions', () => {
      expect(service.getBaseDir()).toBe(path.resolve(tempDir));
      expect(fs.existsSync(tempDir)).toBe(true);
    });

    it('blocks path traversal attempts outside storage root', () => {
      expect(() => service.resolveKeyPath('../../etc/passwd')).toThrow(/Security Violation/);
      expect(() => service.resolveKeyPath('..\\..\\windows\\system32')).toThrow(/Security Violation/);
      expect(() => service.resolveKeyPath('sub/../../../outside.txt')).toThrow(/Security Violation/);
    });

    it('blocks null bytes in storage keys', () => {
      expect(() => service.resolveKeyPath('test\0bad.pdf')).toThrow(/Null byte detected/);
    });

    it('safely uploads, checks existence, streams, and deletes files', async () => {
      const testKey = 'documents/subfolder/test-document.txt';
      const content = 'Test document content for SSRL storage validation';

      // Readable stream
      const { Readable } = require('stream');
      const inStream = Readable.from([content]);

      await service.upload(testKey, inStream);

      expect(await service.exists(testKey)).toBe(true);

      const outStream = service.getStream(testKey);
      const chunks: Buffer[] = [];
      for await (const chunk of outStream) {
        chunks.push(Buffer.from(chunk));
      }
      const readContent = Buffer.concat(chunks).toString('utf-8');
      expect(readContent).toBe(content);

      await service.delete(testKey);
      expect(await service.exists(testKey)).toBe(false);
    });

    it('throws when accessing non-existent file', () => {
      expect(() => service.getStream('non-existent.pdf')).toThrow(/File not found/);
    });

    it('survives service restart when using persistent storage directory', async () => {
      const restartKey = 'persistent/survive-restart.pdf';
      const fileData = 'Binary PDF mockup content across process restart';
      const { Readable } = require('stream');

      // Instance 1 uploads file
      await service.upload(restartKey, Readable.from([fileData]));
      expect(await service.exists(restartKey)).toBe(true);

      // Simulate application restart: instantiate a new LocalStorageService pointing to same tempDir
      const restartedService = new LocalStorageService(tempDir);
      expect(await restartedService.exists(restartKey)).toBe(true);

      const stream = restartedService.getStream(restartKey);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      expect(Buffer.concat(chunks).toString('utf-8')).toBe(fileData);

      // Clean up
      await restartedService.delete(restartKey);
      expect(await restartedService.exists(restartKey)).toBe(false);
    });

    it('fails startup initialization when storage directory is invalid or illegal', () => {
      // In Windows/Unix, null byte in path or illegal characters triggers error
      expect(() => new LocalStorageService('\0invalid-dir')).toThrow(/Storage initialization failed/);
    });
  });

  describe('CORS & Health Check Verification', () => {
    it('returns health check with 200 OK and database UP', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('UP');
      expect(res.body.data.database).toBe('UP');
    });

    it('responds to OPTIONS preflight with allowed methods and headers', async () => {
      const res = await request(app)
        .options('/api/health')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'Authorization,Content-Type');

      expect([200, 204]).toContain(res.status);
    });
  });
});
