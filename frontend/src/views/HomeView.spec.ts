import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HomeView from './HomeView.vue'

describe('HomeView', () => {
  it('renders the app name', () => {
    setActivePinia(createPinia())
    const wrapper = mount(HomeView)
    expect(wrapper.text()).toContain('SquidFlow')
  })
})
