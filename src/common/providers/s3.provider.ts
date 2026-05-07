import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class S3Provider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: AppConfigService) {
    this.bucket = config.s3Bucket;
    this.client = new S3Client({
      region: config.s3Region,
      credentials: config.s3Credentials,
    });
  }

  async uploadFile(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
    return `https://${this.bucket}.s3.${this.config.s3Region}.amazonaws.com/${key}`;
  }

  async deleteFile(url: string): Promise<void> {
    const key = new URL(url).pathname.slice(1);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
