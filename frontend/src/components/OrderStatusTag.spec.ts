import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { OrderStatus } from '../api/types'
import OrderStatusTag from './OrderStatusTag.vue'

const statuses: OrderStatus[] = [
  'DRAFT',
  'OPEN',
  'ACCEPTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]

const labels: Record<OrderStatus, string> = {
  DRAFT: '草稿',
  OPEN: '搶單中',
  ACCEPTED: '已接單',
  IN_PROGRESS: '行程中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
}

describe('OrderStatusTag', () => {
  it.each(statuses)('renders a consistent label for %s', (status) => {
    const wrapper = mount(OrderStatusTag, {
      props: { status },
    })
    expect(wrapper.text()).toContain(labels[status])
  })
})
