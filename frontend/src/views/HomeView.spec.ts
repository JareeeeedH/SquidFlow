import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import HomeView from './HomeView.vue'

describe('HomeView', () => {
  it('renders the foundation placeholder', () => {
    const wrapper = mount(HomeView)
    expect(wrapper.text()).toContain('SquidFlow')
    expect(wrapper.text()).toContain('Frontend Foundation Ready')
  })
})
