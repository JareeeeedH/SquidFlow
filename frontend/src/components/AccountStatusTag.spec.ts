import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AccountStatusTag from './AccountStatusTag.vue'

describe('AccountStatusTag', () => {
  it('renders ACTIVE as 啟用', () => {
    const wrapper = mount(AccountStatusTag, {
      props: { status: 'ACTIVE' },
    })
    expect(wrapper.text()).toContain('啟用')
  })

  it('renders SUSPENDED as 停用', () => {
    const wrapper = mount(AccountStatusTag, {
      props: { status: 'SUSPENDED' },
    })
    expect(wrapper.text()).toContain('停用')
  })
})
