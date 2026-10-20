import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

interface StoredObject {
  body: string | Uint8Array;
  contentType?: string;
}

const memoryObjects = new Map<string, StoredObject>();

class MemoryS3 {
  async putObject(bucket: string, key: string, body: string | Uint8Array, contentType?: string) {
    memoryObjects.set(`${bucket}/${key}`, { body, contentType });
  }

  async getPresignedUrl(bucket: string, key: string): Promise<string> {
    return `https://memory-s3.local/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`;
  }
}

class RealS3 {
  private client: S3Client;

  constructor(region?: string) {
    this.client = new S3Client({ region: region || process.env.AWS_REGION || "us-east-1" });
  }

  async putObject(bucket: string, key: string, body: string | Uint8Array, contentType?: string) {
    await this.client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType })
    );
  }

  async getPresignedUrl(bucket: string, key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: 3600 });
  }
}

export interface S3Adapter {
  putObject(bucket: string, key: string, body: string | Uint8Array, contentType?: string): Promise<void>;
  getPresignedUrl(bucket: string, key: string): Promise<string>;
}

let cached: S3Adapter | null = null;

export function getS3Adapter(): S3Adapter {
  if (!cached) {
    if (process.env.EXPORT_BUCKET) {
      cached = new RealS3();
    } else {
      cached = new MemoryS3();
    }
  }
  return cached;
}

export function resetMemoryS3() {
  memoryObjects.clear();
  cached = null;
}
