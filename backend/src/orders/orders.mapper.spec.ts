import { DispatchMode, OrderStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  toDashboardBoardOrder,
  toDashboardSummary,
  toDetail,
  toDriverMyOrder,
  toDriverOrderDetail,
  type OrderWithAssignedDriver,
} from './orders.mapper';

function orderRow(
  overrides: Partial<OrderWithAssignedDriver> = {},
): OrderWithAssignedDriver {
  return {
    id: 'order-1',
    orderNo: 'ORD-20260915-001',
    customerName: '王先生',
    pickupLocation: '左營高鐵站',
    destination: '高雄小港機場',
    price: new Prisma.Decimal('1200.00'),
    note: '2件行李',
    status: OrderStatus.DRAFT,
    dispatchMode: DispatchMode.OPEN,
    driverId: null,
    createdBy: 'admin-1',
    acceptedAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: new Date('2026-09-15T07:00:00.000Z'),
    updatedAt: new Date('2026-09-15T07:00:00.000Z'),
    tripDistanceMeters: null,
    tripLastLatitude: null,
    tripLastLongitude: null,
    driver: null,
    ...overrides,
  };
}

describe('toDetail', () => {
  it('returns driver null when the order is unassigned', () => {
    expect(toDetail(orderRow()).driver).toBeNull();
    expect(toDetail(orderRow()).driver_id).toBeNull();
    expect(toDetail(orderRow()).pickup_latitude).toBeNull();
    expect(toDetail(orderRow()).pickup_longitude).toBeNull();
  });

  it('includes ephemeral pickup coordinates when provided', () => {
    const detail = toDetail(orderRow(), {
      pickup_latitude: 22.687,
      pickup_longitude: 120.307,
    });
    expect(detail.pickup_latitude).toBe(22.687);
    expect(detail.pickup_longitude).toBe(120.307);
  });

  it('maps assigned driver vehicle fields without extra driver API data', () => {
    const detail = toDetail(
      orderRow({
        status: OrderStatus.ACCEPTED,
        driverId: 'driver-1',
        acceptedAt: new Date('2026-09-15T07:05:00.000Z'),
        driver: {
          licensePlate: 'ABC-1234',
          vehicleBrand: 'Toyota',
          vehicleModel: 'Sienta',
          vehicleColor: '白色',
          user: { username: 'driver01' },
        },
      }),
    );

    expect(detail.driver_id).toBe('driver-1');
    expect(detail.driver).toEqual({
      username: 'driver01',
      license_plate: 'ABC-1234',
      vehicle_brand: 'Toyota',
      vehicle_model: 'Sienta',
      vehicle_color: '白色',
    });
    expect(Object.keys(detail.driver ?? {}).sort()).toEqual([
      'license_plate',
      'username',
      'vehicle_brand',
      'vehicle_color',
      'vehicle_model',
    ]);
    expect(detail.driver).not.toHaveProperty('vehicle_type');
    expect(detail.driver).not.toHaveProperty('vehicle_year');
  });
});

describe('toDashboardSummary', () => {
  it('fills all six statuses and defaults missing counts to zero', () => {
    expect(
      toDashboardSummary([
        { status: OrderStatus.OPEN, count: 4 },
        { status: OrderStatus.ACCEPTED, count: 3 },
      ]),
    ).toEqual({
      DRAFT: 0,
      OPEN: 4,
      ACCEPTED: 3,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    });
  });
});

describe('toDashboardBoardOrder', () => {
  it('returns driver null when the order is unassigned', () => {
    expect(toDashboardBoardOrder(orderRow()).driver).toBeNull();
  });

  it('maps optional order fields as null without scheduled_at or vehicle_type', () => {
    const item = toDashboardBoardOrder(
      orderRow({
        customerName: null,
        destination: null,
        price: null,
      }),
    );

    expect(item.customer_name).toBeNull();
    expect(item.destination).toBeNull();
    expect(item.price).toBeNull();
    expect(item).not.toHaveProperty('scheduled_at');
    expect(item).not.toHaveProperty('vehicle_type');
  });

  it('maps only username for an assigned driver', () => {
    const item = toDashboardBoardOrder(
      orderRow({
        status: OrderStatus.ACCEPTED,
        driverId: 'driver-1',
        driver: {
          licensePlate: 'ABC-1234',
          vehicleBrand: 'Toyota',
          vehicleModel: 'Sienta',
          vehicleColor: '白色',
          user: { username: 'driver01' },
        },
      }),
    );

    expect(item).toEqual({
      id: 'order-1',
      order_no: 'ORD-20260915-001',
      customer_name: '王先生',
      pickup_location: '左營高鐵站',
      destination: '高雄小港機場',
      created_at: '2026-09-15T07:00:00.000Z',
      price: 1200,
      status: OrderStatus.ACCEPTED,
      driver: { username: 'driver01' },
    });
    expect(Object.keys(item.driver ?? {})).toEqual(['username']);
  });
});

describe('toDriverMyOrder', () => {
  it('exposes trip_distance_meters for IN_PROGRESS without replacing distance_meters', () => {
    const mapped = toDriverMyOrder(
      {
        id: 'order-1',
        orderNo: 'ORD-20260915-001',
        createdAt: new Date('2026-09-15T07:00:00.000Z'),
        pickupLocation: '左營高鐵站',
        destination: '高雄小港機場',
        price: new Prisma.Decimal('100.00'),
        status: OrderStatus.IN_PROGRESS,
        tripDistanceMeters: 3800,
      },
      1200,
    );

    expect(mapped.trip_distance_meters).toBe(3800);
    expect(mapped.distance_meters).toBe(1200);
    expect(mapped.status).toBe(OrderStatus.IN_PROGRESS);
  });

  it('exposes trip_distance_meters for COMPLETED and keeps null when unset', () => {
    const withTrip = toDriverMyOrder({
      id: 'order-2',
      orderNo: 'ORD-20260915-002',
      createdAt: new Date('2026-09-15T07:00:00.000Z'),
      pickupLocation: '左營高鐵站',
      destination: null,
      price: new Prisma.Decimal('275.00'),
      status: OrderStatus.COMPLETED,
      tripDistanceMeters: 8400,
    });
    expect(withTrip.trip_distance_meters).toBe(8400);
    expect(withTrip.distance_meters).toBeNull();
    expect(withTrip.price).toBe(275);

    const withoutTrip = toDriverMyOrder({
      id: 'order-3',
      orderNo: 'ORD-20260915-003',
      createdAt: new Date('2026-09-15T07:00:00.000Z'),
      pickupLocation: '左營高鐵站',
      destination: null,
      price: null,
      status: OrderStatus.ACCEPTED,
      tripDistanceMeters: null,
    });
    expect(withoutTrip.trip_distance_meters).toBeNull();
  });
});

describe('toDriverOrderDetail', () => {
  it('exposes trip_distance_meters for IN_PROGRESS and COMPLETED', () => {
    const inProgress = toDriverOrderDetail({
      id: 'order-1',
      orderNo: 'ORD-20260915-001',
      customerName: '王先生',
      pickupLocation: '左營高鐵站',
      destination: '高雄小港機場',
      createdAt: new Date('2026-09-15T07:00:00.000Z'),
      price: new Prisma.Decimal('100.00'),
      note: null,
      status: OrderStatus.IN_PROGRESS,
      tripDistanceMeters: 3800,
    });
    expect(inProgress.trip_distance_meters).toBe(3800);

    const completed = toDriverOrderDetail({
      id: 'order-2',
      orderNo: 'ORD-20260915-002',
      customerName: null,
      pickupLocation: '左營高鐵站',
      destination: null,
      createdAt: new Date('2026-09-15T07:00:00.000Z'),
      price: new Prisma.Decimal('275.00'),
      note: null,
      status: OrderStatus.COMPLETED,
      tripDistanceMeters: 8400,
    });
    expect(completed.trip_distance_meters).toBe(8400);
    expect(completed.price).toBe(275);
  });
});
