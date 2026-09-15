# 白牌司機群派車系統
## Database Specification v0.1

**Version：** v0.1  
**Status：** 第一版定案  
**Database：** PostgreSQL  
**ORM：** Prisma

---

## 1. Tables

```text
users
drivers
orders
order_events
notifications
push_subscriptions
sessions
```

---

## 2. User

```text
User
├─ id
├─ username
├─ password_hash
├─ role
├─ status
├─ created_at
└─ updated_at
```

| 欄位 | 型態 | 必填 |
|---|---|:---:|
| `id` | UUID | ✅ |
| `username` | VARCHAR | ✅ |
| `password_hash` | VARCHAR | ✅ |
| `role` | ENUM | ✅ |
| `status` | ENUM | ✅ |
| `created_at` | TIMESTAMP WITH TIME ZONE | ✅ |
| `updated_at` | TIMESTAMP WITH TIME ZONE | ✅ |

```text
role:
ADMIN / DRIVER

status:
ACTIVE / SUSPENDED
```

---

## 3. Driver

```text
Driver
├─ id
├─ user_id
├─ vehicle_type
├─ license_plate
├─ vehicle_brand
├─ vehicle_model
├─ vehicle_color
├─ vehicle_year
├─ online_status
├─ created_at
└─ updated_at
```

| 欄位 | 型態 | 必填 |
|---|---|:---:|
| `id` | UUID | ✅ |
| `user_id` | UUID | ✅ |
| `vehicle_type` | VARCHAR | ❌ |
| `license_plate` | VARCHAR | ✅ |
| `vehicle_brand` | VARCHAR | ✅ |
| `vehicle_model` | VARCHAR | ✅ |
| `vehicle_color` | VARCHAR | ✅ |
| `vehicle_year` | SMALLINT | ❌ |
| `online_status` | ENUM | ✅ |
| `created_at` | TIMESTAMP WITH TIME ZONE | ✅ |
| `updated_at` | TIMESTAMP WITH TIME ZONE | ✅ |

```text
online_status:
ONLINE / OFFLINE
```

`vehicle_type` 與 `vehicle_year` 保留既有資料；新 Driver 不再寫入這兩欄，值為 `NULL`。

---

## 4. Order

```text
Order
├─ id
├─ order_no
├─ customer_name
├─ pickup_location
├─ destination
├─ price
├─ note
├─ status
├─ dispatch_mode
├─ driver_id
├─ created_by
├─ accepted_at
├─ started_at
├─ completed_at
├─ cancelled_at
├─ created_at
└─ updated_at
```

| 欄位 | 型態 | 必填 |
|---|---|:---:|
| `id` | UUID | ✅ |
| `order_no` | VARCHAR | ✅ |
| `customer_name` | VARCHAR | ❌ |
| `pickup_location` | TEXT | ✅ |
| `destination` | TEXT | ❌ |
| `price` | DECIMAL(10,2) | ❌ |
| `note` | TEXT | ❌ |
| `status` | ENUM | ✅ |
| `dispatch_mode` | ENUM | ✅ |
| `driver_id` | UUID | ❌ |
| `created_by` | UUID | ✅ |
| `accepted_at` | TIMESTAMP WITH TIME ZONE | ❌ |
| `started_at` | TIMESTAMP WITH TIME ZONE | ❌ |
| `completed_at` | TIMESTAMP WITH TIME ZONE | ❌ |
| `cancelled_at` | TIMESTAMP WITH TIME ZONE | ❌ |
| `created_at` | TIMESTAMP WITH TIME ZONE | ✅ |
| `updated_at` | TIMESTAMP WITH TIME ZONE | ✅ |

```text
status:
DRAFT
OPEN
ACCEPTED
IN_PROGRESS
COMPLETED
CANCELLED
```

```text
dispatch_mode:
MVP → OPEN
Future → DIRECT / PRIORITY / AUTO
```

---

## 5. OrderEvent

```text
OrderEvent
├─ id
├─ order_id
├─ event_type
├─ actor_user_id
├─ metadata
└─ created_at
```

| 欄位 | 型態 | 必填 |
|---|---|:---:|
| `id` | UUID | ✅ |
| `order_id` | UUID | ✅ |
| `event_type` | ENUM | ✅ |
| `actor_user_id` | UUID | ❌ |
| `metadata` | JSONB | ❌ |
| `created_at` | TIMESTAMP WITH TIME ZONE | ✅ |

```text
event_type:
ORDER_CREATED
ORDER_PUBLISHED
ORDER_VIEWED
ORDER_ACCEPTED
ORDER_ACCEPT_FAILED
ORDER_STARTED
ORDER_COMPLETED
ORDER_CANCELLED
```

---

## 6. Notification

```text
Notification
├─ id
├─ user_id
├─ order_id
├─ status
├─ created_at
└─ sent_at
```

| 欄位 | 型態 | 必填 |
|---|---|:---:|
| `id` | UUID | ✅ |
| `user_id` | UUID | ✅ |
| `order_id` | UUID | ✅ |
| `status` | ENUM | ✅ |
| `created_at` | TIMESTAMP WITH TIME ZONE | ✅ |
| `sent_at` | TIMESTAMP WITH TIME ZONE | ❌ |

```text
status:
PENDING
SENT
FAILED
```

Web Push 的 title / body 不存入 Notification。

---

## 7. PushSubscription

```text
PushSubscription
├─ id
├─ user_id
├─ endpoint
├─ p256dh
├─ auth
├─ created_at
└─ updated_at
```

| 欄位 | 型態 | 必填 |
|---|---|:---:|
| `id` | UUID | ✅ |
| `user_id` | UUID | ✅ |
| `endpoint` | TEXT | ✅ |
| `p256dh` | TEXT | ✅ |
| `auth` | TEXT | ✅ |
| `created_at` | TIMESTAMP WITH TIME ZONE | ✅ |
| `updated_at` | TIMESTAMP WITH TIME ZONE | ✅ |

用途：

- 記錄該 User 的 Web Push 送達目標
- 同一 User 同時間只保留一筆有效 PushSubscription
- 新 subscription 取代舊的
- Logout / unsubscribe 移除目前這筆 subscription

---

---
## 8. Session

```text
Session
├─ id
├─ user_id
├─ expires_at
├─ revoked_at
└─ created_at
```

| 欄位 | 型態 | 必填 |
|---|---|:---:|
| `id` | UUID | ✅ |
| `user_id` | UUID | ✅ |
| `expires_at` | TIMESTAMP WITH TIME ZONE | ✅ |
| `revoked_at` | TIMESTAMP WITH TIME ZONE | ❌ |
| `created_at` | TIMESTAMP WITH TIME ZONE | ✅ |

用途：

- 儲存使用者登入 Session
- `revoked_at` 用於讓既有 Session 失效
- 新登入成功時，先撤銷既有有效 Session，再建立新的 Session
- Admin 將 Driver 設為 `SUSPENDED` 時，立即撤銷該 user 的有效 Session

一個 User 可以有多筆歷史 Session，但同時間只能有一筆有效 Session。

---

# 9. Relationships

```text
User
 ├── 1 : 0..1 → Driver
 ├── 1 : N    → Order
 ├── 1 : N    → Notification
 ├── 1 : 0..1 → PushSubscription
 └── 1 : N    → Session

Driver
 └── 1 : N    → Order

Order
 └── 1 : N    → OrderEvent
```

---

# 10. Constraints & Business Rules

### User

```text
users.username UNIQUE
```

```text
ACTIVE
→ 正常使用

SUSPENDED
→ 不可登入
→ 不可搶新單
→ 現有 active session 立即失效
```

既有訂單不因 `SUSPENDED` 自動取消。恢復 `ACTIVE` 時不建立新 session，需重新登入。

### Driver

```text
drivers.user_id UNIQUE
drivers.license_plate UNIQUE
```

一個 User 對應一個 Driver。

### Order

```text
orders.order_no UNIQUE

orders.driver_id → drivers.id
orders.created_by → users.id
```

### OrderEvent

```text
order_events.order_id → orders.id
order_events.actor_user_id → users.id
```

### Notification

```text
notifications.user_id → users.id
notifications.order_id → orders.id
```

### PushSubscription

```text
push_subscriptions.user_id → users.id
push_subscriptions.user_id UNIQUE
push_subscriptions.endpoint UNIQUE
```

同一 User 同時間只保留一筆有效 PushSubscription。新 subscription 取代舊的。Logout / unsubscribe 移除目前這筆 subscription。

### Session

```text
sessions.user_id → users.id
```

同一個 User 同時間只能有一筆有效 Session：

```text
UNIQUE(user_id)
WHERE revoked_at IS NULL
```

### Order / Driver

一張 Order 只能由一名 Driver 成功取得。

同一名 Driver 同時最多持有一張未完成 Order：

```text
ACCEPTED
IN_PROGRESS
```

資料庫使用 Partial Unique Index：

```text
UNIQUE(driver_id)
WHERE status IN ('ACCEPTED', 'IN_PROGRESS')
```

### Concurrent Accept

多人同時搶單時，使用 PostgreSQL Transaction / Atomic Update：

```text
OPEN → ACCEPTED
```

同一張 Order 只能有一個成功的 Driver。

### Driver Accept 條件

```text
Order.status = OPEN
Driver.online_status = ONLINE
Driver 對應 User.status = ACTIVE
Driver 沒有 ACCEPTED Order
Driver 沒有 IN_PROGRESS Order
```

### DRAFT

```text
DRAFT
├─ Edit
├─ Publish
└─ Delete
```

DRAFT 可直接刪除，相關 OrderEvent 一併刪除。

已發布訂單不使用 DELETE：

```text
OPEN → CANCELLED
ACCEPTED → CANCELLED
```

### Order Status

```text
DRAFT
OPEN
ACCEPTED
IN_PROGRESS
COMPLETED
CANCELLED
```

終態：

```text
COMPLETED
CANCELLED
```

終態不可恢復。

### Online Status

```text
ONLINE
OFFLINE
```

```text
ONLINE
→ 可收到新訂單通知
→ 可搶單

OFFLINE
→ 不接收新訂單通知
→ 不可搶單
```

Online Status 與 Order Status 分開管理。

### Session

MVP 採用 Single Active Session：

- 同一 User 同時間只允許一個有效 Session。
- 新登入成功後，舊 Session 設為 revoked。
- Admin 將 Driver 設為 `SUSPENDED` 時，該 user 的現有 active session 立即撤銷。
- 恢復 `ACTIVE` 時不建立新 session；Driver 需重新登入。
- 舊 Session 不直接刪除，以保留 Session 歷史紀錄。
- `revoked_at IS NULL` 代表目前有效 Session。

### Timestamp

所有時間欄位使用：

```text
TIMESTAMP WITH TIME ZONE
```

Database 以 UTC 儲存。

---

# 11. Order 建立

Admin 輸入：

```text
customer_name       選填
pickup_location     必填
destination         選填
price               選填
note                選填

未填寫的選填欄位存 `NULL`，不使用空字串或 `0`。
不使用 `scheduled_at`、`vehicle_type`。
```

系統產生：

```text
id
order_no
status = DRAFT
dispatch_mode = OPEN
created_by
created_at
updated_at
```

---

# 12. Product Phase Data Boundary

```text
Phase 1 — 目前 DATABASE-SPEC 已定義的 Schema（核心派車 MVP）
Phase 2 — Driver Location & Trip Information
Phase 3 — Advanced Dispatch & Communication
```

**Phase 2** 可能需要儲存 Driver 目前位置，以及 Pickup Geocoding 座標，以支援距離 / ETA / 地圖。詳細 Schema 於進入 Phase 2 時再定義，目前不新增欄位或 Migration。

**Phase 3** 僅為後續規劃（自動派車、AI Dispatch、Priority / 自動重派、進階車隊追蹤、第三方通訊）。目前不定義資料模型。