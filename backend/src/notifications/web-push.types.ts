export type PushDeliveryTarget = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type WebPushSendResult = { ok: true } | { ok: false; invalid: boolean };

function statusCodeOf(error: unknown): number | undefined {
  if (error === null || typeof error !== 'object' || !('statusCode' in error)) {
    return undefined;
  }
  const statusCode = error.statusCode;
  return typeof statusCode === 'number' ? statusCode : undefined;
}

export function isInvalidPushSubscriptionError(error: unknown): boolean {
  const statusCode = statusCodeOf(error);
  return statusCode === 404 || statusCode === 410;
}
