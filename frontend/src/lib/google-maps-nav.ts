export function buildGoogleMapsNavigationUrl(input: {
  latitude?: number | null
  longitude?: number | null
  address?: string | null
}): string | null {
  const lat = input.latitude
  const lng = input.longitude
  if (
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    typeof lng === 'number' &&
    Number.isFinite(lng)
  ) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  }

  const address = input.address?.trim()
  if (address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
  }

  return null
}

/** Open Google Maps handoff; failures must not throw into Order flows. */
export function openGoogleMapsNavigation(input: {
  latitude?: number | null
  longitude?: number | null
  address?: string | null
}): boolean {
  try {
    const url = buildGoogleMapsNavigationUrl(input)
    if (!url) {
      return false
    }
    window.open(url, '_blank', 'noopener,noreferrer')
    return true
  } catch {
    return false
  }
}
