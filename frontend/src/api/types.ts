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

export type OrderStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'

export type OrderListItem = {
  id: string
  order_no: string
  customer_name: string
  pickup_location: string
  destination: string
  scheduled_at: string
  vehicle_type: string
  price: number
  note: string | null
  status: OrderStatus
  driver_id: string | null
}

export type OrderListQuery = {
  search?: string
  status?: OrderStatus
  date?: string
}
