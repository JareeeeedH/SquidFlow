import type { FormRules } from 'naive-ui'
import type { CreateOrderInput, OrderDetail } from '../api/types'
import { toScheduledAtIso } from './format'

export type OrderFormValues = {
  customer_name: string
  pickup_location: string
  destination: string
  scheduled_at: number | null
  vehicle_type: string
  price: number | null
  note: string
}

export const emptyOrderFormValues = (): OrderFormValues => ({
  customer_name: '',
  pickup_location: '',
  destination: '',
  scheduled_at: null,
  vehicle_type: '',
  price: null,
  note: '',
})

export const orderFormRules: FormRules = {
  customer_name: {
    required: true,
    message: '請輸入客戶姓名',
    trigger: ['blur', 'input'],
  },
  pickup_location: {
    required: true,
    message: '請輸入上車地點',
    trigger: ['blur', 'input'],
  },
  destination: {
    required: true,
    message: '請輸入目的地',
    trigger: ['blur', 'input'],
  },
  scheduled_at: {
    required: true,
    type: 'number',
    message: '請選擇預約時間',
    trigger: ['blur', 'change'],
  },
  vehicle_type: {
    required: true,
    message: '請輸入車型',
    trigger: ['blur', 'input'],
  },
  price: {
    required: true,
    type: 'number',
    message: '請輸入價格',
    trigger: ['blur', 'change'],
  },
}

export function orderDetailToFormValues(order: OrderDetail): OrderFormValues {
  return {
    customer_name: order.customer_name,
    pickup_location: order.pickup_location,
    destination: order.destination,
    scheduled_at: new Date(order.scheduled_at).getTime(),
    vehicle_type: order.vehicle_type,
    price: order.price,
    note: order.note ?? '',
  }
}

export function formValuesToInput(form: OrderFormValues): CreateOrderInput | null {
  if (form.scheduled_at == null || form.price == null) {
    return null
  }

  const note = form.note.trim()
  return {
    customer_name: form.customer_name.trim(),
    pickup_location: form.pickup_location.trim(),
    destination: form.destination.trim(),
    scheduled_at: toScheduledAtIso(form.scheduled_at),
    vehicle_type: form.vehicle_type.trim(),
    price: form.price,
    note: note === '' ? null : note,
  }
}

export function toOrderWriteBody(input: CreateOrderInput): CreateOrderInput {
  return {
    customer_name: input.customer_name,
    pickup_location: input.pickup_location,
    destination: input.destination,
    scheduled_at: input.scheduled_at,
    vehicle_type: input.vehicle_type,
    price: input.price,
    note: input.note?.trim() ? input.note.trim() : null,
  }
}
