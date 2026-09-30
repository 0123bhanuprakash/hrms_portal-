import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly s3Client: S3Client;
  public readonly brandingBucket: string;

  constructor(private readonly config: ConfigService) {
    const endpoint =
      this.config.get<string>('storage.minio.endpoint') || 'localhost';
    const port = this.config.get<number>('storage.minio.port') || 9000;
    const useSsl =
      this.config.get<boolean>('storage.minio.useSsl') ?? false;
    const accessKey =
      this.config.get<string>('storage.minio.accessKey') || 'minioadmin';
    const secretKey =
      this.config.get<string>('storage.minio.secretKey') || 'minioadmin';

    this.brandingBucket =
      this.config.get<string>('storage.minio.bucket') || 'hrms-branding';

    const protocol = useSsl ? 'https' : 'http';
    const endpointUrl = `${protocol}://${endpoint}:${port}`;

    this.s3Client = new S3Client({
      endpoint: endpointUrl,
      region: 'us-east-1', // MinIO requires a region string
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true, // Required for MinIO path-style bucket access
    });
  }

  async onModuleInit() {
    try {
      await this.ensureBucketExists(this.brandingBucket);
      this.logger.log(`📦 MinIO Storage initialized (Bucket: '${this.brandingBucket}')`);
    } catch (err) {
      this.logger.warn(
        `Could not initialize MinIO bucket '${this.brandingBucket}': ${(err as Error).message}. File uploads will retry on invocation.`,
      );
    }
  }

  /**
   * Ensure bucket exists on S3 / MinIO
   */
  async ensureBucketExists(bucketName: string) {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    } catch {
      this.logger.log(`Bucket '${bucketName}' not found. Creating...`);
      await this.s3Client.send(
        new CreateBucketCommand({ Bucket: bucketName }),
      );
      this.logger.log(`Created bucket '${bucketName}' successfully.`);
    }
  }

  /**
   * Upload buffer file to MinIO
   */
  async uploadFile(
    bucketName: string,
    key: string,
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    await this.ensureBucketExists(bucketName);

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
      }),
    );

    // Return signed URL with 7 days expiry (604,800 seconds)
    return this.getSignedUrl(bucketName, key, 604800);
  }

  /**
   * Generate signed URL for object download
   */
  async getSignedUrl(
    bucketName: string,
    key: string,
    expiresInSeconds: number = 604800,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
  }

  /**
   * Delete object from MinIO
   */
  async deleteFile(bucketName: string, key: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key,
        }),
      );
    } catch (err) {
      this.logger.warn(
        `Failed to delete file '${key}' from bucket '${bucketName}': ${(err as Error).message}`,
      );
    }
  }
}
