import type { FormRules } from 'naive-ui'
import type { CreateDriverInput, DriverItem, UpdateDriverInput } from '../api/types'

export type DriverFormValues = {
  username: string
  password: string
  vehicle_type: string
  license_plate: string
  vehicle_brand: string
  vehicle_model: string
  vehicle_color: string
  vehicle_year: number | null
}

export const emptyDriverFormValues = (): DriverFormValues => ({
  username: '',
  password: '',
  vehicle_type: '',
  license_plate: '',
  vehicle_brand: '',
  vehicle_model: '',
  vehicle_color: '',
  vehicle_year: null,
})

export function driverToFormValues(driver: DriverItem): DriverFormValues {
  return {
    username: driver.username,
    password: '',
    vehicle_type: driver.vehicle_type,
    license_plate: driver.license_plate,
    vehicle_brand: driver.vehicle_brand,
    vehicle_model: driver.vehicle_model,
    vehicle_color: driver.vehicle_color,
    vehicle_year: driver.vehicle_year,
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
    vehicle_type: {
      required: true,
      message: '請輸入車型',
      trigger: ['blur', 'input'],
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
    vehicle_year: {
      required: true,
      type: 'number',
      message: '請輸入年份',
      trigger: ['blur', 'change'],
    },
  }
}

export function formValuesToCreateInput(
  form: DriverFormValues,
): CreateDriverInput | null {
  if (form.vehicle_year == null || !Number.isInteger(form.vehicle_year)) {
    return null
  }
  if (form.password.length === 0) {
    return null
  }
  return {
    username: form.username.trim(),
    password: form.password,
    vehicle_type: form.vehicle_type.trim(),
    license_plate: form.license_plate.trim(),
    vehicle_brand: form.vehicle_brand.trim(),
    vehicle_model: form.vehicle_model.trim(),
    vehicle_color: form.vehicle_color.trim(),
    vehicle_year: form.vehicle_year,
  }
}

export function formValuesToUpdateInput(
  form: DriverFormValues,
): UpdateDriverInput | null {
  if (form.vehicle_year == null || !Number.isInteger(form.vehicle_year)) {
    return null
  }
  const input: UpdateDriverInput = {
    username: form.username.trim(),
    vehicle_type: form.vehicle_type.trim(),
    license_plate: form.license_plate.trim(),
    vehicle_brand: form.vehicle_brand.trim(),
    vehicle_model: form.vehicle_model.trim(),
    vehicle_color: form.vehicle_color.trim(),
    vehicle_year: form.vehicle_year,
  }
  if (form.password.length > 0) {
    input.password = form.password
  }
  return input
}

export function formatVehicleSummary(driver: DriverItem): string {
  return `${driver.vehicle_brand} ${driver.vehicle_model} · ${driver.vehicle_color} · ${driver.vehicle_year}`
}
