import { OrderStatus, Prisma } from '@prisma/client';
import { AppErrors } from '../common/errors/app.error';
import { taipeiDayRange } from './order-number';

export type OrderInput = {
  customerName: string | null;
  pickupLocation: string;
  destination: string | null;
  price: Prisma.Decimal | null;
  note: string | null;
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

function optionalString(
  data: Record<string, unknown>,
  field: string,
): string | null {
  const value = data[field];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw AppErrors.validation(`${field} 格式不正確`);
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
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

function parsePrice(value: unknown): Prisma.Decimal {
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

function optionalPrice(value: unknown): Prisma.Decimal | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return parsePrice(value);
}

export function parseOrderBody(body: unknown): OrderInput {
  const data = asRecord(body);
  return {
    customerName: optionalString(data, 'customer_name'),
    pickupLocation: requireString(data, 'pickup_location'),
    destination: optionalString(data, 'destination'),
    price: optionalPrice(data.price),
    note: optionalNote(data.note),
  };
}

export type OrderListQuery = {
  status?: OrderStatus;
  createdAt?: {
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
    result.createdAt = range;
  }

  result.search = optionalQueryString(data.search);
  return result;
}

export type DriverMyOrdersQuery = {
  status?: OrderStatus;
};

export function parseDriverMyOrdersQuery(query: unknown): DriverMyOrdersQuery {
  const data =
    query !== null && typeof query === 'object' && !Array.isArray(query)
      ? (query as Record<string, unknown>)
      : {};

  const result: DriverMyOrdersQuery = {};
  const status = optionalQueryString(data.status);
  if (status !== undefined) {
    if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
      throw AppErrors.validation('status 格式不正確');
    }
    result.status = status as OrderStatus;
  }
  return result;
}

export type CompleteOrderInput = {
  finalFare: number;
};

/**
 * Phase 3 Complete: Driver-confirmed final fare (integer NT$, >= 0).
 */
export function parseCompleteBody(body: unknown): CompleteOrderInput {
  const data = asRecord(body);
  if (!Object.prototype.hasOwnProperty.call(data, 'final_fare')) {
    throw AppErrors.validation('final_fare 為必填');
  }
  const value = data.final_fare;
  if (value === null || value === undefined || value === '') {
    throw AppErrors.validation('final_fare 為必填');
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw AppErrors.validation('final_fare 格式不正確');
  }
  if (!Number.isInteger(value) || value < 0) {
    throw AppErrors.validation('final_fare 格式不正確');
  }
  return { finalFare: value };
}
