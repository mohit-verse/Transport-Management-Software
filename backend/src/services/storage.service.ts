import fs from 'fs';
import path from 'path';
import { config } from '../config';

export interface StorageService {
  upload(key: string, fileStream: NodeJS.ReadableStream): Promise<void>;
  getStream(key: string): NodeJS.ReadableStream;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getBaseDir(): string;
}

export class LocalStorageService implements StorageService {
  private baseDir: string;

  constructor(baseDir: string = config.storage.dir) {
    this.baseDir = path.resolve(baseDir);
    this.initStorage();
  }

  private initStorage(): void {
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }
      fs.accessSync(this.baseDir, fs.constants.R_OK | fs.constants.W_OK);
    } catch (err: any) {
      throw new Error(`Storage initialization failed for directory "${this.baseDir}": ${err.message}`);
    }
  }

  public resolveKeyPath(key: string): string {
    if (!key || typeof key !== 'string') {
      throw new Error('Invalid storage key provided');
    }
    if (key.includes('\0')) {
      throw new Error('Security Violation: Null byte detected in storage key');
    }

    // Resolve relative key against baseDir
    const resolvedPath = path.resolve(this.baseDir, key);
    const normalizedBase = path.resolve(this.baseDir);

    // Verify resolved path is strictly within baseDir
    if (!resolvedPath.startsWith(normalizedBase + path.sep) && resolvedPath !== normalizedBase) {
      throw new Error(`Security Violation: Path traversal attempt detected for key: ${key}`);
    }

    return resolvedPath;
  }

  getBaseDir(): string {
    return this.baseDir;
  }

  async upload(key: string, fileStream: NodeJS.ReadableStream): Promise<void> {
    const filePath = this.resolveKeyPath(key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const writeStream = fs.createWriteStream(filePath);
    return new Promise((resolve, reject) => {
      fileStream.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }

  getStream(key: string): NodeJS.ReadableStream {
    const filePath = this.resolveKeyPath(key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${key}`);
    }
    return fs.createReadStream(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolveKeyPath(key);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.resolveKeyPath(key);
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export const storageService: StorageService = new LocalStorageService();
