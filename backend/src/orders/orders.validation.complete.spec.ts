import { AppError } from '../common/errors/app.error';
import { parseCompleteBody } from './orders.validation';

describe('parseCompleteBody', () => {
  it('accepts non-negative integer final_fare', () => {
    expect(parseCompleteBody({ final_fare: 0 })).toEqual({ finalFare: 0 });
    expect(parseCompleteBody({ final_fare: 500 })).toEqual({ finalFare: 500 });
  });

  it('rejects missing, negative, non-integer, and non-finite values', () => {
    for (const body of [
      {},
      { final_fare: null },
      { final_fare: -1 },
      { final_fare: 12.5 },
      { final_fare: '500' },
      { final_fare: Number.NaN },
      { final_fare: Number.POSITIVE_INFINITY },
    ]) {
      expect(() => parseCompleteBody(body)).toThrow(AppError);
    }
  });
});
