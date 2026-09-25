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
  customer_name: string | null
  pickup_location: string
  destination: string | null
  price: number | null
  note: string | null
  status: OrderStatus
  driver_id: string | null
  created_at: string
}

export type OrderListQuery = {
  search?: string
  status?: OrderStatus
  date?: string
}

export type DashboardSummary = {
  DRAFT: number
  OPEN: number
  ACCEPTED: number
  IN_PROGRESS: number
  COMPLETED: number
  CANCELLED: number
}

export type DashboardBoardOrder = {
  id: string
  order_no: string
  customer_name: string | null
  pickup_location: string
  destination: string | null
  created_at: string
  price: number | null
  status: OrderStatus
  driver: { username: string } | null
}

export type AdminDashboard = {
  summary: DashboardSummary
  board_orders: DashboardBoardOrder[]
}

export type AssignedDriver = {
  username: string
  license_plate: string
  vehicle_brand: string
  vehicle_model: string
  vehicle_color: string
}

export type OrderDetail = {
  id: string
  order_no: string
  customer_name: string | null
  pickup_location: string
  destination: string | null
  price: number | null
  note: string | null
  status: OrderStatus
  dispatch_mode: 'OPEN' | 'DIRECT' | 'PRIORITY' | 'AUTO'
  driver_id: string | null
  driver: AssignedDriver | null
  created_by: string
  accepted_at: string | null
  started_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
  pickup_latitude: number | null
  pickup_longitude: number | null
}

export type CreateOrderInput = {
  customer_name: string | null
  pickup_location: string
  destination: string | null
  price: number | null
  note?: string | null
}

export type CreateOrderResult = {
  id: string
  order_no: string
  status: OrderStatus
  dispatch_mode: 'OPEN' | 'DIRECT' | 'PRIORITY' | 'AUTO'
}

export type PublishOrderResult = {
  id: string
  status: OrderStatus
}

export type AccountStatus = 'ACTIVE' | 'SUSPENDED'
export type OnlineStatus = 'ONLINE' | 'OFFLINE'

export type DriverItem = {
  id: string
  username: string
  license_plate: string
  vehicle_brand: string
  vehicle_model: string
  vehicle_color: string
  online_status: OnlineStatus
  status: AccountStatus
}

export type CreateDriverInput = {
  username: string
  password: string
  license_plate: string
  vehicle_brand: string
  vehicle_model: string
  vehicle_color: string
}

export type UpdateDriverInput = {
  username: string
  password?: string
  license_plate: string
  vehicle_brand: string
  vehicle_model: string
  vehicle_color: string
}

export type DriverStatusResult = {
  id: string
  status: AccountStatus
}

export type DriverOnlineStatusResult = {
  status: OnlineStatus
}

export type DriverLocationResult = {
  latitude: number | null
  longitude: number | null
  location_updated_at: string | null
}

export type OnlineDriverLocationItem = {
  id: string
  username: string
  license_plate: string
  online_status: 'ONLINE'
  latitude: number | null
  longitude: number | null
  location_updated_at: string | null
}

export type OnlineDriverDistanceItem = {
  id: string
  username: string
  license_plate: string
  online_status: 'ONLINE'
  latitude: number | null
  longitude: number | null
  location_updated_at: string | null
  distance_meters: number | null
}

export type DriverOpenOrder = {
  id: string
  order_no: string
  created_at: string
  pickup_location: string
  destination: string | null
  price: number | null
  note: string | null
  distance_meters: number | null
}

export type DriverOrderDetail = {
  id: string
  order_no: string
  customer_name: string | null
  pickup_location: string
  destination: string | null
  created_at: string
  price: number | null
  note: string | null
  status: OrderStatus
  distance_meters: number | null
  trip_distance_meters: number | null
  arrived_at: string | null
  calculated_fare: number | null
  final_fare: number | null
  pickup_latitude: number | null
  pickup_longitude: number | null
}

export type AcceptOrderResult = {
  id: string
  status: 'ACCEPTED'
  driver_id: string
  accepted_at: string
}

export type DriverMyOrder = {
  id: string
  order_no: string
  created_at: string
  pickup_location: string
  destination: string | null
  price: number | null
  final_fare: number | null
  status: OrderStatus
  distance_meters: number | null
  trip_distance_meters: number | null
}

export type StartOrderResult = {
  id: string
  status: 'IN_PROGRESS'
  started_at: string
}

export type ArriveOrderResult = {
  id: string
  status: 'IN_PROGRESS'
  arrived_at: string
  trip_distance_meters: number
  calculated_fare: number
  final_fare: number | null
  price?: number | null
}

export type CompleteOrderResult = {
  id: string
  status: 'COMPLETED'
  completed_at: string
  trip_distance_meters: number
  calculated_fare: number
  final_fare: number
  price?: number | null
}

export type CancelOrderResult = {
  id: string
  status: OrderStatus
}
