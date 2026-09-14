import { ApiClientError, type ApiResponse } from './types'

export const API_BASE = '/api/v1'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

type RequestOptions = {
  body?: unknown
  skipUnauthorizedHandler?: boolean
}

let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  if (value === null || typeof value !== 'object') {
    return false
  }
  return 'success' in value
}

export async function apiRequest<T>(
  method: HttpMethod,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(options.body === undefined
          ? {}
          : { 'Content-Type': 'application/json' }),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiClientError('NETWORK_ERROR', '無法連線到伺服器', 0)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ApiClientError(
      'INTERNAL_ERROR',
      '系統發生錯誤',
      response.status,
    )
  }

  if (!isApiResponse(payload)) {
    throw new ApiClientError(
      'INTERNAL_ERROR',
      '系統發生錯誤',
      response.status,
    )
  }

  if (!payload.success) {
    const error = new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
    )
    if (
      error.status === 401 &&
      error.code === 'UNAUTHORIZED' &&
      !options.skipUnauthorizedHandler
    ) {
      onUnauthorized?.()
    }
    throw error
  }

  return payload.data as T
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    apiRequest<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>('POST', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>('PUT', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>('PATCH', path, { ...options, body }),
  delete: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>('DELETE', path, { ...options, body }),
}
