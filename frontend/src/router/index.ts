import {
  createRouter,
  createWebHistory,
  type RouteLocationNormalized,
} from 'vue-router'
import { setUnauthorizedHandler } from '../api/client'
import AppLayout from '../layouts/AppLayout.vue'
import { useAuthStore } from '../stores/auth'
import DriverCreateView from '../views/DriverCreateView.vue'
import DriverDetailView from '../views/DriverDetailView.vue'
import DriversView from '../views/DriversView.vue'
import LoginView from '../views/LoginView.vue'
import OrderCreateView from '../views/OrderCreateView.vue'
import OrderDetailView from '../views/OrderDetailView.vue'
import OrdersView from '../views/OrdersView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { public: true },
    },
    {
      path: '/',
      component: AppLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: { name: 'orders' },
        },
        {
          path: 'orders',
          name: 'orders',
          component: OrdersView,
        },
        {
          path: 'orders/new',
          name: 'order-create',
          component: OrderCreateView,
        },
        {
          path: 'orders/:id',
          name: 'order-detail',
          component: OrderDetailView,
        },
        {
          path: 'drivers',
          name: 'drivers',
          component: DriversView,
        },
        {
          path: 'drivers/new',
          name: 'driver-create',
          component: DriverCreateView,
        },
        {
          path: 'drivers/:id',
          name: 'driver-detail',
          component: DriverDetailView,
        },
      ],
    },
  ],
})

router.beforeEach(async (to: RouteLocationNormalized) => {
  const auth = useAuthStore()
  await auth.initialize()

  if (to.meta.requiresAuth && !auth.authenticated) {
    return { name: 'login' }
  }

  if (to.name === 'login' && auth.authenticated) {
    return { name: 'orders' }
  }

  return true
})

setUnauthorizedHandler(() => {
  const auth = useAuthStore()
  auth.handleUnauthorized()
  if (router.currentRoute.value.name !== 'login') {
    void router.push({ name: 'login' })
  }
})

export default router
