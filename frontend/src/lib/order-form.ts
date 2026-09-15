import type { FormRules } from 'naive-ui'
import type { CreateOrderInput, OrderDetail } from '../api/types'

export type OrderFormValues = {
  customer_name: string
  pickup_location: string
  destination: string
  price: number | null
  note: string
}

export const emptyOrderFormValues = (): OrderFormValues => ({
  customer_name: '',
  pickup_location: '',
  destination: '',
  price: null,
  note: '',
})

export const orderFormRules: FormRules = {
  pickup_location: {
    required: true,
    message: '請輸入上車地點',
    trigger: ['blur', 'input'],
  },
}

function optionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export function orderDetailToFormValues(order: OrderDetail): OrderFormValues {
  return {
    customer_name: order.customer_name ?? '',
    pickup_location: order.pickup_location,
    destination: order.destination ?? '',
    price: order.price,
    note: order.note ?? '',
  }
}

export function formValuesToInput(form: OrderFormValues): CreateOrderInput | null {
  const pickup_location = form.pickup_location.trim()
  if (!pickup_location) {
    return null
  }

  return {
    customer_name: optionalText(form.customer_name),
    pickup_location,
    destination: optionalText(form.destination),
    price: form.price,
    note: optionalText(form.note),
  }
}

export function toOrderWriteBody(input: CreateOrderInput): CreateOrderInput {
  return {
    customer_name: input.customer_name?.trim() ? input.customer_name.trim() : null,
    pickup_location: input.pickup_location,
    destination: input.destination?.trim() ? input.destination.trim() : null,
    price: input.price,
    note: input.note?.trim() ? input.note.trim() : null,
  }
}
