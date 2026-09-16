# 白牌司機群派車系統
## System Architecture Specification v0.1

Version: v0.1  
Status: 第一版定案  
適用階段: MVP

---

## 1. Architecture Overview

系統採用 **Modular Monolith** 架構。

整體架構：

```text
Admin Web ───────┐
                 │
Driver Web/PWA ──┼──► REST API ──► NestJS
                 │                   │
                 │                   ├── PostgreSQL
                 │                   │
                 │                   └── Web Push
                 │
                 └──────────────────────────────►
```

主要資料流：

```text
Frontend
    ↓
REST API
    ↓
NestJS Modular Monolith
    ↓
PostgreSQL
```

通知流程：

```text
NestJS
    ↓
Web Push
    ↓
Driver Browser / PWA
```

MVP 不使用：

```text
Redis
WebSocket
SSE
Message Queue
API Gateway
Microservices
Kubernetes
```

架構原則：

- Frontend 不直接存取 Database。
- Backend 是所有 Business Logic 的最終權威。
- PostgreSQL 負責主要資料與資料一致性。
- Notification 與 Order Status 分離。
- 以單一 Backend Application 維持模組化，不提前拆分 Microservices。

---

## 2. System Components

### 2.1 Admin Web

負責：

- Admin Login
- Dashboard
- 訂單管理
- 建立訂單
- 編輯 DRAFT
- Publish Order
- Cancel Order
- Driver Management
- 查看 ONLINE Driver 最新位置（Phase 2 / P2-01）

Admin Web 透過 REST API 與 Backend 溝通。

---

### 2.2 Driver Web / PWA

負責：

- Driver Login
- ONLINE / OFFLINE
- GPS location reporting while ONLINE（Browser Geolocation）
- 查看 OPEN Orders
- 查看 Order Detail
- Accept Order
- Start Order
- Complete Order
- 查看自己的歷史訂單
- 接收 Web Push Notification

Driver Web / PWA 透過 REST API 與 Backend 溝通。

---

### 2.3 REST API

Base Path：

```text
/api/v1
```

負責：

- Authentication
- Authorization
- Driver Management
- Order Management
- Driver Order Operations
- Driver Status
- Driver Location（latest GPS only）
- Notification

Frontend 只負責：

- UI
- User Interaction
- Client-side Validation
- API Request / Response Handling

Frontend 不負責最終 Business Rule。

---

### 2.4 NestJS Backend

Backend 採 Modular Monolith。

```text
src/
├── auth/
├── users/
├── drivers/
├── orders/
├── order-events/
├── notifications/
└── common/
```

---

## 3. Backend Modules

### 3.1 Auth Module

負責：

- Login
- Session
- Logout
- Authentication
- AuthGuard
- Role Authorization

---

### 3.2 Users Module

負責：

- User Account
- Username
- Password Hash
- Role
- Account Status

User 是登入帳號。

---

### 3.3 Drivers Module

負責：

- Driver Profile
- Vehicle Data
- ONLINE / OFFLINE Status
- Latest GPS location（`latitude` / `longitude` / `location_updated_at`）
- Driver Account Management

Driver 與 User 為：

```text
User 1 : 0..1 Driver
```

Phase 2 / P2-01：只覆寫最新位置，不保存 location history。
---

### 3.4 Orders Module

Orders Module 是 Order Business Logic 的主要入口。

負責：

- Create Order
- Update DRAFT Order
- Publish Order
- Accept Order
- Start Order
- Complete Order
- Cancel Order

基本程式責任：

```text
Controller
    ↓
Service
    ↓
Database
```

Controller 不直接處理核心 Business Logic。

---

### 3.5 Order Events Module

負責：

- Process History（寫入 `order_events`）
- Audit Log
- Troubleshooting

MVP **不**提供 Order Events 讀取 API，也 **不**提供 Timeline UI。

主要 Event（僅 lifecycle 成功寫入）：

```text
ORDER_CREATED
ORDER_PUBLISHED
ORDER_ACCEPTED
ORDER_STARTED
ORDER_COMPLETED
ORDER_CANCELLED
```

OrderEvent 是歷程紀錄，不是主要 Concurrency Control。

---

### 3.6 Notifications Module

負責：

- Notification Record
- Push Subscription
- Web Push

通知流程：

```text
Order Published
    ↓
建立 Notification
    ↓
Web Push
```

Push 失敗不會改變 Order Status。

---

### 3.7 Common Module

共用：

```text
common/
├── guards/
├── decorators/
├── filters/
├── errors/
└── utils/
```

用途：

- Authentication / Authorization Guard
- Exception Handling
- Error Mapping
- Shared Decorators
- Shared Utilities

---

## 4. Authentication

### 4.1 Authentication Method

MVP 使用：

```text
Session + HttpOnly Cookie
```

API：

```http
POST /api/v1/auth/login
GET  /api/v1/auth/me
POST /api/v1/auth/logout
```

Cookie 建議：

```text
HttpOnly
Secure
SameSite=Lax
```

Driver 帳號狀態為 `SUSPENDED` 時，Login 失敗，回傳 `ACCOUNT_SUSPENDED`。

Admin 將 Driver 設為 `SUSPENDED` 時，該 user 的現有 active session 立即撤銷；後續 API 依既有 Session Validation 回 `401`。恢復 `ACTIVE` 時不建立新 session，需重新登入。

---

### 4.2 Password

密碼不可儲存明文。

Database 儲存：

```text
password_hash
```

Login 時由 Backend 驗證 Password Hash。

---

### 4.3 Session

Session 儲存在 PostgreSQL。

建議資料結構：

```text
Session
├─ id
├─ user_id
├─ expires_at
├─ revoked_at
└─ created_at
```

Session 設計：

```text
User
 └── 0..1 Active Session
```

> `sessions` 為 Authentication 的系統資料，實作時應同步納入 Database Schema。

---

### 4.4 Single Active Session

MVP 採用：

> 同一個 User 同時間只允許一個有效登入 Session。

新的 Login 成功後：

```text
New Login
    ↓
Validate Credentials
    ↓
Revoke Previous Session
    ↓
Create New Session
    ↓
Set HttpOnly Cookie
```

舊裝置不需要 WebSocket / SSE。

舊 Session 被撤銷後，舊裝置下一次 API Request：

```text
Session Validation
    ↓
Invalid / Revoked
    ↓
401 UNAUTHORIZED
    ↓
Frontend Logout
```

適用於：

```text
ADMIN
DRIVER
```

---

## 5. Authorization

系統 Role：

```text
ADMIN
DRIVER
```

### 5.1 Authentication

所有需要登入的 API：

```text
Request
    ↓
Session Valid?
```

無有效 Session：

```text
401 UNAUTHORIZED
```

---

### 5.2 Role Authorization

Backend 根據 User Role 控制 API 權限。

建議：

```text
AuthGuard
    ↓
RoleGuard
```

例如：

```text
GET /api/v1/drivers
        ↓
Authenticated
        ↓
Role = ADMIN
        ↓
Allowed
```

Driver 呼叫 Admin-only API：

```text
403 FORBIDDEN
```

---

## 6. Resource Ownership

Role 之外，Driver API 必須進行資源權限檢查。

例如：

```text
GET /api/v1/driver/orders/:id
```

允許：

```text
Order.status = OPEN
或
order.driver_id == current_driver.id
```

禁止：

```text
查看其他 Driver 的已接單
```

Driver 不可透過修改 Order ID 取得其他 Driver 的已接單資料。

Start / Complete 必須確認：

```text
order.driver_id == current_driver.id
```

基本規則：

```text
Driver
├─ View OPEN Order             ✅
├─ Accept OPEN Order           ✅
├─ View Own Order              ✅
├─ Start Own Order             ✅
├─ Complete Own Order          ✅
├─ Update / Read Own Location  ✅
├─ View Other Driver Order     ❌
├─ View Other Driver Location  ❌
└─ Cancel Order                ❌

Admin
├─ View All Orders             ✅
├─ Manage Drivers              ✅
├─ View Online Driver Locations ✅
└─ Cancel Order                ✅
```

---

## 7. Order State Management

Order Status：

```text
DRAFT
OPEN
ACCEPTED
IN_PROGRESS
COMPLETED
CANCELLED
```

### 7.1 Allowed Transitions

```text
DRAFT
  └──► OPEN

OPEN
  ├──► ACCEPTED
  └──► CANCELLED

ACCEPTED
  ├──► IN_PROGRESS
  └──► CANCELLED

IN_PROGRESS
  └──► COMPLETED
```

其他狀態轉換一律禁止。

---

### 7.2 DRAFT

DRAFT 為尚未正式發布的訂單。

允許：

```text
Edit
Publish
Delete
```

規則：

```text
DRAFT → OPEN      ✅
DRAFT → DELETE    ✅
```

DRAFT Delete 為 Hard Delete。

---

### 7.3 OPEN

OPEN 為正式開放 Driver 搶單的訂單。

允許：

```text
Driver Accept
Admin Cancel
```

禁止：

```text
Edit
Hard Delete
```

規則：

```text
OPEN → ACCEPTED   ✅
OPEN → CANCELLED  ✅
```

沒有：

```text
Expiry
Timeout
Auto Cancel
```

OPEN 會持續存在，直到 Driver 成功接單或 Admin 取消。

---

### 7.4 ACCEPTED

代表已有 Driver 成功取得訂單。

```text
driver_id = assigned driver
```

允許：

```text
Start
Admin Cancel
```

禁止：

```text
Other Driver Accept
Edit
Delete
```

---

### 7.5 IN_PROGRESS

表示 Driver 已經開始執行訂單。

唯一允許轉換：

```text
IN_PROGRESS → COMPLETED
```

MVP 不允許 Admin 取消 IN_PROGRESS Order。

---

### 7.6 COMPLETED

Terminal State。

不可：

```text
Cancel
Reopen
Edit
Reassign
```

---

### 7.7 CANCELLED

Terminal State。

不可：

```text
Restore
Reopen
Edit
Reassign
```

如需重新處理，建立新的 Order。

---

## 8. Driver Order Business Rules

### 8.1 Accept Conditions

Driver 執行：

```http
POST /api/v1/driver/orders/:id/accept
```

必須同時符合：

```text
1. Order.status = OPEN
2. Driver.online_status = ONLINE
3. Driver account status = ACTIVE
4. Driver 沒有 ACCEPTED Order
5. Driver 沒有 IN_PROGRESS Order
```

任一條件不符合，Accept 失敗。

---

### 8.2 One Active Order per Driver

Driver 的未完成訂單定義：

```text
ACCEPTED
IN_PROGRESS
```

同一 Driver 同時間最多只能持有一張未完成 Order。

例如：

```text
Order 001 = ACCEPTED
Order 002 = ACCEPT
```

Order 002 必須失敗。

Order 001 完成或取消後，Driver 才能再次接單。

---

### 8.3 Driver Online / Offline

Driver Status：

```text
ONLINE
OFFLINE
```

ONLINE / OFFLINE 與 Order Status 分離。

OFFLINE：

```text
不能接新單
不接收新訂單通知
```

Driver 即使有：

```text
ACCEPTED
IN_PROGRESS
```

仍然可以切換 OFFLINE。

切換 OFFLINE 不會修改 Order Status。

### 8.3.1 Driver GPS Location Lifecycle（Phase 2 / P2-01）

產品規則見 `PHASE-2-SPEC.md`（P2-01）。

座標來源：

```text
Browser Geolocation API
        ↓
Driver Web / PWA
        ↓
PATCH /api/v1/driver/location
        ↓
Backend 覆寫 drivers 最新位置
```

Lifecycle：

```text
Driver → ONLINE
        ↓
立即請求第一次 Geolocation
        ↓
之後每 30 秒更新一次
        ↓
Driver → OFFLINE
        ↓
停止 GPS 更新
        ↓
保留最後一次有效位置（不清空）
```

失敗規則：

- GPS 權限拒絕、定位失敗，或 location API 失敗：**不得**改變 `ONLINE` / `OFFLINE`
- 失敗時保留最後一次有效位置；於下一個 30 秒週期再重試

範圍限制：

- Backend 只儲存最新有效位置
- Phase 2 **不**實作 location history
- Phase 2 **不**實作 WebSocket / SSE 等 real-time tracking infrastructure

---

### 8.4 Driver Account Status

```text
ACTIVE
→ 正常使用

SUSPENDED
→ 不可登入
→ 不可搶新單
→ 現有 active session 立即失效
```

既有訂單不因 `SUSPENDED` 自動取消。恢復 `ACTIVE` 時不建立新 session，需重新登入。

---

## 9. Concurrency Control

Concurrency Control 的核心目標：

> 同一張 OPEN Order 在多人同時操作時，只能有一名 Driver 成功接單。

例如：

```text
Driver A ─┐
Driver B ─┼──► Accept
Driver C ─┘
            ↓
       PostgreSQL
```

結果：

```text
One Driver → SUCCESS
Others     → FAILED
```

---

### 9.1 Accept Transaction

Accept Order 必須由 Backend Service 執行 Database Transaction。

概念流程：

```text
BEGIN TRANSACTION
    ↓
Validate Driver eligibility
    ↓
Atomically claim OPEN Order
    ↓
If successful:
    ├─ Set driver_id
    ├─ Set status = ACCEPTED
    ├─ Set accepted_at
    └─ Create ORDER_ACCEPTED event
    ↓
COMMIT
```

---

### 9.2 Atomic Order Claim

核心更新必須帶有：

```text
WHERE id = :orderId
AND status = 'OPEN'
```

概念：

```sql
UPDATE orders
SET
  status = 'ACCEPTED',
  driver_id = :driverId,
  accepted_at = NOW()
WHERE id = :orderId
  AND status = 'OPEN';
```

若只有一個 Request 成功更新資料，只有該 Driver 可以取得 Order。

其他同時請求若更新筆數為 `0`：

```text
ORDER_ALREADY_ACCEPTED
```

---

### 9.3 Driver Active Order Constraint

Database 需額外保護：

```text
同一 Driver 最多一張
ACCEPTED / IN_PROGRESS
```

建議 PostgreSQL Partial Unique Index：

```sql
CREATE UNIQUE INDEX
idx_one_active_order_per_driver
ON orders (driver_id)
WHERE status IN ('ACCEPTED', 'IN_PROGRESS');
```

這是 Database 的最後一道保護。

Business Rule 由 Service 執行，Database Constraint 負責防止 Race Condition 或程式漏洞破壞資料一致性。

---

### 9.4 Accept Failure

常見原因：

```text
DRIVER_OFFLINE
DRIVER_HAS_ACTIVE_ORDER
ORDER_ALREADY_ACCEPTED
INVALID_ORDER_STATUS
```

例如：

```json
{
  "success": false,
  "error": {
    "code": "ORDER_ALREADY_ACCEPTED",
    "message": "此訂單已被其他司機接單"
  }
}
```

---

## 10. Order Event Architecture

Order Event 是 Order Lifecycle 的歷程紀錄。

範例：

```text
Order Created
     ↓
ORDER_CREATED

Publish
     ↓
ORDER_PUBLISHED

Driver Accept
     ↓
ORDER_ACCEPTED

Start
     ↓
ORDER_STARTED

Complete
     ↓
ORDER_COMPLETED
```

事件應在對應 Business Operation 成功後記錄。

OrderEvent 不取代 Order Status。

Order Status：

```text
目前狀態
```

OrderEvent：

```text
歷史發生過什麼
```

---

## 11. Notification Architecture

MVP 使用：

```text
Web Push
```

### 11.1 Publish Notification Flow

Admin Publish：

```text
DRAFT
  ↓
Publish Order
  ↓
Order = OPEN
  ↓
Find eligible Drivers
  ↓
Create Notification
  ↓
Send Web Push
```

通知對象：

```text
User role = DRIVER
User status = ACTIVE
Driver online_status = ONLINE
有效 PushSubscription
```

即使 Driver 目前持有 `ACCEPTED` / `IN_PROGRESS` Order，仍建立 Notification 並發送 Web Push。

Accept 資格維持既有規則，不因通知資格放寬而改變。

實際發送時，該 Order 必須仍為 `OPEN`。已不是 `OPEN` 的 PENDING Notification 不發送。

---

### 11.2 Notification and Order Separation

Notification Status：

```text
PENDING
SENT
FAILED
```

Notification 欄位：

```text
id
user_id
order_id
status
created_at
sent_at
```

Web Push 的 title / body 不存入 Notification。

Notification failure 不影響：

```text
Order.status
```

例如：

```text
Order = OPEN
Push = FAILED
```

仍然維持：

```text
Order = OPEN
```

Driver 仍可以透過 Open Orders 頁面查看。

---

### 11.3 Push Subscription

Push Subscription 用於記錄「通知送到哪裡」。

同一 User 同時間只保留一筆有效 PushSubscription：

```text
新 subscription 取代舊的
Logout / unsubscribe 移除目前這筆 subscription
```

Push Subscription 與 Notification 分工：

```text
PushSubscription
= Push delivery destination

Notification
= Notification record / status
```

---

## 12. Error Handling

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
    "code": "ERROR_CODE",
    "message": "錯誤訊息"
  }
}
```

核心 Error Codes：

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

Backend 負責產生標準化 Error Code。

Frontend 根據 Error Code 決定 UI 行為。

---

## 13. Core System Flows

### 13.1 Admin Create Order

```text
Admin
  ↓
POST /orders
  ↓
Orders Module
  ↓
Create Order
  ↓
status = DRAFT
  ↓
ORDER_CREATED
```

---

### 13.2 Admin Publish Order

```text
Admin
  ↓
POST /orders/:id/publish
  ↓
Validate DRAFT
  ↓
Order = OPEN
  ↓
ORDER_PUBLISHED
  ↓
Find eligible ONLINE Drivers
（ACTIVE + 有效 PushSubscription；
可含已有未完成 Order 的 Driver）
  ↓
Create Notification
  ↓
Web Push
（僅當 Order 仍為 OPEN）
```

---

### 13.3 Driver Accept Order

```text
Driver
  ↓
POST /driver/orders/:id/accept
  ↓
Auth
  ↓
Authorization
  ↓
Driver Eligibility Check
  ↓
Database Transaction
  ↓
Atomic Order Claim
  ↓
Order = ACCEPTED
  ↓
ORDER_ACCEPTED
```

若失敗：

```text
Accept
  ↓
Order already claimed
  ↓
ORDER_ALREADY_ACCEPTED
```

---

### 13.4 Driver Start / Complete

```text
ACCEPTED
    ↓
POST /start
    ↓
IN_PROGRESS
    ↓
POST /complete
    ↓
COMPLETED
```

每次狀態轉換：

```text
Validate
    ↓
Update Order
    ↓
Create OrderEvent
```

---

### 13.5 Admin Cancel

```text
OPEN / ACCEPTED
       ↓
POST /cancel
       ↓
CANCELLED
       ↓
ORDER_CANCELLED
```

MVP：

```text
IN_PROGRESS → Cancel ❌
COMPLETED    → Cancel ❌
CANCELLED    → Cancel ❌
```

---

## 14. Database Responsibility

PostgreSQL 負責：

- Persistent Data
- Referential Integrity
- Unique Constraints
- Partial Unique Index
- Transaction
- Concurrency Safety

Prisma 負責：

- Database Access
- Schema Definition
- Migration
- Type-safe Query

Database 為 Business Data 的最終來源。

---

## 15. Deployment Architecture

MVP 使用 Docker。

概念部署：

```text
┌──────────────────────────────┐
│            Server            │
│                              │
│  ┌────────────┐              │
│  │ Frontend   │              │
│  └─────┬──────┘              │
│        │                     │
│  ┌─────▼──────┐              │
│  │ NestJS API │              │
│  └─────┬──────┘              │
│        │                     │
│  ┌─────▼──────────┐          │
│  │  PostgreSQL    │          │
│  └────────────────┘          │
│                              │
└──────────────────────────────┘

NestJS
   │
   └────► Web Push Provider
```

MVP 不需要 Microservices Deployment。

---

## 16. Architecture Principles

### 16.1 Backend First

所有重要 Business Rules：

```text
Backend
```

必須驗證。

Frontend 的 UI 限制不視為安全機制。

---

### 16.2 Database as Final Safety Layer

涉及資料一致性的規則：

```text
Order State
Driver Active Order
Concurrent Accept
Unique Data
```

除 Backend Service 外，由 PostgreSQL 提供最後保護。

---

### 16.3 Single Source of Truth

目前：

```text
Order Status
    → orders.status

Order History
    → order_events

Notification State
    → notifications.status

Login Session
    → sessions
```

每一類資料維持單一主要來源。

---

### 16.4 Keep MVP Simple

MVP 優先：

```text
Simple
Predictable
Maintainable
Reliable
```

只有在實際需求出現後，再加入：

```text
Redis
Realtime Connection
Message Queue
Advanced Dispatch（Phase 3）
Microservices
```

---

### 16.5 Product Phase Roadmap

產品階段與架構擴充對齊：

```text
Phase 1 — 核心派車 MVP（目前）
Phase 2 — Driver Location & Trip Information
Phase 3 — Advanced Dispatch & Communication
```

產品範圍以 `PHASE-2-SPEC.md` 為準。

**Phase 2 / P2-01（已對齊）：**

- Browser Geolocation 取得 Driver GPS
- ONLINE / OFFLINE 控制 GPS 更新 lifecycle
- Backend 儲存最新位置 only
- Admin 可讀 ONLINE Drivers 最新位置

**Phase 2 / P2-02 Pickup Geocoding（已對齊）：**

產品選定 **Google Geocoding API**。

```text
Create/Update Order 成功（文字 pickup_location 已存於 DB）
        ↓
立即回傳 API response（不等待 Google）
        ↓
Backend 非同步呼叫 Google Geocoding（server-side only）
        ↓
成功 → 將 lat/lng 保留於 Backend runtime（同一 Order + 目前地址可重用）
失敗 → Order 保留；不清空文字地址；不 rollback；Distance/Map 暫無 Pickup 點
```

架構規則：

- **不**把 Pickup lat/lng 寫入 PostgreSQL／Prisma Schema
- **不**由 Browser 呼叫 Provider
- **不**引入 Redis／獨立 queue／worker（現有架構無 queue）
- 使用 process-local async + memoization／single-flight：同一 Order 的同一 `pickup_location` 不因多名 Driver 重複打 Google
- `pickup_location` 修改 → 使舊 runtime 結果失效 → 重新 geocode
- timeout／provider error：有限次數的簡單延遲重試；`ZERO_RESULTS` 不對同一未改地址無限重試
- Secrets 僅 Environment Variables；錯誤不得外洩 API key
- P2-03 計算直線距離；P2-04 負責 Map／Navigation；本切片不做 Routes／ETA

殘餘注意（非 DB 永久儲存 blocker）：P2-04 內嵌地圖選定 **Google Maps JavaScript API**，與 Google Geocoding §6.2 一致。

**Phase 2 / P2-03 Straight-line Distance（已對齊）：**

```text
Driver latest GPS (drivers table, P2-01)
        +
Pickup transient coords (GeocodingService.getPickupCoordinates, P2-02)
        ↓
DistanceService（Backend）
        ↓
great-circle / Haversine → distance_meters
        ↓
附加於既有 Driver Order 讀取 API
Admin：GET /api/v1/orders/:id/online-driver-distances
```

架構規則：

- **負責：** Backend `DistanceService`（計算）；取得 Pickup 座標**只**透過既有 `GeocodingService.getPickupCoordinates`
- **不**新增公開 Geocoding／Distance-only 對外計算 endpoint 供任意地址查詢
- **不**把 Distance 或 Pickup lat/lng 寫入 PostgreSQL
- **不**引入 Redis／Queue／Worker
- **不**呼叫 Google Routes API；**不**計算道路距離／ETA
- 缺任一座標 → API 回 `distance_meters: null`；UI 不顯示 Distance
- Driver 只能看到自己的 Distance；Admin 只看 ONLINE Drivers ↔ 指定 Order Pickup
- Distance 為參考資訊；**不**改變 Phase 1 claim／Order State
- Canonical API field：`distance_meters: number | null`
- UI 單位：`< 1 km` → meters；`>= 1 km` → kilometers；標示「直線距離」；顯示捨入精度仍 open

**Phase 2 / P2-04 Map & Google Maps Navigation（已對齊）：**

```text
Frontend（Vue）
  ├── Google Maps JavaScript API（in-app map）
  ├── Driver Order Detail：own GPS (P2-01) + Pickup (runtime P2-02) + distance_meters (P2-03)
  ├── Admin Order / Dispatch：ONLINE Drivers + Pickup
  └── Start Navigation → Google Maps handoff（external；no in-app routing）
```

架構規則：

- Map SDK：**Google Maps JavaScript API**
- Pickup lat/lng：**不**寫入 DB；API 僅以 ephemeral `pickup_latitude`／`pickup_longitude` 提供給 Map（Order Detail 讀取）
- 沿用 P2-01／P2-02／P2-03；**不**引入 WebSocket／SSE／Redis／Queue／Worker
- **不**呼叫 Google Routes API；**不**做道路距離／ETA／App 內 turn-by-turn
- Geocoding server key 僅 Backend；Maps JS 使用分開的 Frontend-restricted key
- Map／導航失敗不得影響 Order／Accept／Online／Offline

Phase 2 **不**包含：自動派車、AI Dispatch、進階派車、通訊整合、location history、道路距離、ETA、以 Google Routes API 做距離／ETA、App 內 turn-by-turn。

**Phase 3** 為後續規劃（僅簡述）：

- Advanced Dispatch：自動派車、AI Dispatch、Priority / 自動重派、進階車隊追蹤
- Communication：第三方通訊整合（不指定服務或技術方案）

詳細需求於進入該 Phase 時再定義。

---

## 17. Future Extension

未來若需要更高即時性或更大規模，可擴充：

```text
Current

Frontend
   ↓
REST API
   ↓
NestJS
   ↓
PostgreSQL
```

未來：

```text
Frontend
   ↓
REST API
   ↓
NestJS
   ├── Redis
   ├── Queue
   ├── WebSocket / SSE
   └── PostgreSQL
```

若加入 Mobile App：

```text
Admin Web ─┐
Driver Web ├──► REST API ──► Backend
Mobile App ┘
```

Business Logic 維持在 Backend，不為不同 Client 重複實作。

---

## 18. Architecture Summary

```text
Frontend
 ├── Admin Web
 └── Driver Web / PWA
          │
          ▼
      REST API
          │
          ▼
   NestJS Modular Monolith
    ├── Auth
    ├── Users
    ├── Drivers
    ├── Orders
    ├── Order Events
    └── Notifications
          │
          ├────────► PostgreSQL
          │
          └────────► Web Push
```

核心設計原則：

```text
Authentication
→ Session + HttpOnly Cookie
→ Single Active Session

Authorization
→ ADMIN / DRIVER
→ RoleGuard
→ Resource Ownership

Order
→ State Machine
→ Backend Business Rules

Concurrency
→ PostgreSQL Transaction
→ Atomic Update
→ Partial Unique Index

Notification
→ Web Push
→ Independent from Order Status

Architecture
→ Modular Monolith
→ PostgreSQL
→ Docker
```
