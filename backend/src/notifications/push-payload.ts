import { Prisma } from '@prisma/client';

export type PushOrderPayloadInput = {
  id: string;
  scheduledAt: Date;
  pickupLocation: string;
  destination: string;
  vehicleType: string;
  price: Prisma.Decimal | string | number;
};

export type PushPayload = {
  title: string;
  body: string;
  order_id: string;
};

export function formatTaipeiTime(scheduledAt: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(scheduledAt);
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
  const time = formatTaipeiTime(order.scheduledAt);
  const price = formatPushPrice(order.price);
  return {
    title: '🚕 新派車單',
    body: `${time}\n${order.pickupLocation} → ${order.destination}\n${order.vehicleType} / ${price}`,
    order_id: order.id,
  };
}
