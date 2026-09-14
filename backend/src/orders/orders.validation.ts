import { OrderStatus, Prisma } from '@prisma/client';
import { AppErrors } from '../common/errors/app.error';
import { taipeiDayRange } from './order-number';

export type OrderInput = {
  customerName: string;
  pickupLocation: string;
  destination: string;
  scheduledAt: Date;
  vehicleType: string;
  price: Prisma.Decimal;
  note: string | null;
};

const ISO_WITH_TIMEZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

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

function optionalNote(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw AppErrors.validation('note 格式不正確');
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function requireScheduledAt(value: unknown): Date {
  if (typeof value !== 'string' || !ISO_WITH_TIMEZONE.test(value)) {
    throw AppErrors.validation('scheduled_at 必須為含時區的 ISO 8601');
  }
  const scheduledAt = new Date(value);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw AppErrors.validation('scheduled_at 必須為含時區的 ISO 8601');
  }
  return scheduledAt;
}

function requirePrice(value: unknown): Prisma.Decimal {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw AppErrors.validation('price 格式不正確');
    }
    const decimal = new Prisma.Decimal(value.toString());
    if (decimal.decimalPlaces() > 2) {
      throw AppErrors.validation('price 格式不正確');
    }
    return decimal;
  }

  if (typeof value === 'string' && /^-?\d+(\.\d{1,2})?$/.test(value)) {
    return new Prisma.Decimal(value);
  }

  throw AppErrors.validation('price 格式不正確');
}

export function parseOrderBody(body: unknown): OrderInput {
  const data = asRecord(body);
  return {
    customerName: requireString(data, 'customer_name'),
    pickupLocation: requireString(data, 'pickup_location'),
    destination: requireString(data, 'destination'),
    scheduledAt: requireScheduledAt(data.scheduled_at),
    vehicleType: requireString(data, 'vehicle_type'),
    price: requirePrice(data.price),
    note: optionalNote(data.note),
  };
}

export type OrderListQuery = {
  status?: OrderStatus;
  scheduledAt?: {
    start: Date;
    endExclusive: Date;
  };
  search?: string;
};

function optionalQueryString(value: unknown): string | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw AppErrors.validation();
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function parseOrderListQuery(query: unknown): OrderListQuery {
  const data =
    query !== null && typeof query === 'object' && !Array.isArray(query)
      ? (query as Record<string, unknown>)
      : {};

  const result: OrderListQuery = {};
  const status = optionalQueryString(data.status);
  if (status !== undefined) {
    if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
      throw AppErrors.validation('status 格式不正確');
    }
    result.status = status as OrderStatus;
  }

  const date = optionalQueryString(data.date);
  if (date !== undefined) {
    const range = taipeiDayRange(date);
    if (!range) {
      throw AppErrors.validation('date 格式不正確');
    }
    result.scheduledAt = range;
  }

  result.search = optionalQueryString(data.search);
  return result;
}
