import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { fetchCurrentUser, login as loginRequest, logout as logoutRequest } from '../api/auth'
import { ApiClientError } from '../api/types'
import type { CurrentUser } from '../api/types'
import { useDriverStatusStore } from './driver-status'

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<CurrentUser | null>(null)
  const initialized = ref(false)
  const initializing = ref(false)
  const initError = ref<string | null>(null)
  const authenticated = computed(() => currentUser.value !== null)
  let initializePromise: Promise<void> | null = null

  function clearAuthState() {
    currentUser.value = null
    useDriverStatusStore().reset()
  }

  async function refresh() {
    currentUser.value = await fetchCurrentUser()
  }

  async function initialize() {
    if (initialized.value) {
      return
    }
    if (initializePromise) {
      return initializePromise
    }

    initializePromise = (async () => {
      initializing.value = true
      initError.value = null

      try {
        currentUser.value = await fetchCurrentUser()
      } catch (error) {
        currentUser.value = null
        if (
          error instanceof ApiClientError &&
          error.status === 401 &&
          error.code === 'UNAUTHORIZED'
        ) {
          initError.value = null
        } else if (error instanceof ApiClientError) {
          initError.value = error.message
        } else {
          initError.value = '系統發生錯誤'
        }
      } finally {
        initializing.value = false
        initialized.value = true
      }
    })()

    return initializePromise
  }

  async function login(username: string, password: string) {
    await loginRequest(username, password)
    currentUser.value = await fetchCurrentUser()
    initialized.value = true
    initError.value = null
  }

  async function logout() {
    try {
      await logoutRequest()
    } catch {
      // Session may already be invalid; always clear local state.
    } finally {
      clearAuthState()
    }
  }

  function handleUnauthorized() {
    clearAuthState()
  }

  return {
    currentUser,
    authenticated,
    initialized,
    initializing,
    initError,
    initialize,
    login,
    refresh,
    logout,
    handleUnauthorized,
    clearAuthState,
  }
})
