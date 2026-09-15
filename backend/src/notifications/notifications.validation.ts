import { AppErrors } from '../common/errors/app.error';

export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

function asRecord(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw AppErrors.validation();
  }
  return body as Record<string, unknown>;
}

function requireString(data: Record<string, unknown>, field: string): string {
  const value = data[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw AppErrors.validation(`${field} 為必填`);
  }
  return value.trim();
}

export function parsePushSubscriptionBody(
  body: unknown,
): PushSubscriptionInput {
  const data = asRecord(body);
  return {
    endpoint: requireString(data, 'endpoint'),
    p256dh: requireString(data, 'p256dh'),
    auth: requireString(data, 'auth'),
  };
}

export function parseDeletePushSubscriptionBody(body: unknown): {
  endpoint: string;
} {
  const data = asRecord(body);
  return {
    endpoint: requireString(data, 'endpoint'),
  };
}
