import {
  formatOrderNo,
  nextOrderNo,
  parseOrderNoSerial,
  taipeiDateStamp,
  taipeiDayRange,
} from './order-number';

describe('order number', () => {
  it('formats ORD-YYYYMMDD-NNN with a 3-digit serial', () => {
    expect(formatOrderNo('20260915', 1)).toBe('ORD-20260915-001');
    expect(formatOrderNo('20260915', 12)).toBe('ORD-20260915-012');
  });

  it('increments the same-day serial and starts a new date at 001', () => {
    expect(nextOrderNo('20260915', [])).toBe('ORD-20260915-001');
    expect(
      nextOrderNo('20260915', ['ORD-20260915-001', 'ORD-20260915-002']),
    ).toBe('ORD-20260915-003');
    expect(nextOrderNo('20260916', ['ORD-20260915-003'])).toBe(
      'ORD-20260916-001',
    );
  });

  it('parses the serial from an order number', () => {
    expect(parseOrderNoSerial('ORD-20260915-007')).toBe(7);
  });

  it('uses the Asia/Taipei calendar date', () => {
    const stamp = taipeiDateStamp(new Date('2026-09-15T16:00:00Z'));
    expect(stamp).toBe('20260916');
  });

  it('maps a Taipei calendar day to a UTC half-open range', () => {
    const range = taipeiDayRange('2026-09-15');
    expect(range?.start.toISOString()).toBe('2026-09-14T16:00:00.000Z');
    expect(range?.endExclusive.toISOString()).toBe('2026-09-15T16:00:00.000Z');
    expect(taipeiDayRange('2026-13-01')).toBeNull();
  });
});
