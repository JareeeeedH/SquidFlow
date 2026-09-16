import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SlideToConfirm from './SlideToConfirm.vue'

describe('SlideToConfirm', () => {
  it('emits confirm when complete() is called', () => {
    const wrapper = mount(SlideToConfirm, {
      props: { label: '滑動接單' },
    })

    expect(wrapper.text()).toContain('滑動接單')
    wrapper.vm.complete()
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('does not emit again while completed until loading ends', async () => {
    const wrapper = mount(SlideToConfirm, {
      props: {
        label: '滑動開始行程',
        loading: false,
      },
    })

    wrapper.vm.complete()
    wrapper.vm.complete()
    expect(wrapper.emitted('confirm')).toHaveLength(1)

    await wrapper.setProps({ loading: true })
    await wrapper.setProps({ loading: false })
    wrapper.vm.complete()
    expect(wrapper.emitted('confirm')).toHaveLength(2)
  })

  it('shows loading label while loading', () => {
    const wrapper = mount(SlideToConfirm, {
      props: {
        label: '滑動完成訂單',
        loadingLabel: '完成中...',
        loading: true,
      },
    })

    expect(wrapper.text()).toContain('完成中...')
  })
})
