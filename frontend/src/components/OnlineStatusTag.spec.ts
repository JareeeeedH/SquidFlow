import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OnlineStatusTag from './OnlineStatusTag.vue'

describe('OnlineStatusTag', () => {
  it('renders ONLINE as 上線', () => {
    const wrapper = mount(OnlineStatusTag, {
      props: { status: 'ONLINE' },
    })
    expect(wrapper.text()).toContain('上線')
  })

  it('renders OFFLINE as 離線', () => {
    const wrapper = mount(OnlineStatusTag, {
      props: { status: 'OFFLINE' },
    })
    expect(wrapper.text()).toContain('離線')
  })
})
