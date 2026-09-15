import {
  createRouter,
  createWebHistory,
  type RouteLocationNormalized,
} from 'vue-router'
import { setUnauthorizedHandler } from '../api/client'
import type { CurrentUser } from '../api/types'
import AppLayout from '../layouts/AppLayout.vue'
import DriverLayout from '../layouts/DriverLayout.vue'
import { resolveAuthRedirect } from '../lib/auth-redirect'
import { useAuthStore } from '../stores/auth'
import DriverCreateView from '../views/DriverCreateView.vue'
import DriverDetailView from '../views/DriverDetailView.vue'
import DriverHomeView from '../views/DriverHomeView.vue'
import DriverOpenOrdersView from '../views/DriverOpenOrdersView.vue'
import DriverOrderDetailView from '../views/DriverOrderDetailView.vue'
import DriversView from '../views/DriversView.vue'
import LoginView from '../views/LoginView.vue'
import OrderCreateView from '../views/OrderCreateView.vue'
import OrderDetailView from '../views/OrderDetailView.vue'
import OrdersView from '../views/OrdersView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    requiresAuth?: boolean
    role?: CurrentUser['role']
  }
}

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
      meta: { requiresAuth: true, role: 'ADMIN' },
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
    {
      path: '/driver',
      component: DriverLayout,
      meta: { requiresAuth: true, role: 'DRIVER' },
      children: [
        {
          path: '',
          name: 'driver-home',
          component: DriverHomeView,
        },
        {
          path: 'orders/open',
          name: 'driver-open-orders',
          component: DriverOpenOrdersView,
        },
        {
          path: 'orders/:id',
          name: 'driver-order-detail',
          component: DriverOrderDetailView,
        },
      ],
    },
  ],
})

router.beforeEach(async (to: RouteLocationNormalized) => {
  const auth = useAuthStore()
  await auth.initialize()
  return resolveAuthRedirect(to, auth.currentUser)
})

setUnauthorizedHandler(() => {
  const auth = useAuthStore()
  auth.handleUnauthorized()
  if (router.currentRoute.value.name !== 'login') {
    void router.push({ name: 'login' })
  }
})

export default router
