import type { FormRules } from 'naive-ui'
import type { CreateDriverInput, DriverItem, UpdateDriverInput } from '../api/types'

export type DriverFormValues = {
  username: string
  password: string
  license_plate: string
  vehicle_brand: string
  vehicle_model: string
  vehicle_color: string
}

export const emptyDriverFormValues = (): DriverFormValues => ({
  username: '',
  password: '',
  license_plate: '',
  vehicle_brand: '',
  vehicle_model: '',
  vehicle_color: '',
})

export function driverToFormValues(driver: DriverItem): DriverFormValues {
  return {
    username: driver.username,
    password: '',
    license_plate: driver.license_plate,
    vehicle_brand: driver.vehicle_brand,
    vehicle_model: driver.vehicle_model,
    vehicle_color: driver.vehicle_color,
  }
}

export function driverFormRules(mode: 'create' | 'edit'): FormRules {
  return {
    username: {
      required: true,
      message: '請輸入帳號',
      trigger: ['blur', 'input'],
    },
    password:
      mode === 'create'
        ? {
            required: true,
            message: '請輸入密碼',
            trigger: ['blur', 'input'],
          }
        : {
            required: false,
          },
    license_plate: {
      required: true,
      message: '請輸入車牌',
      trigger: ['blur', 'input'],
    },
    vehicle_brand: {
      required: true,
      message: '請輸入品牌',
      trigger: ['blur', 'input'],
    },
    vehicle_model: {
      required: true,
      message: '請輸入型號',
      trigger: ['blur', 'input'],
    },
    vehicle_color: {
      required: true,
      message: '請輸入車色',
      trigger: ['blur', 'input'],
    },
  }
}

export function formValuesToCreateInput(
  form: DriverFormValues,
): CreateDriverInput | null {
  if (form.password.length === 0) {
    return null
  }
  return {
    username: form.username.trim(),
    password: form.password,
    license_plate: form.license_plate.trim(),
    vehicle_brand: form.vehicle_brand.trim(),
    vehicle_model: form.vehicle_model.trim(),
    vehicle_color: form.vehicle_color.trim(),
  }
}

export function formValuesToUpdateInput(
  form: DriverFormValues,
): UpdateDriverInput {
  const input: UpdateDriverInput = {
    username: form.username.trim(),
    license_plate: form.license_plate.trim(),
    vehicle_brand: form.vehicle_brand.trim(),
    vehicle_model: form.vehicle_model.trim(),
    vehicle_color: form.vehicle_color.trim(),
  }
  if (form.password.length > 0) {
    input.password = form.password
  }
  return input
}

export function formatVehicleSummary(driver: DriverItem): string {
  return `${driver.vehicle_brand} ${driver.vehicle_model} · ${driver.vehicle_color}`
}
