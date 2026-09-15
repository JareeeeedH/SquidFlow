import { Prisma } from '@prisma/client';
import { formatPushPayload, formatTaipeiTime } from './push-payload';

describe('push payload', () => {
  it('formats the UI-UX title, Taipei time, route, vehicle, and price', () => {
    expect(
      formatPushPayload({
        id: 'order-1',
        scheduledAt: new Date('2026-09-15T15:30:00+08:00'),
        pickupLocation: '左營高鐵站',
        destination: '小港機場',
        vehicleType: '5人座',
        price: new Prisma.Decimal('1200.00'),
      }),
    ).toEqual({
      title: '🚕 新派車單',
      body: '15:30\n左營高鐵站 → 小港機場\n5人座 / $1,200',
      order_id: 'order-1',
    });
  });

  it('formats Taipei time across UTC midnight', () => {
    expect(formatTaipeiTime(new Date('2026-09-15T16:30:00Z'))).toBe('00:30');
  });
});
