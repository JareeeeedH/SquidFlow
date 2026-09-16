type GoogleMapsNamespace = {
  maps: {
    Map: new (
      el: object,
      opts?: Record<string, unknown>,
    ) => {
      fitBounds: (bounds: unknown) => void
      setCenter: (c: { lat: number; lng: number }) => void
      setZoom: (z: number) => void
      getZoom: () => number | undefined
    }
    Marker: new (opts: Record<string, unknown>) => { setMap: (m: unknown) => void }
    LatLngBounds: new () => {
      extend: (c: { lat: number; lng: number }) => void
      isEmpty: () => boolean
    }
  }
}

declare global {
  interface Window {
    google?: GoogleMapsNamespace
    __squidflowMapsReady?: () => void
  }
}

let loadPromise: Promise<GoogleMapsNamespace | null> | null = null

export function getGoogleMapsBrowserKey(): string | null {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (typeof key !== 'string') {
    return null
  }
  const trimmed = key.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function loadGoogleMaps(): Promise<GoogleMapsNamespace | null> {
  if (typeof window === 'undefined') {
    return Promise.resolve(null)
  }
  if (window.google?.maps) {
    return Promise.resolve(window.google)
  }
  if (loadPromise) {
    return loadPromise
  }

  const key = getGoogleMapsBrowserKey()
  if (!key) {
    return Promise.resolve(null)
  }

  loadPromise = new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-squidflow-google-maps="1"]',
    )
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google ?? null))
      existing.addEventListener('error', () => resolve(null))
      return
    }

    window.__squidflowMapsReady = () => {
      resolve(window.google ?? null)
    }

    const script = document.createElement('script')
    script.dataset.squidflowGoogleMaps = '1'
    script.async = true
    script.defer = true
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=__squidflowMapsReady`
    script.onerror = () => {
      loadPromise = null
      resolve(null)
    }
    document.head.appendChild(script)
  })

  return loadPromise
}
