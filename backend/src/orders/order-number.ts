const ORDER_NO_LOCK_NAMESPACE = 17;

export function taipeiDateStamp(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}${month}${day}`;
}

export function orderNoPrefix(dateStamp: string): string {
  return `ORD-${dateStamp}-`;
}

export function formatOrderNo(dateStamp: string, serial: number): string {
  return `${orderNoPrefix(dateStamp)}${String(serial).padStart(3, '0')}`;
}

export function parseOrderNoSerial(orderNo: string): number | null {
  const serial = Number(orderNo.split('-')[2]);
  return Number.isInteger(serial) ? serial : null;
}

export function nextOrderNo(dateStamp: string, existing: string[]): string {
  const prefix = orderNoPrefix(dateStamp);
  const serials = existing
    .filter((orderNo) => orderNo.startsWith(prefix))
    .map(parseOrderNoSerial)
    .filter((serial): serial is number => serial !== null);
  const next = (serials.length > 0 ? Math.max(...serials) : 0) + 1;
  return formatOrderNo(dateStamp, next);
}

export function orderNoLockKey(dateStamp: string): number {
  return Number(dateStamp);
}

export function taipeiDayRange(
  dateYmd: string,
): { start: Date; endExclusive: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
    return null;
  }

  const start = new Date(`${dateYmd}T00:00:00+08:00`);
  if (
    Number.isNaN(start.getTime()) ||
    taipeiDateStamp(start) !== dateYmd.replace(/-/g, '')
  ) {
    return null;
  }

  return {
    start,
    endExclusive: new Date(start.getTime() + 24 * 60 * 60 * 1000),
  };
}

export { ORDER_NO_LOCK_NAMESPACE };
