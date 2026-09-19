import { haversineMeters } from '../distance/haversine';
import { segmentDistanceMeters } from './segment-distance';

describe('segmentDistanceMeters', () => {
  it('returns 0 for identical coordinates', () => {
    expect(segmentDistanceMeters(25.0, 121.5, 25.0, 121.5)).toBe(0);
  });

  it('computes a known short north-south segment within tolerance', () => {
    const meters = segmentDistanceMeters(25.0, 121.5, 25.01, 121.5);
    expect(meters).toBeGreaterThan(1000);
    expect(meters).toBeLessThan(1200);
  });

  it('is symmetric for a segment', () => {
    const a = segmentDistanceMeters(22.687, 120.307, 22.7, 120.32);
    const b = segmentDistanceMeters(22.7, 120.32, 22.687, 120.307);
    expect(a).toBeCloseTo(b, 6);
  });

  it('matches the shared haversineMeters implementation', () => {
    const lat1 = 22.687;
    const lng1 = 120.307;
    const lat2 = 22.7;
    const lng2 = 120.32;
    expect(segmentDistanceMeters(lat1, lng1, lat2, lng2)).toBe(
      haversineMeters(lat1, lng1, lat2, lng2),
    );
  });
});
