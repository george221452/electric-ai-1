import * as Minio from 'minio';
import { Readable } from 'stream';

export interface IFileStorage {
  upload(key: string, buffer: Buffer, metadata?: Record<string, string>): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getPresignedUrl(key: string, expirySeconds?: number): Promise<string>;
  getPublicUrl(key: string): string;
}

export class MinioStorage implements IFileStorage {
  private client: Minio.Client;
  private bucket: string;
  private publicUrl: string;

  constructor(
    endpoint: string = process.env.MINIO_ENDPOINT || 'localhost:9000',
    accessKey: string = process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: string = process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucket: string = process.env.MINIO_BUCKET || 'documents',
    useSSL: boolean = false
  ) {
    this.client = new Minio.Client({
      endPoint: endpoint.split(':')[0],
      port: parseInt(endpoint.split(':')[1]) || 9000,
      useSSL,
      accessKey,
      secretKey,
    });
    this.bucket = bucket;
    this.publicUrl = process.env.MINIO_PUBLIC_URL || `http://${endpoint}/${bucket}`;
  }

  async upload(key: string, buffer: Buffer, metadata?: Record<string, string>): Promise<string> {
    // Ensure bucket exists
    const bucketExists = await this.client.bucketExists(this.bucket);
    if (!bucketExists) {
      await this.client.makeBucket(this.bucket);
    }

    const meta: Minio.ItemBucketMetadata = metadata || {};
    
    await this.client.putObject(
      this.bucket,
      key,
      buffer,
      buffer.length,
      meta
    );

    return key;
  }

  async download(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, key);
    return this.streamToBuffer(stream);
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, key);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getPresignedUrl(key: string, expirySeconds: number = 3600): Promise<string> {
    return await this.client.presignedGetObject(
      this.bucket,
      key,
      expirySeconds
    );
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }

  private streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}

// Local filesystem adapter pentru development
export class LocalStorage implements IFileStorage {
  private basePath: string;

  constructor(basePath: string = './uploads') {
    this.basePath = basePath;
  }

  async upload(key: string, buffer: Buffer, metadata?: Record<string, string>): Promise<string> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const fullPath = path.join(this.basePath, key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
    
    if (metadata) {
      await fs.writeFile(
        `${fullPath}.meta.json`,
        JSON.stringify(metadata)
      );
    }
    
    return key;
  }

  async download(key: string): Promise<Buffer> {
    const fs = await import('fs/promises');
    const path = await import('path');
    return fs.readFile(path.join(this.basePath, key));
  }

  async delete(key: string): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    await fs.unlink(path.join(this.basePath, key));
  }

  async exists(key: string): Promise<boolean> {
    const fs = await import('fs/promises');
    const path = await import('path');
    try {
      await fs.access(path.join(this.basePath, key));
      return true;
    } catch {
      return false;
    }
  }

  async getPresignedUrl(key: string): Promise<string> {
    return this.getPublicUrl(key);
  }

  getPublicUrl(key: string): string {
    return `/uploads/${key}`;
  }
}
