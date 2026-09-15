import { DispatchMode, Order, OrderStatus } from '@prisma/client';

export type OrderCreateResponse = {
  id: string;
  order_no: string;
  status: OrderStatus;
  dispatch_mode: DispatchMode;
};

export type OrderListItem = {
  id: string;
  order_no: string;
  customer_name: string;
  pickup_location: string;
  destination: string;
  scheduled_at: string;
  vehicle_type: string;
  price: number;
  note: string | null;
  status: OrderStatus;
  driver_id: string | null;
};

export type AssignedDriver = {
  username: string;
  vehicle_type: string;
  license_plate: string;
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_color: string;
};

export type OrderDetail = {
  id: string;
  order_no: string;
  customer_name: string;
  pickup_location: string;
  destination: string;
  scheduled_at: string;
  vehicle_type: string;
  price: number;
  note: string | null;
  status: OrderStatus;
  dispatch_mode: DispatchMode;
  driver_id: string | null;
  driver: AssignedDriver | null;
  created_by: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderWithAssignedDriver = Order & {
  driver: {
    vehicleType: string;
    licensePlate: string;
    vehicleBrand: string;
    vehicleModel: string;
    vehicleColor: string;
    user: {
      username: string;
    };
  } | null;
};

export type DashboardBoardDriver = {
  username: string;
};

export type DashboardBoardOrder = {
  id: string;
  order_no: string;
  customer_name: string;
  pickup_location: string;
  destination: string;
  scheduled_at: string;
  price: number;
  status: OrderStatus;
  driver: DashboardBoardDriver | null;
};

export type DashboardSummary = {
  DRAFT: number;
  OPEN: number;
  ACCEPTED: number;
  IN_PROGRESS: number;
  COMPLETED: number;
  CANCELLED: number;
};

export type AdminDashboard = {
  summary: DashboardSummary;
  board_orders: DashboardBoardOrder[];
};

export const DASHBOARD_BOARD_STATUSES: OrderStatus[] = [
  OrderStatus.DRAFT,
  OrderStatus.OPEN,
  OrderStatus.ACCEPTED,
  OrderStatus.IN_PROGRESS,
];

export type DriverMyOrder = {
  id: string;
  order_no: string;
  scheduled_at: string;
  pickup_location: string;
  destination: string;
  vehicle_type: string;
  price: number;
  status: OrderStatus;
};

export type DriverOpenOrder = {
  id: string;
  order_no: string;
  scheduled_at: string;
  pickup_location: string;
  destination: string;
  vehicle_type: string;
  price: number;
  note: string | null;
};

export type DriverOrderDetail = {
  id: string;
  order_no: string;
  customer_name: string;
  pickup_location: string;
  destination: string;
  scheduled_at: string;
  vehicle_type: string;
  price: number;
  note: string | null;
  status: OrderStatus;
};

type DriverMyOrderRow = Pick<
  Order,
  | 'id'
  | 'orderNo'
  | 'scheduledAt'
  | 'pickupLocation'
  | 'destination'
  | 'vehicleType'
  | 'price'
  | 'status'
>;

type DriverOpenOrderRow = Pick<
  Order,
  | 'id'
  | 'orderNo'
  | 'scheduledAt'
  | 'pickupLocation'
  | 'destination'
  | 'vehicleType'
  | 'price'
  | 'note'
>;

type DriverOrderDetailRow = Pick<
  Order,
  | 'id'
  | 'orderNo'
  | 'customerName'
  | 'pickupLocation'
  | 'destination'
  | 'scheduledAt'
  | 'vehicleType'
  | 'price'
  | 'note'
  | 'status'
>;

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function priceNumber(price: Order['price']): number {
  return price.toNumber();
}

export function toCreateResponse(order: Order): OrderCreateResponse {
  return {
    id: order.id,
    order_no: order.orderNo,
    status: order.status,
    dispatch_mode: order.dispatchMode,
  };
}

export function toListItem(order: Order): OrderListItem {
  return {
    id: order.id,
    order_no: order.orderNo,
    customer_name: order.customerName,
    pickup_location: order.pickupLocation,
    destination: order.destination,
    scheduled_at: order.scheduledAt.toISOString(),
    vehicle_type: order.vehicleType,
    price: priceNumber(order.price),
    note: order.note,
    status: order.status,
    driver_id: order.driverId,
  };
}

export function emptyDashboardSummary(): DashboardSummary {
  return {
    DRAFT: 0,
    OPEN: 0,
    ACCEPTED: 0,
    IN_PROGRESS: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  };
}

export function toDashboardSummary(
  counts: Array<{ status: OrderStatus; count: number }>,
): DashboardSummary {
  const summary = emptyDashboardSummary();
  for (const row of counts) {
    summary[row.status] = row.count;
  }
  return summary;
}

export function toDashboardBoardOrder(
  order: OrderWithAssignedDriver,
): DashboardBoardOrder {
  return {
    id: order.id,
    order_no: order.orderNo,
    customer_name: order.customerName,
    pickup_location: order.pickupLocation,
    destination: order.destination,
    scheduled_at: order.scheduledAt.toISOString(),
    price: priceNumber(order.price),
    status: order.status,
    driver: order.driver ? { username: order.driver.user.username } : null,
  };
}

export function toAssignedDriver(
  driver: OrderWithAssignedDriver['driver'],
): AssignedDriver | null {
  if (!driver) {
    return null;
  }
  return {
    username: driver.user.username,
    vehicle_type: driver.vehicleType,
    license_plate: driver.licensePlate,
    vehicle_brand: driver.vehicleBrand,
    vehicle_model: driver.vehicleModel,
    vehicle_color: driver.vehicleColor,
  };
}

export function toDetail(order: OrderWithAssignedDriver): OrderDetail {
  return {
    id: order.id,
    order_no: order.orderNo,
    customer_name: order.customerName,
    pickup_location: order.pickupLocation,
    destination: order.destination,
    scheduled_at: order.scheduledAt.toISOString(),
    vehicle_type: order.vehicleType,
    price: priceNumber(order.price),
    note: order.note,
    status: order.status,
    dispatch_mode: order.dispatchMode,
    driver_id: order.driverId,
    driver: toAssignedDriver(order.driver),
    created_by: order.createdBy,
    accepted_at: iso(order.acceptedAt),
    started_at: iso(order.startedAt),
    completed_at: iso(order.completedAt),
    cancelled_at: iso(order.cancelledAt),
    created_at: order.createdAt.toISOString(),
    updated_at: order.updatedAt.toISOString(),
  };
}

export function toDriverMyOrder(order: DriverMyOrderRow): DriverMyOrder {
  return {
    id: order.id,
    order_no: order.orderNo,
    scheduled_at: order.scheduledAt.toISOString(),
    pickup_location: order.pickupLocation,
    destination: order.destination,
    vehicle_type: order.vehicleType,
    price: priceNumber(order.price),
    status: order.status,
  };
}

export function toDriverOpenOrder(order: DriverOpenOrderRow): DriverOpenOrder {
  return {
    id: order.id,
    order_no: order.orderNo,
    scheduled_at: order.scheduledAt.toISOString(),
    pickup_location: order.pickupLocation,
    destination: order.destination,
    vehicle_type: order.vehicleType,
    price: priceNumber(order.price),
    note: order.note,
  };
}

export function toDriverOrderDetail(
  order: DriverOrderDetailRow,
): DriverOrderDetail {
  return {
    id: order.id,
    order_no: order.orderNo,
    customer_name: order.customerName,
    pickup_location: order.pickupLocation,
    destination: order.destination,
    scheduled_at: order.scheduledAt.toISOString(),
    vehicle_type: order.vehicleType,
    price: priceNumber(order.price),
    note: order.note,
    status: order.status,
  };
}
