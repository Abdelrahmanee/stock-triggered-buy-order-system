import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type AwsCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get jwtSecret(): string {
    return this.configService.get<string>('JWT_SECRET', 'super-secret');
  }

  get jwtExpiresIn(): string {
    return this.configService.get<string>('JWT_EXPIRES_IN', '1d');
  }

  get bcryptRounds(): number {
    return Number(this.configService.get<string>('BCRYPT_ROUNDS', '10'));
  }

  get queueDriver(): 'bullmq' | 'inline' {
    return this.configService.get<'bullmq' | 'inline'>(
      'QUEUE_DRIVER',
      'bullmq',
    );
  }

  get redisHost(): string {
    return this.configService.get<string>('REDIS_HOST', '127.0.0.1');
  }

  get analyticsPort(): number {
    return Number(this.configService.get<string>('ANALYTICS_PORT', '3001'));
  }

  get snsTopicArn(): string {
    return this.getOptionalString('SNS_TOPIC_ARN');
  }

  get snsEnabled(): boolean {
    return this.getOptionalString('SNS_ENABLED') === 'true';
  }

  getSnsTopicArnForStock(symbol: string): string {
    const normalizedSymbol = symbol.trim().toUpperCase();
    return (
      this.getOptionalString(`SNS_TOPIC_ARN_${normalizedSymbol}`) ||
      this.snsTopicArn
    );
  }

  get snsRegion(): string {
    return this.getOptionalString('SNS_REGION') || 'us-east-1';
  }

  get snsCredentials(): AwsCredentials {
    const accessKeyId = this.getOptionalString('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.getOptionalString('AWS_SECRET_ACCESS_KEY');
    const sessionToken = this.getOptionalString('AWS_SESSION_TOKEN');

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        'SNS AWS credentials are not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.',
      );
    }

    if (accessKeyId.startsWith('ASIA') && !sessionToken) {
      throw new Error(
        'AWS_SESSION_TOKEN is required when using temporary AWS credentials.',
      );
    }

    return {
      accessKeyId,
      secretAccessKey,
      ...(sessionToken ? { sessionToken } : {}),
    };
  }

  get analyticsEventsTopicArn(): string {
    return this.getOptionalString('ANALYTICS_EVENTS_TOPIC_ARN');
  }

  get analyticsEventsQueueUrl(): string {
    return this.getOptionalString('ANALYTICS_EVENTS_QUEUE_URL');
  }

  get analyticsConsumerEnabled(): boolean {
    return this.getOptionalString('ANALYTICS_CONSUMER_ENABLED') === 'true';
  }

  get sesEnabled(): boolean {
    return this.getOptionalString('SES_ENABLED') === 'true';
  }

  get analyticsAwsRegion(): string {
    return this.getOptionalString('ANALYTICS_AWS_REGION') || 'us-east-1';
  }

  get analyticsAwsCredentials(): AwsCredentials {
    const accessKeyId = this.getOptionalString('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.getOptionalString('AWS_SECRET_ACCESS_KEY');
    const sessionToken = this.getOptionalString('AWS_SESSION_TOKEN');

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        'Analytics AWS credentials are not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.',
      );
    }

    if (accessKeyId.startsWith('ASIA') && !sessionToken) {
      throw new Error(
        'AWS_SESSION_TOKEN is required when using temporary AWS credentials.',
      );
    }

    return {
      accessKeyId,
      secretAccessKey,
      ...(sessionToken ? { sessionToken } : {}),
    };
  }

  get redisPort(): number {
    return Number(this.configService.get<string>('REDIS_PORT', '6379'));
  }

  get redisPassword(): string | undefined {
    return this.configService.get<string>('REDIS_PASSWORD');
  }

  get stockProviderMode(): 'mock' | 'external' {
    return this.configService.get<'mock' | 'external'>(
      'STOCK_PROVIDER_MODE',
      'mock',
    );
  }

  get priceSyncPattern(): string {
    return this.configService.get<string>(
      'PRICE_SYNC_PATTERN',
      '*/30 * * * * *',
    );
  }

  get cognitoUserPoolId(): string {
    return this.configService.get<string>('COGNITO_USER_POOL_ID', '');
  }

  get cognitoClientId(): string {
    return this.configService.get<string>('COGNITO_CLIENT_ID', '');
  }

  get cognitoClientSecret(): string {
    return this.configService.get<string>('COGNITO_CLIENT_SECRET', '');
  }

  get cognitoRegion(): string {
    return this.configService.get<string>('COGNITO_REGION', 'us-east-1');
  }

  get s3Bucket(): string {
    return this.configService.get<string>('S3_BUCKET', '');
  }

  get s3Region(): string {
    return this.configService.get<string>('S3_REGION', 'us-east-1');
  }

  get s3Credentials(): AwsCredentials {
    const accessKeyId = this.getOptionalString('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.getOptionalString('AWS_SECRET_ACCESS_KEY');
    const sessionToken = this.getOptionalString('AWS_SESSION_TOKEN');
    if (!accessKeyId || !secretAccessKey) {
      throw new Error('S3 AWS credentials are not configured.');
    }
    return { accessKeyId, secretAccessKey, ...(sessionToken ? { sessionToken } : {}) };
  }

  private getOptionalString(key: string): string {
    const value = this.configService.get<string>(key) ?? process.env[key];
    return value?.trim() ?? '';
  }
}
