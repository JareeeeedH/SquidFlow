import { buildSecurityHeaders } from './security-headers';

describe('buildSecurityHeaders', () => {
  it('sets CSP, nosniff, referrer policy, and frame protection', () => {
    const headers = buildSecurityHeaders(false);
    expect(headers['Content-Security-Policy']).toContain("default-src 'none'");
    expect(headers['Content-Security-Policy']).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Strict-Transport-Security']).toBeUndefined();
  });

  it('adds HSTS only in production', () => {
    const headers = buildSecurityHeaders(true);
    expect(headers['Strict-Transport-Security']).toBe(
      'max-age=31536000; includeSubDomains',
    );
  });
});
