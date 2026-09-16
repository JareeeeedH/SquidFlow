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
      "license_plate": "ABC-1234",
      "vehicle_brand": "Toyota",
      "vehicle_model": "Camry",
      "vehicle_color": "黑色",
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
  "license_plate": "ABC-1234",
  "vehicle_brand": "Toyota",
  "vehicle_model": "Camry",
  "vehicle_color": "黑色"
}
```

不接受 `vehicle_type`、`vehicle_year`。新 Driver 這兩欄為 `NULL`。

### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "driver001",
    "license_plate": "ABC-1234",
    "vehicle_brand": "Toyota",
    "vehicle_model": "Camry",
    "vehicle_color": "黑色",
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
    "license_plate": "ABC-1234",
    "vehicle_brand": "Toyota",
    "vehicle_model": "Camry",
    "vehicle_color": "黑色",
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
  "license_plate": "ABC-1234",
  "vehicle_brand": "Toyota",
  "vehicle_model": "Camry",
  "vehicle_color": "黑色"
}
```

不更新 `vehicle_type`、`vehicle_year`；既有資料保留。

### Response

同 `GET /api/v1/drivers/:id`

---

## Update Driver Status

```http
PATCH /api/v1/drivers/:id/status
```

將 Driver 帳號狀態設為 `ACTIVE` 或 `SUSPENDED`。

`SUSPENDED`：不可登入、不可搶新單。設為 `SUSPENDED` 時，該 user 的現有 active session 立即失效。

既有訂單不因 `SUSPENDED` 自動取消。恢復 `ACTIVE` 時不建立新 session，需重新登入。

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

`date` 為 Taipei 日曆日，篩選 `created_at`。列表依 `created_at` 降序。

未填寫的選填欄位回 `null`。不含 `scheduled_at`、`vehicle_type`。

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
      "price": 1200,
      "note": "2件行李",
      "status": "OPEN",
      "driver_id": null,
      "created_at": "2026-09-15T07:00:00Z"
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
  "price": 1200,
  "note": "2件行李"
}
```

`pickup_location` 必填。`customer_name`、`destination`、`price`、`note` 選填；未填或空字串存 `NULL`，不使用 `0`。不接受 `scheduled_at`、`vehicle_type`。

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
    "price": 1200,
    "note": "2件行李",
    "status": "ACCEPTED",
    "dispatch_mode": "OPEN",
    "driver_id": "driver-uuid",
    "driver": {
      "username": "driver001",
      "license_plate": "ABC-1234",
      "vehicle_brand": "Toyota",
      "vehicle_model": "Camry",
      "vehicle_color": "黑色"
    },
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

未指派司機時 `driver` 為 `null`。`driver` 只包含上述欄位，不含 `id`、`vehicle_type`、`vehicle_year`、`online_status`、帳號 `status`。選填欄位未填時為 `null`。不含 `scheduled_at`、訂單 `vehicle_type`。

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
  "price": 1200,
  "note": "2件行李"
}
```

欄位規則同 Create Order。僅允許 `DRAFT`。

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

# 3.1 Admin — Dashboard

```http
GET /api/v1/admin/dashboard
```

Admin-only。Driver 回 `403 FORBIDDEN`。

`summary` 由 Backend 聚合六種 Order Status 數量。  
`board_orders` 只包含 `DRAFT`、`OPEN`、`ACCEPTED`、`IN_PROGRESS`，供 Dispatch Board 使用。  
`COMPLETED` / `CANCELLED` 只出現在 `summary`，不進入 `board_orders`。

未指派司機時 `driver` 為 `null`。已指派時 `driver` 只含 `username`。

`board_orders` 依 `created_at` 降序。選填欄位未填時為 `null`。不含 `scheduled_at`、`vehicle_type`。

### Response

```json
{
  "success": true,
  "data": {
    "summary": {
      "DRAFT": 2,
      "OPEN": 4,
      "ACCEPTED": 3,
      "IN_PROGRESS": 2,
      "COMPLETED": 1,
      "CANCELLED": 0
    },
    "board_orders": [
      {
        "id": "uuid",
        "order_no": "ORD-20260915-001",
        "customer_name": "王先生",
        "pickup_location": "左營高鐵站",
        "destination": "高雄小港機場",
        "created_at": "2026-09-15T07:00:00Z",
        "price": 1200,
        "status": "ACCEPTED",
        "driver": {
          "username": "driver001"
        }
      }
    ]
  }
}
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
      "created_at": "2026-09-15T07:00:00Z",
      "pickup_location": "左營高鐵站",
      "destination": "高雄小港機場",
      "price": 1200,
      "status": "COMPLETED",
      "distance_meters": null
    }
  ]
}
```

僅回傳目前登入 Driver 的訂單。依 `created_at` 降序。  
`distance_meters`：僅在 `ACCEPTED`／`IN_PROGRESS` 且雙方座標可用時為 number；否則 `null`（見 §5C）。

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
      "created_at": "2026-09-15T07:00:00Z",
      "pickup_location": "左營高鐵站",
      "destination": "高雄小港機場",
      "price": 1200,
      "note": "2件行李",
      "distance_meters": 2450.5
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

並可接單的訂單。依 `created_at` 降序。  
`distance_meters`：該 Driver 自己的 GPS ↔ Pickup 直線距離（公尺）；缺座標則 `null`（見 §5C）。

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
    "created_at": "2026-09-15T07:00:00Z",
    "price": 1200,
    "note": "2件行李",
    "status": "ACCEPTED",
    "distance_meters": 2450.5
  }
}
```

`distance_meters`：僅在 `OPEN`／自己的 `ACCEPTED`／`IN_PROGRESS` 且雙方座標可用時為 number；否則 `null`（見 §5C）。

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

## Get Status

```http
GET /api/v1/driver/status
```

讀取目前登入 Driver 的 `online_status`。僅 `DRIVER`。`SUSPENDED` 回 `ACCOUNT_SUSPENDED`。

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

# 5A. Driver — Location（Phase 2 / P2-01）

Driver 以 Browser Geolocation 取得座標後，上報自己的最新位置。僅 `DRIVER`。`SUSPENDED` 回 `ACCOUNT_SUSPENDED`。

位置上報**不得**改變 `online_status`。GPS／上報失敗由 Client 於下一個週期重試；Backend 不因此將 Driver 設為 `OFFLINE`。

產品規則見 `PHASE-2-SPEC.md`（P2-01）。

## Update Own Location

```http
PATCH /api/v1/driver/location
```

### Request

```json
{
  "latitude": 22.6870123,
  "longitude": 120.3090456
}
```

### Validation

- 只接受 `latitude`、`longitude`
- 兩者皆必填，且必須為 number
- `latitude` 範圍：`-90` ～ `90`
- `longitude` 範圍：`-180` ～ `180`
- 驗證失敗回 `VALIDATION_ERROR`

Driver 只能更新**自己的**最新位置；不可指定其他 `driver_id` / `user_id`。

成功時覆寫 `drivers.latitude`、`drivers.longitude`，並寫入 `location_updated_at`（server time）。

### Response

```json
{
  "success": true,
  "data": {
    "latitude": 22.6870123,
    "longitude": 120.3090456,
    "location_updated_at": "2026-09-16T00:30:00.000Z"
  }
}
```

---

## Get Own Location

```http
GET /api/v1/driver/location
```

讀取目前登入 Driver 儲存的最新位置。僅 `DRIVER`。

尚未有有效位置時，座標與時間為 `null`。

### Response

```json
{
  "success": true,
  "data": {
    "latitude": 22.6870123,
    "longitude": 120.3090456,
    "location_updated_at": "2026-09-16T00:30:00.000Z"
  }
}
```

---

# 5B. Admin — Online Driver Locations（Phase 2 / P2-01）

## List Online Driver Locations

```http
GET /api/v1/drivers/online-locations
```

僅 `ADMIN`。回傳目前 `online_status = ONLINE` 的 Drivers 及其最新位置。

- 不含 `OFFLINE` Drivers（Online Drivers map 不需要顯示他們）
- 若某 ONLINE Driver 尚未有有效位置，仍列入清單，`latitude` / `longitude` / `location_updated_at` 為 `null`
- 不回傳道路距離、ETA，亦不呼叫 Google Routes API
- 本端點**不**附帶 Order Pickup Distance（見 P2-03 `GET /api/v1/orders/:id/online-driver-distances`）

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "username": "driver001",
      "license_plate": "ABC-1234",
      "online_status": "ONLINE",
      "latitude": 22.6870123,
      "longitude": 120.3090456,
      "location_updated_at": "2026-09-16T00:30:00.000Z"
    }
  ]
}
```

---

# 5C. Straight-line Distance（Phase 2 / P2-03）

產品規則見 `PHASE-2-SPEC.md`（P2-03）。

## Calculation contract（Backend internal）

- **負責模組：** Backend `DistanceService`（名稱可依實作調整；職責固定）
- **輸入：**
  - Driver 最新 GPS：讀取 `drivers.latitude` / `drivers.longitude`（P2-01）
  - Pickup 座標：呼叫既有 `GeocodingService.getPickupCoordinates(orderId, pickupLocation)`（P2-02 transient runtime；**不**讀 DB Pickup lat/lng 欄位——因為不存在）
- **算法：** SquidFlow 自行計算地表直線距離（great-circle／Haversine）。**不**呼叫 Google Routes API；**不**計算道路距離；**不**計算 ETA
- **輸出語意：** 公尺（meters）數值；缺任一座標 → 視為無法計算
- **持久化：** Distance **不**寫入 PostgreSQL；**不**新增 Distance 欄位；**不**引入 Redis／Queue／Worker
- **副作用：** Distance 計算**不得**改變 Order State、搶單條件、或 `ONLINE`／`OFFLINE`

## Canonical API field

所有對外 Distance 欄位統一為：

```text
distance_meters: number | null
```

- `number`：直線距離（公尺）
- `null`：Driver GPS 或缺 Pickup runtime 座標 → **不顯示** Distance（UI 必須隱藏，不得顯示 `0` 或假值）
- **不**在 P2-03 response 中回傳 Pickup lat/lng（座標仍由 P2-02 runtime 內部持有；地圖座標契約屬 P2-04）
- **不**回傳 `road_distance`、`eta`、Routes 相關欄位
- 顯示單位（`< 1 km` → meters；`>= 1 km` → kilometers）與「直線距離」標示由 UI 依產品規則處理；**顯示捨入精度仍 open**（見 `PHASE-2-SPEC.md` §11）

## Driver — Distance on related Orders

適用狀態：`OPEN`、`ACCEPTED`、`IN_PROGRESS`。  
僅計算**目前登入 Driver 自己的** GPS ↔ 該 Order Pickup。Driver **不可**取得其他 Driver 的 Distance。

在既有 Driver Order 讀取 API 上**附加** `distance_meters`（不新增獨立公開 Distance／Geocoding endpoint）：

| Endpoint | `distance_meters` |
|----------|-------------------|
| `GET /api/v1/driver/orders/open` | 每筆 OPEN Order；缺座標則 `null` |
| `GET /api/v1/driver/orders/:id` | 當 Order 為 `OPEN`，或為自己的 `ACCEPTED`／`IN_PROGRESS`；否則依既有授權；缺座標則 `null` |
| `GET /api/v1/driver/orders` | 僅當該筆為自己的 `ACCEPTED`／`IN_PROGRESS` 時可有值；`COMPLETED`／`CANCELLED` 等為 `null` |

### Example（Open Orders item）

```json
{
  "id": "uuid",
  "order_no": "ORD-20260915-001",
  "created_at": "2026-09-15T07:00:00Z",
  "pickup_location": "左營高鐵站",
  "destination": "高雄小港機場",
  "price": 1200,
  "note": "2件行李",
  "distance_meters": 2450.5
}
```

## Admin — Online Drivers ↔ Pickup（Order context）

```http
GET /api/v1/orders/:id/online-driver-distances
```

僅 `ADMIN`。回傳目前 `online_status = ONLINE` 的 Drivers，以及各自到**該 Order** Pickup 的直線距離。

用途：Dispatch／Dashboard／Order 情境下，Admin 查看 Online Drivers ↔ Pickup（產品已確認的 visibility；畫面配置仍 open）。

規則：

- **不含** `OFFLINE` Drivers
- 若某 ONLINE Driver 尚無有效 GPS，或該 Order 尚無可用 Pickup runtime 座標 → 該列 `distance_meters` 為 `null`（仍可列在清單中，與 P2-01 online-locations 缺座標語意一致）
- Pickup 座標只經 `GeocodingService.getPickupCoordinates`；**不**新增公開 Geocoding endpoint；**不**在本 response 回傳 Pickup lat/lng
- 本端點**不**影響搶單／Order State
- **不**回傳道路距離／ETA

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "username": "driver001",
      "license_plate": "ABC-1234",
      "online_status": "ONLINE",
      "latitude": 22.6870123,
      "longitude": 120.3090456,
      "location_updated_at": "2026-09-16T00:30:00.000Z",
      "distance_meters": 2450.5
    }
  ]
}
```

Dashboard `board_orders` **不**強制嵌入全量 Online Driver distances（避免 N×M payload；UI 於需要時對選定 Order 呼叫本端點）。畫面配置見 UI-UX／`PHASE-2-SPEC.md` open decisions。

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

### Driver

```text
Open Orders
Own Orders
Accept
Start
Complete
Online / Offline
Own Location
Notifications
```

### Admin

```text
Driver Management
Online Driver Locations
Order Management
Dashboard
Order Events
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
VALIDATION_ERROR
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

---

# 11. Product Phase API Boundary

```text
Phase 1 — 核心派車 MVP 端點
Phase 2 — Driver Location & Trip Information
Phase 3 — Advanced Dispatch & Communication
```

產品範圍以 `PHASE-2-SPEC.md` 為準。

**Phase 2 / P2-01（已定義）：**

- `PATCH /api/v1/driver/location` — Driver 上報最新位置
- `GET /api/v1/driver/location` — Driver 讀取自己的最新位置
- `GET /api/v1/drivers/online-locations` — Admin 讀取 ONLINE Drivers 最新位置

**Phase 2 / P2-02 Pickup Geocoding（已定義）：**

- Provider：**Google Geocoding API**；僅 Backend 呼叫
- **不**新增公開 Geocoding endpoint（含 Driver）
- Create／Update Order（含 `pickup_location` 變更）成功後：非同步觸發 geocode；**不**阻塞 API response；失敗**不** rollback Order
- Order API response **不**持久化回傳 DB 中的 Pickup lat/lng（因為不存 DB）
- 同一 Order 的 Pickup 不得因多名 Driver 讀取而各自打一次 Google Geocoding
- `pickup_location` 修改後必須重新 geocode；舊座標結果作廢
- **不**新增 Google Routes／道路距離／ETA endpoint
- Distance 所需座標：內部使用 `GeocodingService.getPickupCoordinates`（見 P2-03）；P2-02 不定義 Distance field shape

**Phase 2 / P2-03 Straight-line Distance（已定義）：**

- Backend `DistanceService`：Driver GPS（P2-01）+ Pickup transient coords（P2-02 `getPickupCoordinates`）→ great-circle／Haversine 公尺
- Canonical field：`distance_meters: number | null`（缺任一座標 → `null`；UI 不顯示）
- Driver：附加於 `GET /api/v1/driver/orders/open`、`GET /api/v1/driver/orders/:id`、`GET /api/v1/driver/orders`（visibility 見 §5C）
- Admin：`GET /api/v1/orders/:id/online-driver-distances`（僅 ONLINE Drivers ↔ 該 Order Pickup）
- **不**新增公開 Geocoding endpoint；**不**存 Distance／Pickup lat/lng 到 DB；**不**引入 Redis／Queue／Worker
- **不**影響 Phase 1 claim／Order State；**不**新增道路距離／ETA／Routes endpoint

**Phase 2 / P2-04：**

- 地圖／導航 contract 於後續同步時再定義
- Phase 2 **不**新增道路距離、ETA，或 Google Routes API 端點

**Phase 3** 僅為後續規劃：自動派車、AI Dispatch、Priority / 自動重派、進階車隊追蹤、第三方通訊整合。目前不定義 API。