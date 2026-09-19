import { calculateTripFare } from './trip-fare';

describe('calculateTripFare', () => {
  it('charges base fare for zero distance', () => {
    expect(calculateTripFare(0)).toBe(100);
  });

  it('charges base fare at and below the base distance', () => {
    expect(calculateTripFare(1249)).toBe(100);
    expect(calculateTripFare(1250)).toBe(100);
  });

  /** PHASE-3-SPEC.md §8.2 */
  it.each([
    { km: 1.25, meters: 1250, price: 100 },
    { km: 1.26, meters: 1260, price: 100 },
    { km: 1.44, meters: 1440, price: 100 },
    { km: 1.45, meters: 1450, price: 105 },
    { km: 1.64, meters: 1640, price: 105 },
    { km: 1.65, meters: 1650, price: 110 },
    { km: 1.85, meters: 1850, price: 115 },
    { km: 2.05, meters: 2050, price: 120 },
  ])('matches Spec §8.2: $km km → NT$ $price', ({ meters, price }) => {
    expect(calculateTripFare(meters)).toBe(price);
  });

  it('adds one increment only after a full 200m over base', () => {
    expect(calculateTripFare(1250 + 199)).toBe(100);
    expect(calculateTripFare(1250 + 200)).toBe(105);
  });
});
