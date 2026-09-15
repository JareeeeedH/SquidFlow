import { DispatchMode, OrderStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  toDashboardBoardOrder,
  toDashboardSummary,
  toDetail,
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
    scheduledAt: new Date('2026-09-15T07:30:00.000Z'),
    vehicleType: '5人座',
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
    driver: null,
    ...overrides,
  };
}

describe('toDetail', () => {
  it('returns driver null when the order is unassigned', () => {
    expect(toDetail(orderRow()).driver).toBeNull();
    expect(toDetail(orderRow()).driver_id).toBeNull();
  });

  it('maps assigned driver vehicle fields without extra driver API data', () => {
    const detail = toDetail(
      orderRow({
        status: OrderStatus.ACCEPTED,
        driverId: 'driver-1',
        acceptedAt: new Date('2026-09-15T07:05:00.000Z'),
        driver: {
          vehicleType: '7人座',
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
      vehicle_type: '7人座',
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
      'vehicle_type',
    ]);
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

  it('maps only username for an assigned driver', () => {
    const item = toDashboardBoardOrder(
      orderRow({
        status: OrderStatus.ACCEPTED,
        driverId: 'driver-1',
        driver: {
          vehicleType: '7人座',
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
      scheduled_at: '2026-09-15T07:30:00.000Z',
      price: 1200,
      status: OrderStatus.ACCEPTED,
      driver: { username: 'driver01' },
    });
    expect(Object.keys(item.driver ?? {})).toEqual(['username']);
  });
});
