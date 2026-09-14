export type ApiSuccess<T> = {
  success: true
  data: T
}

export type ApiErrorBody = {
  success: false
  error: {
    code: string
    message: string
  }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody

export class ApiClientError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ApiClientError'
    this.code = code
    this.status = status
  }
}

export type CurrentUser = {
  id: string
  username: string
  role: 'ADMIN' | 'DRIVER'
  status: 'ACTIVE' | 'SUSPENDED'
}

export type LoginUser = {
  id: string
  username: string
  role: 'ADMIN' | 'DRIVER'
}
