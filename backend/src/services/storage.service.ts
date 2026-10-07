import fs from 'fs';
import path from 'path';

export interface StorageService {
  upload(key: string, fileStream: NodeJS.ReadableStream): Promise<void>;
  getStream(key: string): NodeJS.ReadableStream;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export class LocalStorageService implements StorageService {
  private baseDir: string;

  constructor(baseDir: string = path.join(__dirname, '../../../storage/development')) {
    this.baseDir = baseDir;
    // Ensure base directory exists
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async upload(key: string, fileStream: NodeJS.ReadableStream): Promise<void> {
    const filePath = path.join(this.baseDir, key);
    const writeStream = fs.createWriteStream(filePath);
    return new Promise((resolve, reject) => {
      fileStream.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }

  getStream(key: string): NodeJS.ReadableStream {
    const filePath = path.join(this.baseDir, key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${key}`);
    }
    return fs.createReadStream(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.baseDir, key);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = path.join(this.baseDir, key);
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export const storageService: StorageService = new LocalStorageService();
