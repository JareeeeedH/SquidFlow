export const WAVE_DISPATCH_OPTIONS = Symbol('WAVE_DISPATCH_OPTIONS');

export type WaveDispatchOptions = {
  batchSize: number;
  intervalMs: number;
};

export const DEFAULT_WAVE_DISPATCH_OPTIONS: WaveDispatchOptions = {
  batchSize: 5,
  intervalMs: 10_000,
};
