import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import LoginView from './LoginView.vue'

vi.mock('../stores/auth', () => ({
  useAuthStore: () => ({
    initError: null,
    login: vi.fn(),
  }),
}))

describe('LoginView', () => {
  it('renders username, password, and login only', async () => {
    setActivePinia(createPinia())
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/login', component: LoginView }],
    })
    await router.push('/login')
    await router.isReady()

    const wrapper = mount(LoginView, {
      global: {
        plugins: [router],
      },
    })

    expect(wrapper.text()).toContain('SquidFlow')
    expect(wrapper.text()).toContain('派車管理系統')
    expect(wrapper.text()).toContain('帳號')
    expect(wrapper.text()).toContain('密碼')
    expect(wrapper.text()).toContain('登入控制中心')
    expect(wrapper.text()).not.toContain('FLEET CONTROL SYSTEM')
    expect(wrapper.text()).not.toContain('INITIALIZE SESSION')
    expect(wrapper.text()).not.toContain('註冊')
    expect(wrapper.text()).not.toContain('忘記密碼')
  })
})
