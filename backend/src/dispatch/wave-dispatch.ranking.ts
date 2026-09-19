export type RankableDriver = {
  userId: string;
  distanceMeters: number;
};

/**
 * Sort by ascending Haversine distance; equal distances shuffled randomly.
 */
export function rankDriversByDistance(
  drivers: RankableDriver[],
  random: () => number = Math.random,
): RankableDriver[] {
  const withTieBreak = drivers.map((driver) => ({
    ...driver,
    tieBreak: random(),
  }));
  withTieBreak.sort((left, right) => {
    if (left.distanceMeters !== right.distanceMeters) {
      return left.distanceMeters - right.distanceMeters;
    }
    return left.tieBreak - right.tieBreak;
  });
  return withTieBreak.map(({ userId, distanceMeters }) => ({
    userId,
    distanceMeters,
  }));
}
