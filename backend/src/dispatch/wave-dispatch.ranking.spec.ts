import { rankDriversByDistance } from './wave-dispatch.ranking';

describe('rankDriversByDistance', () => {
  it('sorts by ascending distance', () => {
    const ranked = rankDriversByDistance(
      [
        { userId: 'far', distanceMeters: 300 },
        { userId: 'near', distanceMeters: 100 },
        { userId: 'mid', distanceMeters: 200 },
      ],
      () => 0.5,
    );
    expect(ranked.map((item) => item.userId)).toEqual(['near', 'mid', 'far']);
  });

  it('randomizes order when distances are equal', () => {
    const drivers = [
      { userId: 'a', distanceMeters: 100 },
      { userId: 'b', distanceMeters: 100 },
      { userId: 'c', distanceMeters: 100 },
    ];
    const ascending = [0.1, 0.5, 0.9];
    let ascendingIndex = 0;
    const first = rankDriversByDistance(
      drivers,
      () => ascending[ascendingIndex++] ?? 0,
    );

    const descending = [0.9, 0.5, 0.1];
    let descendingIndex = 0;
    const second = rankDriversByDistance(
      drivers,
      () => descending[descendingIndex++] ?? 0,
    );

    expect(first.map((item) => item.userId)).toEqual(['a', 'b', 'c']);
    expect(second.map((item) => item.userId)).toEqual(['c', 'b', 'a']);
  });
});
