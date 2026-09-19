# 白牌司機群派車系統
## MVP Specification v0.1

**版本：** v0.1  
**狀態：** 第一版定案

---

# 1. 產品概述

提供白牌司機群使用的派車管理系統。

## 核心流程

```text
管理員從社群或其他管道收到叫車需求
        ↓
管理員建立訂單
        ↓
發布搶單
        ↓
符合條件的司機收到通知
        ↓
司機查看訂單
        ↓
司機搶單
        ↓
第一位成功搶單的司機取得訂單
        ↓
開始行程
        ↓
完成訂單
```

---

# 2. 使用者角色

系統包含兩種角色：

- 管理員（Admin）
- 司機（Driver）

## 2.1 Admin

- 管理司機
- 建立訂單
- 編輯草稿訂單
- 刪除草稿訂單
- 發布訂單
- 查看全部訂單
- 查看訂單詳情
- 查看接單司機
- 取消訂單
- 查看訂單事件

## 2.2 Driver

- 登入
- 上線 / 離線
- 查看可搶訂單
- 查看訂單詳情
- 搶單
- 開始自己的訂單
- 完成自己的訂單
- 查看自己的歷史訂單

---

# 3. User

第一版採帳號密碼登入。

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

### Role

```text
ADMIN
DRIVER
```

### Status

```text
ACTIVE
SUSPENDED
```

`ACTIVE`：正常使用。

`SUSPENDED`：不可登入、不可搶新單。現有 active session 立即失效。

既有訂單不因 `SUSPENDED` 自動取消。恢復 `ACTIVE` 時不建立新 session，需重新登入。

---

# 4. Driver

司機帳號及車輛資料由 Admin 後台建立。

## 建立司機資料

- 帳號
- 密碼
- 車牌
- 車輛品牌
- 車輛型號
- 車輛顏色

## 司機登入

僅需要：

- 帳號
- 密碼

## Driver Schema

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

`vehicle_type` 與 `vehicle_year` 保留於 Schema；新 Driver 不填寫，值為空。

### Online Status

```text
ONLINE
OFFLINE
```

Driver 可由前端手動切換上線 / 離線狀態。

---

# 5. Order

Order 為系統核心資料。

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

## 主要欄位

| 欄位 | 說明 |
|---|---|
| `order_no` | 訂單編號 |
| `customer_name` | 客戶姓名，選填 |
| `pickup_location` | 上車地點，必填 |
| `destination` | 目的地，選填 |
| `price` | 派車價格，選填 |
| `note` | 訂單備註，選填 |
| `driver_id` | 成功接單的司機 |
| `created_by` | 建立訂單的管理員 |

---

# 6. Dispatch Mode

## MVP

第一版固定：

```text
dispatch_mode = OPEN
```

訂單發布後，開放司機搶單。

多名司機可以同時嘗試搶單，但一張訂單只能由一名司機成功取得。

## 未來預留

```text
OPEN
DIRECT
PRIORITY
AUTO
```

未來可支援（屬 Phase 3 Advanced Dispatch，詳細需求待定）：

- 開放搶單
- 指定司機
- 指定司機優先，逾時後開放搶單
- 自動派單

Phase 2 不擴充 `dispatch_mode`，不實作指定司機或自動派單。

---

# 7. Order State Machine

第一版訂單狀態：

```text
DRAFT
OPEN
ACCEPTED
IN_PROGRESS
COMPLETED
CANCELLED
```

## 7.1 主要流程

```text
DRAFT
  │
  │ 發布
  ↓
OPEN
  │
  ├── 司機搶單成功 ──→ ACCEPTED
  │                         │
  │                         │ 開始行程
  │                         ↓
  │                    IN_PROGRESS
  │                         │
  │                         │ 完成
  │                         ↓
  │                    COMPLETED
  │
  └── 管理員取消 ─────→ CANCELLED
```

## 7.2 DRAFT

```text
DRAFT
├── 編輯
├── 發布
└── 刪除
```

DRAFT 可由 Admin 直接刪除。

## 7.3 取消

```text
DRAFT   → DELETE
OPEN    → CANCELLED
ACCEPTED → CANCELLED
```

`IN_PROGRESS` 不允許 Admin 直接取消。

## 7.4 終態

```text
COMPLETED
CANCELLED
```

終態不可恢復。

---

# 8. 多人搶單機制

當訂單為：

```text
status = OPEN
```

多名 Driver 可以同時嘗試搶單。

```text
Driver A ─┐
Driver B ─┼──→ Order
Driver C ─┘
```

第一位成功的 Driver：

```text
Order.status = ACCEPTED
Order.driver_id = Driver A
```

其他 Driver 搶單失敗：

```text
ORDER_ALREADY_ACCEPTED
```

## 技術要求

必須由 Backend 與 Database 保證同一張訂單只能成功被一名 Driver 取得。

可使用：

- Database Transaction
- Atomic Update
- 或等效的 Concurrency Control

Frontend 不負責保證搶單唯一性。

---

# 9. Driver 接單限制

同一名 Driver：

> **同一時間最多只能持有一張未完成訂單。**

未完成訂單：

```text
ACCEPTED
IN_PROGRESS
```

因此 Driver 若目前已有上述任一狀態的訂單，不得再搶其他 OPEN 訂單。

搶單條件：

```text
1. Order.status = OPEN
2. Driver.online_status = ONLINE
3. Driver account status = ACTIVE
4. Driver 沒有 ACCEPTED 訂單
5. Driver 沒有 IN_PROGRESS 訂單
```

若任一條件不符合，搶單失敗。

例如：

```text
DRIVER_HAS_ACTIVE_ORDER
```

訂單進入：

```text
COMPLETED
```

或：

```text
CANCELLED
```

後，Driver 可重新搶單。

---

# 10. Driver Online Status

Driver 有獨立的上線 / 離線狀態。

```text
ONLINE
OFFLINE
```

### ONLINE

可收到 OPEN 訂單通知並參與搶單。

### OFFLINE

不可搶單。

第一版不將 Online Status 與 Order Status 綁定。

---

# 11. OrderEvent

OrderEvent 用於記錄訂單生命週期與操作歷史。

```text
OrderEvent
├─ id
├─ order_id
├─ event_type
├─ actor_user_id
├─ metadata
└─ created_at
```

### Event Type

```text
ORDER_CREATED
ORDER_PUBLISHED
ORDER_ACCEPTED
ORDER_STARTED
ORDER_COMPLETED
ORDER_CANCELLED
```

### 範例

```text
10:00 ORDER_CREATED
10:02 ORDER_PUBLISHED
10:04 ORDER_ACCEPTED      Driver A
10:30 ORDER_STARTED       Driver A
11:20 ORDER_COMPLETED     Driver A
```

### 用途

- 訂單歷史紀錄
- 操作追蹤
- 問題排查
- 後續統計與派單分析

---

# 12. Notification

第一版使用：

```text
Web Push / Browser Notification
```

## 12.1 Wave Dispatch（分批距離派單）

Admin 發布 Order（`DRAFT` → `OPEN`）後，由 **Backend** 啟動 Wave Dispatch。`dispatch_mode` 仍為 `OPEN`（開放搶單）；Wave 只控制「何時／通知誰」，不改變 Accept 的 atomic concurrency 規則。

### 候選 Driver（每一波重新檢查）

```text
User.role = DRIVER
User.status = ACTIVE
Driver.online_status = ONLINE
無 ACCEPTED / IN_PROGRESS Order
latitude / longitude 皆非 null（有效最新 GPS）
具有效 PushSubscription
此 Order 尚無任何 Notification 紀錄（含 PENDING / SENT / FAILED）
可計算到 Pickup 的 Haversine 直線距離（Pickup 座標來自 P2-02 runtime geocode）
```

### 排序與分波

- 依 Driver → Pickup **Haversine 直線距離**由近到遠
- 同距離時隨機排序
- 每波最多通知 **5** 位
- 第一波於 Publish 成功後立即執行；之後每波間隔 **10** 秒
- 已建立 Notification 的 Driver 不重複通知
- 不使用 Google Routes／道路距離／ETA
- 不引入 Redis／WebSocket／SSE／Message Queue；波次排程為 **process 內 timer**

### 停止條件

任一成立即停止後續波次：

- Order 成功被接單、取消，或不再是 `OPEN`
- 當波無可通知候選（含 Pickup 座標不可用、無剩餘合格 Driver）
- 當波通知人數 < 5（已無足夠剩餘候選）

Notification 傳送失敗不影響 Order Status；Driver 仍可於 Open Orders 查看 `OPEN` 單。

流程：

```text
Admin 發布訂單
      ↓
Order = OPEN
      ↓
Wave Dispatch（Backend）
      ↓
選 ≦5 位候選 → Notification → Web Push
      ↓
（若仍 OPEN 且可能有剩餘）等待 10 秒 → 下一波
```

## Schema

```text
Notification
├─ id
├─ user_id
├─ order_id
├─ status
├─ created_at
└─ sent_at
```

```text
status:
PENDING
SENT
FAILED
```

Web Push 的 title / body 不存入 Notification。

Notification 的傳送狀態不影響 Order Status。

---

# 13. 訂單資料可見性

Driver 可以查看 OPEN Order 詳情。

Driver 也可以查看自己的已接單。

Driver 不可以查看其他 Driver 的已接單。

## Driver 查看 OPEN 訂單

可查看：

- 訂單編號
- 上車地點
- 目的地
- 價格
- 備註

## Driver 成功接單後

可取得執行訂單所需的完整資訊。

---

# 14. 權限矩陣

| 操作 | Admin | Driver |
|---|:---:|:---:|
| 建立訂單 | ✅ | ❌ |
| 查看全部訂單 | ✅ | ❌ |
| 查看 OPEN 訂單 | ✅ | ✅ |
| 查看訂單詳情 | ✅ | ✅ |
| 編輯 DRAFT | ✅ | ❌ |
| 刪除 DRAFT | ✅ | ❌ |
| 發布訂單 | ✅ | ❌ |
| 搶單 | ❌ | ✅ |
| 開始自己的訂單 | ❌ | ✅ |
| 完成自己的訂單 | ❌ | ✅ |
| 取消 OPEN | ✅ | ❌ |
| 取消 ACCEPTED | ✅ | ❌ |
| 取消 IN_PROGRESS | ❌ | ❌ |
| 取消 COMPLETED | ❌ | ❌ |
| 查看接單司機 | ✅ | 僅自己 |
| 管理 Driver | ✅ | ❌ |
| 切換 Online / Offline | ❌ | ✅ |

---

# 15. API

## Authentication

```http
POST /auth/login
```

## Admin

```http
POST /orders
GET  /orders
GET  /orders/:id
PUT  /orders/:id
DELETE /orders/:id
POST /orders/:id/publish
POST /orders/:id/cancel
```

`PUT /orders/:id` 僅允許修改 DRAFT。

`DELETE /orders/:id` 僅允許刪除 DRAFT。

## Driver

```http
GET  /driver/orders/open
GET  /driver/orders/:id
POST /driver/orders/:id/accept
POST /driver/orders/:id/start
POST /driver/orders/:id/complete
PATCH /driver/status
```

## Notification

```http
POST /notifications/subscription
```

---

# 16. API 與狀態轉移

| API | 前置狀態 | 成功後 |
|---|---|---|
| `POST /orders` | — | `DRAFT` |
| `PUT /orders/:id` | `DRAFT` | `DRAFT` |
| `DELETE /orders/:id` | `DRAFT` | 刪除 |
| `POST /orders/:id/publish` | `DRAFT` | `OPEN` |
| `POST /driver/orders/:id/accept` | `OPEN` | `ACCEPTED` |
| `POST /driver/orders/:id/start` | `ACCEPTED` | `IN_PROGRESS` |
| `POST /driver/orders/:id/complete` | `IN_PROGRESS` | `COMPLETED` |
| `POST /orders/:id/cancel` | `OPEN / ACCEPTED` | `CANCELLED` |
| `PATCH /driver/status` | — | `ONLINE / OFFLINE` |

---

# 17. 第一版核心流程

## 17.1 Admin

```text
登入
 ↓
建立訂單
 ↓
DRAFT
 ↓
確認資料
 ↓
發布
 ↓
OPEN
 ↓
等待司機搶單
 ↓
ACCEPTED
 ↓
等待執行
 ↓
IN_PROGRESS
 ↓
COMPLETED
```

## 17.2 Driver

```text
登入
 ↓
切換 ONLINE
 ↓
查看可搶訂單
 ↓
收到通知
 ↓
查看訂單
 ↓
搶單
 ↓
成功
 ↓
ACCEPTED
 ↓
開始行程
 ↓
IN_PROGRESS
 ↓
完成
 ↓
COMPLETED
```

---

# 18. 產品階段範圍

## Phase Boundary

```text
Phase 1 — 核心派車 MVP
Phase 2 — Driver Location & Trip Information
Phase 3 — Advanced Dispatch & Communication
```

## 18.1 Phase 1 — 核心派車 MVP（已包含）

- Admin 登入
- Driver 登入
- Admin 管理 Driver
- Admin 建立訂單
- Admin 編輯 DRAFT
- Admin 刪除 DRAFT
- Admin 發布訂單
- Admin 取消 OPEN / ACCEPTED 訂單
- Driver 查看 OPEN 訂單
- Driver 上線 / 離線
- Driver 搶單
- Driver 開始行程
- Driver 完成行程
- Driver 同時間最多持有一張未完成訂單
- 多人同時搶單的競態控制
- 訂單逾時不處理
- Web Push / Browser Notification
- OrderEvent 紀錄

## 18.2 Phase 2 — Driver Location & Trip Information

產品範圍以 `PHASE-2-SPEC.md` 為準。

Phase 2 包含：

### Driver Location（P2-01）

- Driver `ONLINE` 時以 Browser Geolocation 啟用 GPS
- 進入 `ONLINE` 後立即取得第一次位置，之後每 30 秒更新
- Backend 只儲存 Driver 最新位置
- `OFFLINE` 停止更新，並保留最後一次有效位置
- GPS／上報失敗不得改變 Online／Offline 狀態
- 不做 location history

### Distance（P2-03）

- 使用 Driver 最新 GPS 與 Pickup **transient** 座標（P2-02 runtime；不存 DB）
- Backend `DistanceService` 自行計算**直線距離**（great-circle／Haversine）
- API canonical field：`distance_meters: number | null`；缺任一座標 → `null` → UI 不顯示
- Driver 只看自己的距離（相關 `OPEN`／`ACCEPTED`／`IN_PROGRESS`）；Admin 可看 ONLINE Drivers ↔ Pickup
- 顯示：`< 1 km` → **整數公尺**；`>= 1 km` → **小數一位公里**；必須標示「直線距離」
- Distance 不存 DB；UI 仍為參考資訊
- **Accept／Order State 規則不因距離改變**；Wave Dispatch 僅用直線距離決定**通知順序與分批**
- 不做道路距離，不做 ETA；不使用 Google Routes API

### Map & Navigation（P2-04）

- In-app Map SDK：Google Maps JavaScript API
- Web App 內顯示地圖（Driver：自己的位置 + Pickup；Admin：ONLINE Drivers + Pickup）
- Pickup 座標來自 Backend runtime geocode（不存 DB）；沿用 P2-01 GPS、P2-03 直線距離
- 接單後「開始導航」交由 Google Maps handoff；不做 App 內 turn-by-turn／routing／ETA
- Map／導航失敗不影響 Order／Accept／Online／Offline
- Geocoding server key 不進 Frontend；Maps JS 使用分開的 browser-restricted key

### Pickup Geocoding（P2-02）

- Provider：Google Geocoding API（Backend 呼叫）
- 建單先存文字 `pickup_location`；建立後非同步 Geocoding；不阻塞建單 response
- Provider error／timeout：最多 **2** 次 provider 呼叫（含首次）；隔 **200ms** 再試一次；`ZERO_RESULTS`／`INVALID`／`DISABLED` 不重試
- **不**將 Pickup lat/lng 存入 Database
- 同一 Order 的 Geocoding 結果供 Distance／Map 使用；不因多名 Driver 重複呼叫 Google
- `pickup_location` 修改後必須重新 Geocode；不得沿用舊座標
- Geocoding 失敗不阻塞訂單流程

### Phase 2 基本原則

- 先聚焦「司機在哪裡」與「到上車點的直線距離」
- 不建立複雜 Dispatch Engine
- 不做自動派車／AI Dispatch／通訊整合

## 18.3 Phase 3 — Advanced Dispatch & Communication

Phase 3 為後續開發規劃，目前只做簡述，不定義詳細需求。

### Advanced Dispatch

- 自動派車
- AI Dispatch
- Priority / 自動重派
- 進階車隊追蹤

### Communication

- 第三方通訊整合

例如未來可評估電話、LINE、簡訊或其他第三方服務。

目前不指定第三方服務、API 或技術方案。

---

# 19. MVP 驗收標準

第一版必須穩定完成：

```text
Admin 建立訂單
        ↓
發布搶單
        ↓
ONLINE Driver 收到通知
        ↓
Driver 查看訂單
        ↓
多名 Driver 可以同時搶單
        ↓
只有一名 Driver 成功
        ↓
Driver 開始行程
        ↓
Driver 完成訂單
        ↓
OrderEvent 留存完整操作紀錄
```

## 核心驗證目標

> 管理員可以將外部收到的叫車需求建立為訂單，發布後由上線司機收到通知並搶單；系統正確處理多人同時搶單與單一司機持單限制，並完成完整的訂單生命週期。