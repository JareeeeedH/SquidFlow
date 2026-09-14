# 白牌司機群派車系統
## API Specification v0.1

**Version：** v0.1  
**Status：** 第一版定案  
**API Style：** REST API  
**Base URL：** `/api/v1`  
**Authentication：** Session + HttpOnly Cookie

---

# 1. Authentication

## Login

```http
POST /api/v1/auth/login
```

### Request

```json
{
  "username": "driver001",
  "password": "********"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "driver001",
    "role": "DRIVER"
  }
}
```

### Error

```text
INVALID_CREDENTIALS
ACCOUNT_SUSPENDED
```

`SUSPENDED` 帳號不可登入。

---

## Get Current User

```http
GET /api/v1/auth/me
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "driver001",
    "role": "DRIVER",
    "status": "ACTIVE"
  }
}
```

---

## Logout

```http
POST /api/v1/auth/logout
```

### Response

```json
{
  "success": true,
  "data": null
}
```

---

# 2. Admin — Driver

## List Drivers

```http
GET /api/v1/drivers
```

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "username": "driver001",
      "vehicle_type": "5人座",
      "license_plate": "ABC-1234",
      "vehicle_brand": "Toyota",
      "vehicle_model": "Camry",
      "vehicle_color": "黑色",
      "vehicle_year": 2024,
      "online_status": "ONLINE",
      "status": "ACTIVE"
    }
  ]
}
```

---

## Create Driver

```http
POST /api/v1/drivers
```

### Request

```json
{
  "username": "driver001",
  "password": "********",
  "vehicle_type": "5人座",
  "license_plate": "ABC-1234",
  "vehicle_brand": "Toyota",
  "vehicle_model": "Camry",
  "vehicle_color": "黑色",
  "vehicle_year": 2024
}
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "driver001",
    "vehicle_type": "5人座",
    "license_plate": "ABC-1234",
    "vehicle_brand": "Toyota",
    "vehicle_model": "Camry",
    "vehicle_color": "黑色",
    "vehicle_year": 2024,
    "online_status": "OFFLINE",
    "status": "ACTIVE"
  }
}
```

---

## Get Driver

```http
GET /api/v1/drivers/:id
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "driver001",
    "vehicle_type": "5人座",
    "license_plate": "ABC-1234",
    "vehicle_brand": "Toyota",
    "vehicle_model": "Camry",
    "vehicle_color": "黑色",
    "vehicle_year": 2024,
    "online_status": "ONLINE",
    "status": "ACTIVE"
  }
}
```

---

## Update Driver

```http
PUT /api/v1/drivers/:id
```

### Request

```json
{
  "username": "driver001",
  "password": "********",
  "vehicle_type": "5人座",
  "license_plate": "ABC-1234",
  "vehicle_brand": "Toyota",
  "vehicle_model": "Camry",
  "vehicle_color": "黑色",
  "vehicle_year": 2024
}
```

### Response

同 `GET /api/v1/drivers/:id`

---

## Update Driver Status

```http
PATCH /api/v1/drivers/:id/status
```

將 Driver 帳號狀態設為 `ACTIVE` 或 `SUSPENDED`。

`SUSPENDED`：不可登入、不可搶新單。

既有訂單不因 `SUSPENDED` 自動取消。

### Request

```json
{
  "status": "SUSPENDED"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "SUSPENDED"
  }
}
```

---

# 3. Admin — Order

## List Orders

```http
GET /api/v1/orders
```

### Query Parameters

```text
status
date
search
```

`search` 用於搜尋：

```text
order_no
customer_name
```

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "order_no": "ORD-20260915-001",
      "customer_name": "王先生",
      "pickup_location": "左營高鐵站",
      "destination": "高雄小港機場",
      "scheduled_at": "2026-09-15T15:30:00+08:00",
      "vehicle_type": "5人座",
      "price": 1200,
      "note": "2件行李",
      "status": "OPEN",
      "driver_id": null
    }
  ]
}
```

---

## Create Order

```http
POST /api/v1/orders
```

### Request

```json
{
  "customer_name": "王先生",
  "pickup_location": "左營高鐵站",
  "destination": "高雄小港機場",
  "scheduled_at": "2026-09-15T15:30:00+08:00",
  "vehicle_type": "5人座",
  "price": 1200,
  "note": "2件行李"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "order_no": "ORD-20260915-001",
    "status": "DRAFT",
    "dispatch_mode": "OPEN"
  }
}
```

---

## Get Order

```http
GET /api/v1/orders/:id
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "order_no": "ORD-20260915-001",
    "customer_name": "王先生",
    "pickup_location": "左營高鐵站",
    "destination": "高雄小港機場",
    "scheduled_at": "2026-09-15T15:30:00+08:00",
    "vehicle_type": "5人座",
    "price": 1200,
    "note": "2件行李",
    "status": "ACCEPTED",
    "dispatch_mode": "OPEN",
    "driver_id": "driver-uuid",
    "created_by": "admin-uuid",
    "accepted_at": "2026-09-15T07:05:00Z",
    "started_at": null,
    "completed_at": null,
    "cancelled_at": null,
    "created_at": "2026-09-15T07:00:00Z",
    "updated_at": "2026-09-15T07:05:00Z"
  }
}
```

---

## Update Order

```http
PUT /api/v1/orders/:id
```

### Request

```json
{
  "customer_name": "王先生",
  "pickup_location": "左營高鐵站",
  "destination": "高雄小港機場",
  "scheduled_at": "2026-09-15T15:30:00+08:00",
  "vehicle_type": "5人座",
  "price": 1200,
  "note": "2件行李"
}
```

僅允許 `DRAFT`。

### Response

同 `GET /api/v1/orders/:id`

---

## Delete Order

```http
DELETE /api/v1/orders/:id
```

僅允許 `DRAFT`。

### Response

```json
{
  "success": true,
  "data": null
}
```

---

## Publish Order

```http
POST /api/v1/orders/:id/publish
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "OPEN"
  }
}
```

---

## Cancel Order

```http
POST /api/v1/orders/:id/cancel
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "CANCELLED"
  }
}
```

允許：

```text
OPEN
ACCEPTED
```

---

## Get Order Events

```http
GET /api/v1/orders/:id/events
```

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "event_type": "ORDER_CREATED",
      "actor_user_id": "uuid",
      "metadata": {},
      "created_at": "2026-09-15T07:00:00Z"
    },
    {
      "id": "uuid",
      "event_type": "ORDER_PUBLISHED",
      "actor_user_id": "uuid",
      "metadata": {},
      "created_at": "2026-09-15T07:02:00Z"
    }
  ]
}
```

---

# 4. Driver — Order

## List My Orders

```http
GET /api/v1/driver/orders
```

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "order_no": "ORD-20260915-001",
      "scheduled_at": "2026-09-15T15:30:00+08:00",
      "pickup_location": "左營高鐵站",
      "destination": "高雄小港機場",
      "vehicle_type": "5人座",
      "price": 1200,
      "status": "COMPLETED"
    }
  ]
}
```

僅回傳目前登入 Driver 的訂單。

---

## List Open Orders

```http
GET /api/v1/driver/orders/open
```

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "order_no": "ORD-20260915-001",
      "scheduled_at": "2026-09-15T15:30:00+08:00",
      "pickup_location": "左營高鐵站",
      "destination": "高雄小港機場",
      "vehicle_type": "5人座",
      "price": 1200,
      "note": "2件行李"
    }
  ]
}
```

僅回傳：

```text
status = OPEN
```

且目前 Driver：

```text
online_status = ONLINE
```

並可接單的訂單。

---

## Get Driver Order

```http
GET /api/v1/driver/orders/:id
```

允許：

```text
status = OPEN
或目前登入 Driver 的已接單
```

禁止：

```text
其他 Driver 的已接單
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "order_no": "ORD-20260915-001",
    "customer_name": "王先生",
    "pickup_location": "左營高鐵站",
    "destination": "高雄小港機場",
    "scheduled_at": "2026-09-15T15:30:00+08:00",
    "vehicle_type": "5人座",
    "price": 1200,
    "note": "2件行李",
    "status": "ACCEPTED"
  }
}
```

---

## Accept Order

```http
POST /api/v1/driver/orders/:id/accept
```

### Request

無 Request Body。

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "ACCEPTED",
    "driver_id": "driver-uuid",
    "accepted_at": "2026-09-15T07:05:00Z"
  }
}
```

### Error

```text
ORDER_ALREADY_ACCEPTED
DRIVER_OFFLINE
DRIVER_HAS_ACTIVE_ORDER
INVALID_ORDER_STATUS
```

---

## Start Order

```http
POST /api/v1/driver/orders/:id/start
```

### Request

無 Request Body。

### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "IN_PROGRESS",
    "started_at": "2026-09-15T07:30:00Z"
  }
}
```

僅允許目前接單 Driver 執行。

---

## Complete Order

```http
POST /api/v1/driver/orders/:id/complete
```

### Request

無 Request Body。

### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "COMPLETED",
    "completed_at": "2026-09-15T08:20:00Z"
  }
}
```

僅允許目前接單 Driver 執行。

---

# 5. Driver — Online Status

## Update Status

```http
PATCH /api/v1/driver/status
```

### Request

```json
{
  "status": "ONLINE"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "status": "ONLINE"
  }
}
```

可用：

```text
ONLINE
OFFLINE
```

---

# 6. Notification

## List Notifications

```http
GET /api/v1/notifications
```

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "order_id": "order-uuid",
      "status": "SENT",
      "created_at": "2026-09-15T07:02:00Z",
      "sent_at": "2026-09-15T07:02:01Z"
    }
  ]
}
```

---

## Create Push Subscription

```http
POST /api/v1/notifications/subscription
```

### Request

```json
{
  "endpoint": "https://example.com/push/...",
  "p256dh": "public-key",
  "auth": "auth-key"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid"
  }
}
```

---

## Delete Push Subscription

```http
DELETE /api/v1/notifications/subscription
```

### Request

```json
{
  "endpoint": "https://example.com/push/..."
}
```

### Response

```json
{
  "success": true,
  "data": null
}
```

---

# 7. Order State Transition

| API | 前置狀態 | 成功後 |
|---|---|---|
| `POST /orders` | — | `DRAFT` |
| `PUT /orders/:id` | `DRAFT` | `DRAFT` |
| `DELETE /orders/:id` | `DRAFT` | Delete |
| `POST /orders/:id/publish` | `DRAFT` | `OPEN` |
| `POST /driver/orders/:id/accept` | `OPEN` | `ACCEPTED` |
| `POST /driver/orders/:id/start` | `ACCEPTED` | `IN_PROGRESS` |
| `POST /driver/orders/:id/complete` | `IN_PROGRESS` | `COMPLETED` |
| `POST /orders/:id/cancel` | `OPEN / ACCEPTED` | `CANCELLED` |

---

# 8. Authorization

所有 API 由 Backend 驗證角色與資源權限。

### Admin

```text
Driver Management
Order Management
Order Events
```

### Driver

```text
Open Orders
Own Orders
Accept
Start
Complete
Online / Offline
Notifications
```

---

# 9. Response Format

統一 Success Response：

```json
{
  "success": true,
  "data": {}
}
```

無資料：

```json
{
  "success": true,
  "data": null
}
```

統一 Error Response：

```json
{
  "success": false,
  "error": {
    "code": "ORDER_ALREADY_ACCEPTED",
    "message": "此訂單已被其他司機接單"
  }
}
```

常用 Error Code：

```text
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
INVALID_CREDENTIALS
ACCOUNT_SUSPENDED
DRIVER_OFFLINE
DRIVER_HAS_ACTIVE_ORDER
ORDER_ALREADY_ACCEPTED
INVALID_ORDER_STATUS
```

---

# 10. API Design Principles

- `/api/v1` 作為 API 版本
- REST API
- Session + HttpOnly Cookie
- 統一 Success / Error Response
- Business Logic 由 Backend 處理
- Order Status 由 Backend 控制
- 搶單唯一性由 Backend + PostgreSQL 保證
- Web 與未來 Mobile App 共用 API