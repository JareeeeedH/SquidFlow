import { api } from './client'
import type { DriverLocationResult, OnlineDriverLocationItem } from './types'

export function getDriverLocation() {
  return api.get<DriverLocationResult>('/driver/location')
}

export function updateDriverLocation(latitude: number, longitude: number) {
  return api.patch<DriverLocationResult>('/driver/location', {
    latitude,
    longitude,
  })
}

export function listOnlineDriverLocations() {
  return api.get<OnlineDriverLocationItem[]>('/drivers/online-locations')
}
