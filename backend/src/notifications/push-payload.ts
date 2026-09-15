import { Prisma } from '@prisma/client';

export type PushOrderPayloadInput = {
  id: string;
  pickupLocation: string;
  destination: string | null;
  price: Prisma.Decimal | string | number | null;
};

export type PushPayload = {
  title: string;
  body: string;
  order_id: string;
};

export function formatTaipeiTime(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value);
}

export function formatPushPrice(
  price: Prisma.Decimal | string | number,
): string {
  const value = Number(price);
  const fractionDigits = Number.isInteger(value) ? 0 : 2;
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPushPayload(order: PushOrderPayloadInput): PushPayload {
  const route = order.destination
    ? `${order.pickupLocation} → ${order.destination}`
    : order.pickupLocation;
  const lines = [route];
  if (order.price != null && order.price !== '') {
    lines.push(formatPushPrice(order.price));
  }
  return {
    title: '🚕 新派車單',
    body: lines.join('\n'),
    order_id: order.id,
  };
}
