import { describe, expect, it } from 'vitest'
import { buildGoogleMapsNavigationUrl } from './google-maps-nav'

describe('buildGoogleMapsNavigationUrl', () => {
  it('prefers coordinates when available', () => {
    expect(
      buildGoogleMapsNavigationUrl({
        latitude: 22.687,
        longitude: 120.307,
        address: '左營高鐵站',
      }),
    ).toBe('https://www.google.com/maps/dir/?api=1&destination=22.687,120.307')
  })

  it('falls back to address text', () => {
    expect(
      buildGoogleMapsNavigationUrl({
        latitude: null,
        longitude: null,
        address: '左營高鐵站',
      }),
    ).toBe(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent('左營高鐵站')}`,
    )
  })

  it('returns null when neither coords nor address exist', () => {
    expect(
      buildGoogleMapsNavigationUrl({
        latitude: null,
        longitude: null,
        address: '   ',
      }),
    ).toBeNull()
  })
})
