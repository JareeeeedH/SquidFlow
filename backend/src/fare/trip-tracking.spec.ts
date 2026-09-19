import { segmentDistanceMeters } from './segment-distance';
import {
  recordTripLocation,
  type TripCoordinates,
  type TripTrackingState,
} from './trip-tracking';

const pointA: TripCoordinates = {
  latitude: 22.6273,
  longitude: 120.3014,
};

const pointB: TripCoordinates = {
  latitude: 22.63,
  longitude: 120.305,
};

const pointC: TripCoordinates = {
  latitude: 22.635,
  longitude: 120.31,
};

describe('recordTripLocation', () => {
  it('sets the first GPS as last point without adding distance', () => {
    const state: TripTrackingState = {
      distanceMeters: 0,
      lastLatitude: null,
      lastLongitude: null,
    };

    const result = recordTripLocation(state, pointA);

    expect(result.distanceMeters).toBe(0);
    expect(result.lastLatitude).toBe(pointA.latitude);
    expect(result.lastLongitude).toBe(pointA.longitude);
  });

  it('does not invent artificial distance on the first GPS', () => {
    const result = recordTripLocation(
      { distanceMeters: 0, lastLatitude: null, lastLongitude: null },
      pointA,
    );

    expect(result.distanceMeters).toBe(0);
  });

  it('adds the A→B segment distance on the second GPS', () => {
    const afterA = recordTripLocation(
      { distanceMeters: 0, lastLatitude: null, lastLongitude: null },
      pointA,
    );

    const result = recordTripLocation(afterA, pointB);
    const expected = segmentDistanceMeters(
      pointA.latitude,
      pointA.longitude,
      pointB.latitude,
      pointB.longitude,
    );

    expect(result.distanceMeters).toBeCloseTo(expected, 6);
    expect(result.lastLatitude).toBe(pointB.latitude);
    expect(result.lastLongitude).toBe(pointB.longitude);
  });

  it('accumulates A→B + B→C and not A→C', () => {
    let state = recordTripLocation(
      { distanceMeters: 0, lastLatitude: null, lastLongitude: null },
      pointA,
    );
    state = recordTripLocation(state, pointB);
    state = recordTripLocation(state, pointC);

    const expected =
      segmentDistanceMeters(
        pointA.latitude,
        pointA.longitude,
        pointB.latitude,
        pointB.longitude,
      ) +
      segmentDistanceMeters(
        pointB.latitude,
        pointB.longitude,
        pointC.latitude,
        pointC.longitude,
      );

    expect(state.distanceMeters).toBeCloseTo(expected, 6);
    expect(state.distanceMeters).not.toBeCloseTo(
      segmentDistanceMeters(
        pointA.latitude,
        pointA.longitude,
        pointC.latitude,
        pointC.longitude,
      ),
      1,
    );
  });

  it('preserves a non-zero accumulated distance when adding a segment', () => {
    const state: TripTrackingState = {
      distanceMeters: 5000,
      lastLatitude: pointA.latitude,
      lastLongitude: pointA.longitude,
    };

    const result = recordTripLocation(state, pointB);
    const expected =
      5000 +
      segmentDistanceMeters(
        pointA.latitude,
        pointA.longitude,
        pointB.latitude,
        pointB.longitude,
      );

    expect(result.distanceMeters).toBeCloseTo(expected, 6);
    expect(result.lastLatitude).toBe(pointB.latitude);
    expect(result.lastLongitude).toBe(pointB.longitude);
  });

  it('adds zero distance for identical coordinates and keeps the last point', () => {
    const state: TripTrackingState = {
      distanceMeters: 5000,
      lastLatitude: pointA.latitude,
      lastLongitude: pointA.longitude,
    };

    const result = recordTripLocation(state, { ...pointA });

    expect(result.distanceMeters).toBe(5000);
    expect(result.lastLatitude).toBe(pointA.latitude);
    expect(result.lastLongitude).toBe(pointA.longitude);
  });

  it('moves the previous billing point forward A→B→C', () => {
    let state = recordTripLocation(
      { distanceMeters: 0, lastLatitude: null, lastLongitude: null },
      pointA,
    );
    expect(state.lastLatitude).toBe(pointA.latitude);
    expect(state.lastLongitude).toBe(pointA.longitude);

    state = recordTripLocation(state, pointB);
    expect(state.lastLatitude).toBe(pointB.latitude);
    expect(state.lastLongitude).toBe(pointB.longitude);

    state = recordTripLocation(state, pointC);
    expect(state.lastLatitude).toBe(pointC.latitude);
    expect(state.lastLongitude).toBe(pointC.longitude);
  });

  it('does not mutate the input state', () => {
    const state: TripTrackingState = {
      distanceMeters: 100,
      lastLatitude: pointA.latitude,
      lastLongitude: pointA.longitude,
    };
    const snapshot = { ...state };

    recordTripLocation(state, pointB);

    expect(state).toEqual(snapshot);
  });

  it('matches segmentDistanceMeters semantics for each added segment', () => {
    const afterA = recordTripLocation(
      { distanceMeters: 0, lastLatitude: null, lastLongitude: null },
      pointA,
    );
    const afterB = recordTripLocation(afterA, pointB);

    expect(afterB.distanceMeters).toBe(
      segmentDistanceMeters(
        pointA.latitude,
        pointA.longitude,
        pointB.latitude,
        pointB.longitude,
      ),
    );
  });
});
