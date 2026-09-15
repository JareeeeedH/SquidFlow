import { isSecureSessionCookie, sessionCookieOptions } from './cookie.config';

describe('sessionCookieOptions', () => {
  it('uses HttpOnly and SameSite=Lax, and Secure only in production', () => {
    expect(isSecureSessionCookie('production')).toBe(true);
    expect(isSecureSessionCookie('development')).toBe(false);
    expect(isSecureSessionCookie('test')).toBe(false);

    const options = sessionCookieOptions();
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe('lax');
    expect(options.path).toBe('/');
  });
});
