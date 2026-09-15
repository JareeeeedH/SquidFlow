import { Prisma } from '@prisma/client';
import { formatPushPayload, formatTaipeiTime } from './push-payload';

describe('push payload', () => {
  it('formats the route and price without time or vehicle type', () => {
    expect(
      formatPushPayload({
        id: 'order-1',
        pickupLocation: '左營高鐵站',
        destination: '小港機場',
        price: new Prisma.Decimal('1200.00'),
      }),
    ).toEqual({
      title: '🚕 新派車單',
      body: '左營高鐵站 → 小港機場\n$1,200',
      order_id: 'order-1',
    });
  });

  it('omits destination arrow when destination is missing', () => {
    expect(
      formatPushPayload({
        id: 'order-1',
        pickupLocation: '左營高鐵站',
        destination: null,
        price: new Prisma.Decimal('1200.00'),
      }).body,
    ).toBe('左營高鐵站\n$1,200');
  });

  it('omits price when it is missing', () => {
    expect(
      formatPushPayload({
        id: 'order-1',
        pickupLocation: '左營高鐵站',
        destination: '小港機場',
        price: null,
      }).body,
    ).toBe('左營高鐵站 → 小港機場');
  });

  it('formats Taipei time across UTC midnight', () => {
    expect(formatTaipeiTime(new Date('2026-09-15T16:30:00Z'))).toBe('00:30');
  });
});
