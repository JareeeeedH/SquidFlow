export type GpsPoint = {
  latitude: number
  longitude: number
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string }

function parseFiniteNumber(
  raw: string,
  label: string,
  min: number,
  max: number,
): ParseResult<number> {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { ok: false, message: `請輸入${label}` }
  }
  const value = Number(trimmed)
  if (!Number.isFinite(value)) {
    return { ok: false, message: `${label}必須是有效數字` }
  }
  if (value < min || value > max) {
    return { ok: false, message: `${label}必須介於 ${min} ~ ${max}` }
  }
  return { ok: true, value }
}

/** Parse `latitude, longitude` while preserving decimal precision (no rounding). */
export function parseLatLngPair(raw: string): ParseResult<GpsPoint> {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { ok: false, message: '座標不可為空白' }
  }
  const parts = trimmed.split(',')
  if (parts.length !== 2) {
    return { ok: false, message: '座標格式須為 latitude, longitude' }
  }
  const latRaw = parts[0] ?? ''
  const lngRaw = parts[1] ?? ''
  const lat = parseFiniteNumber(latRaw, '緯度', -90, 90)
  if (!lat.ok) {
    return lat
  }
  const lng = parseFiniteNumber(lngRaw, '經度', -180, 180)
  if (!lng.ok) {
    return lng
  }
  return {
    ok: true,
    value: { latitude: lat.value, longitude: lng.value },
  }
}

/** Skip blank rows; reject if any non-blank row is invalid. */
export function collectValidGpsPoints(
  rows: string[],
): ParseResult<GpsPoint[]> {
  const points: GpsPoint[] = []
  for (let i = 0; i < rows.length; i += 1) {
    const raw = rows[i] ?? ''
    if (!raw.trim()) {
      continue
    }
    const parsed = parseLatLngPair(raw)
    if (!parsed.ok) {
      return { ok: false, message: `座標 ${i + 1}：${parsed.message}` }
    }
    points.push(parsed.value)
  }
  if (points.length === 0) {
    return { ok: false, message: '至少需要 1 個有效座標' }
  }
  return { ok: true, value: points }
}

export function parseDurationMinutes(raw: string): ParseResult<number> {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { ok: false, message: '請輸入發送時間（分鐘）' }
  }
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, message: '發送時間必須為正數' }
  }
  return { ok: true, value }
}

/** interval = totalMinutes / pointCount (ms). First point is sent immediately. */
export function computeSendIntervalMs(
  totalMinutes: number,
  pointCount: number,
): number {
  if (!(totalMinutes > 0) || !(pointCount > 0)) {
    return 0
  }
  return (totalMinutes * 60_000) / pointCount
}
