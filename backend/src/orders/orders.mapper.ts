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
  created_by: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
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

export function toDetail(order: Order): OrderDetail {
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
    created_by: order.createdBy,
    accepted_at: iso(order.acceptedAt),
    started_at: iso(order.startedAt),
    completed_at: iso(order.completedAt),
    cancelled_at: iso(order.cancelledAt),
    created_at: order.createdAt.toISOString(),
    updated_at: order.updatedAt.toISOString(),
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
