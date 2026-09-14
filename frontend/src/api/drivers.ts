import { api } from './client'
import type {
  AccountStatus,
  CreateDriverInput,
  DriverItem,
  DriverStatusResult,
  UpdateDriverInput,
} from './types'

export function listDrivers() {
  return api.get<DriverItem[]>('/drivers')
}

export function getDriver(id: string) {
  return api.get<DriverItem>(`/drivers/${id}`)
}

export function createDriver(input: CreateDriverInput) {
  return api.post<DriverItem>('/drivers', {
    username: input.username,
    password: input.password,
    vehicle_type: input.vehicle_type,
    license_plate: input.license_plate,
    vehicle_brand: input.vehicle_brand,
    vehicle_model: input.vehicle_model,
    vehicle_color: input.vehicle_color,
    vehicle_year: input.vehicle_year,
  })
}

export function updateDriver(id: string, input: UpdateDriverInput) {
  const body: UpdateDriverInput = {
    username: input.username,
    vehicle_type: input.vehicle_type,
    license_plate: input.license_plate,
    vehicle_brand: input.vehicle_brand,
    vehicle_model: input.vehicle_model,
    vehicle_color: input.vehicle_color,
    vehicle_year: input.vehicle_year,
  }
  if (input.password) {
    body.password = input.password
  }
  return api.put<DriverItem>(`/drivers/${id}`, body)
}

export function updateDriverStatus(id: string, status: AccountStatus) {
  return api.patch<DriverStatusResult>(`/drivers/${id}/status`, { status })
}
