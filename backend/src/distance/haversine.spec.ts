import { haversineMeters } from './haversine';

describe('haversineMeters', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineMeters(25.0, 121.5, 25.0, 121.5)).toBe(0);
  });

  it('computes a known short distance within tolerance', () => {
    // Roughly 1 degree latitude ≈ 111.2 km near equator; use Taipei-ish points.
    const meters = haversineMeters(25.0, 121.5, 25.01, 121.5);
    expect(meters).toBeGreaterThan(1000);
    expect(meters).toBeLessThan(1200);
  });

  it('is symmetric', () => {
    const a = haversineMeters(22.687, 120.307, 22.7, 120.32);
    const b = haversineMeters(22.7, 120.32, 22.687, 120.307);
    expect(a).toBeCloseTo(b, 6);
  });
});
