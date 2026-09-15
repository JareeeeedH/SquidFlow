import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_BUCKET_KEY = 'rateLimitBucket';

export type RateLimitBucket = 'login' | 'accept' | 'publish' | 'cancel';

export const RateLimited = (bucket: RateLimitBucket) =>
  SetMetadata(RATE_LIMIT_BUCKET_KEY, bucket);
