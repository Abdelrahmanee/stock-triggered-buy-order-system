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

  get snsTopicArn(): string {
    return this.getOptionalString('SNS_TOPIC_ARN');
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
        'SNS AWS credentials are not configured. Set SNS_AWS_ACCESS_KEY_ID and SNS_AWS_SECRET_ACCESS_KEY.',
      );
    }

    if (accessKeyId.startsWith('ASIA') && !sessionToken) {
      throw new Error(
        'SNS_AWS_SESSION_TOKEN is required when using temporary AWS credentials.',
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

  private getOptionalString(key: string): string {
    const value = this.configService.get<string>(key) ?? process.env[key];
    return value?.trim() ?? '';
  }
}
