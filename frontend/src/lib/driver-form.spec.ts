import { describe, expect, it } from 'vitest'
import type { DriverItem } from '../api/types'
import {
  driverToFormValues,
  formValuesToCreateInput,
  formValuesToUpdateInput,
} from './driver-form'

const sample: DriverItem = {
  id: 'driver-1',
  username: 'driver01',
  vehicle_type: '5人座',
  license_plate: 'ABC-1234',
  vehicle_brand: 'Toyota',
  vehicle_model: 'Camry',
  vehicle_color: '黑色',
  vehicle_year: 2024,
  online_status: 'OFFLINE',
  status: 'ACTIVE',
}

describe('driver form helpers', () => {
  it('maps driver detail into form values without password', () => {
    expect(driverToFormValues(sample)).toEqual({
      username: 'driver01',
      password: '',
      vehicle_type: '5人座',
      license_plate: 'ABC-1234',
      vehicle_brand: 'Toyota',
      vehicle_model: 'Camry',
      vehicle_color: '黑色',
      vehicle_year: 2024,
    })
  })

  it('requires password on create and omits it on edit when blank', () => {
    const form = driverToFormValues(sample)

    expect(formValuesToCreateInput(form)).toBeNull()
    expect(formValuesToUpdateInput(form)).toEqual({
      username: 'driver01',
      vehicle_type: '5人座',
      license_plate: 'ABC-1234',
      vehicle_brand: 'Toyota',
      vehicle_model: 'Camry',
      vehicle_color: '黑色',
      vehicle_year: 2024,
    })

    form.password = 'Secret123!'
    expect(formValuesToCreateInput(form)).toEqual({
      username: 'driver01',
      password: 'Secret123!',
      vehicle_type: '5人座',
      license_plate: 'ABC-1234',
      vehicle_brand: 'Toyota',
      vehicle_model: 'Camry',
      vehicle_color: '黑色',
      vehicle_year: 2024,
    })
    expect(formValuesToUpdateInput(form)?.password).toBe('Secret123!')
  })
})
