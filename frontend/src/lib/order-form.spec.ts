import { describe, expect, it } from 'vitest'
import type { OrderDetail } from '../api/types'
import {
  formValuesToInput,
  orderDetailToFormValues,
  toOrderWriteBody,
} from './order-form'

const sample: OrderDetail = {
  id: 'order-1',
  order_no: 'ORD-20260915-001',
  customer_name: '王先生',
  pickup_location: '左營高鐵站',
  destination: '高雄小港機場',
  price: 1200,
  note: '2件行李',
  status: 'DRAFT',
  dispatch_mode: 'OPEN',
  driver_id: null,
  driver: null,
  created_by: 'admin-1',
  accepted_at: null,
  started_at: null,
  completed_at: null,
  cancelled_at: null,
  created_at: '2026-09-15T07:00:00.000Z',
  updated_at: '2026-09-15T07:00:00.000Z',
}

describe('order form helpers', () => {
  it('maps detail into form values and back to API fields', () => {
    const form = orderDetailToFormValues(sample)
    const input = formValuesToInput(form)

    expect(input).toEqual({
      customer_name: '王先生',
      pickup_location: '左營高鐵站',
      destination: '高雄小港機場',
      price: 1200,
      note: '2件行李',
    })
  })

  it('sends only writable fields and empty note as null', () => {
    expect(
      toOrderWriteBody({
        customer_name: '王先生',
        pickup_location: '左營高鐵站',
        destination: '高雄小港機場',
        price: 1200,
        note: '   ',
      }),
    ).toEqual({
      customer_name: '王先生',
      pickup_location: '左營高鐵站',
      destination: '高雄小港機場',
      price: 1200,
      note: null,
    })
  })

  it('maps empty optional fields to null and requires pickup_location', () => {
    expect(
      formValuesToInput({
        customer_name: '  ',
        pickup_location: '左營高鐵站',
        destination: '',
        price: null,
        note: '',
      }),
    ).toEqual({
      customer_name: null,
      pickup_location: '左營高鐵站',
      destination: null,
      price: null,
      note: null,
    })
    expect(
      formValuesToInput({
        customer_name: '王先生',
        pickup_location: '   ',
        destination: '小港機場',
        price: 1200,
        note: '2件行李',
      }),
    ).toBeNull()
  })
})
