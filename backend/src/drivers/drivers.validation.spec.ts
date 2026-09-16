import { AppError } from '../common/errors/app.error';
import { parseUpdateDriverLocationBody } from './drivers.validation';

describe('parseUpdateDriverLocationBody', () => {
  it('accepts valid latitude and longitude', () => {
    expect(
      parseUpdateDriverLocationBody({
        latitude: 22.6870123,
        longitude: 120.3090456,
      }),
    ).toEqual({
      latitude: 22.6870123,
      longitude: 120.3090456,
    });
  });

  it('ignores client-supplied driver_id and user_id', () => {
    expect(
      parseUpdateDriverLocationBody({
        latitude: 1,
        longitude: 2,
        driver_id: 'other-driver',
        user_id: 'other-user',
      }),
    ).toEqual({
      latitude: 1,
      longitude: 2,
    });
  });

  it('rejects missing coordinates', () => {
    expect(() => parseUpdateDriverLocationBody({})).toThrow(AppError);
    try {
      parseUpdateDriverLocationBody({});
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).errorCode).toBe('VALIDATION_ERROR');
    }
  });

  it('rejects non-number coordinates', () => {
    try {
      parseUpdateDriverLocationBody({
        latitude: '22.6',
        longitude: 120.3,
      });
      throw new Error('expected validation error');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).errorCode).toBe('VALIDATION_ERROR');
    }
  });

  it('rejects latitude out of range', () => {
    try {
      parseUpdateDriverLocationBody({
        latitude: 91,
        longitude: 0,
      });
      throw new Error('expected validation error');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).errorCode).toBe('VALIDATION_ERROR');
    }
  });

  it('rejects longitude out of range', () => {
    try {
      parseUpdateDriverLocationBody({
        latitude: 0,
        longitude: -181,
      });
      throw new Error('expected validation error');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).errorCode).toBe('VALIDATION_ERROR');
    }
  });
});
