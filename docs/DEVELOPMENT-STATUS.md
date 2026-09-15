# Development Status

## TASK-001 — Project Bootstrap

**Status:** completed

### 已完成的基礎環境

- Frontend：Vue 3 + Vite + TypeScript + Vue Router + Pinia
- Backend：NestJS + TypeScript Modular Monolith 骨架
- Prisma：已設定，尚未建立業務資料表
- PostgreSQL：Docker Compose（`postgres:16`）
- Health check：`GET /api/v1/health`
- Root scripts：`dev:frontend`、`dev:backend`、`db:up`、`db:down`、`build`、`lint`、`test`

### 啟動方式

```text
1. 複製 backend/.env.example 為 backend/.env
2. 複製 frontend/.env.example 為 frontend/.env，並填入與 Backend 相同的 VAPID public key
3. npm run db:up
4. cd backend && npm install && npm run prisma:generate
5. cd frontend && npm install
6. npm run dev:backend
7. npm run dev:frontend
```

本機驗證時，host `5432` 與 `3000` 已被占用，因此 Docker PostgreSQL 對應 `localhost:5433`，Backend 使用 `PORT=3001`。

---

## TASK-002 — Database Schema / Prisma

**Status:** completed

### 已完成

- Prisma schema 依 DATABASE-SPEC 建立 7 張表：`users`、`drivers`、`orders`、`order_events`、`notifications`、`push_subscriptions`、`sessions`
- 第一個 migration：`20260914202731_init`
- Partial unique index：
  - `idx_one_active_order_per_driver`
  - `idx_one_active_session_per_user`
- 尚未實作 Auth / Order / Driver API

---

## TASK-003 — Authentication / Session

**Status:** completed

### 已完成

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- Session + HttpOnly Cookie（`squidflow_session`）
- PostgreSQL Session、Single Active Session transaction
- bcrypt password hashing
- AuthGuard / RolesGuard 基礎
- 未實作 Frontend Login UI、Driver / Order / Notification API

---

## TASK-004 — Admin Driver Management

**Status:** completed

### 已完成

- `GET /api/v1/drivers`
- `POST /api/v1/drivers`
- `GET /api/v1/drivers/:id`
- `PUT /api/v1/drivers/:id`
- `PATCH /api/v1/drivers/:id/status`
- Admin-only：AuthGuard + RolesGuard（`User.role = ADMIN`）
- 建立 Driver 時同一 transaction 寫入 User + Driver
- User.role = DRIVER、User.status = ACTIVE、Driver.online_status = OFFLINE 由 Backend 決定
- password 使用既有 PasswordService / bcrypt；PUT 未提供則不改密碼
- username / license_plate unique 轉為統一 API error
- 未實作 Driver Management UI、Order API、Driver online/offline、Web Push

---

## TASK-005 — Driver Online / Offline

**Status:** completed

### 已完成

- `PATCH /api/v1/driver/status`
- Driver-only：AuthGuard + RolesGuard（`User.role = DRIVER`）
- 以 current user 對應的 Driver 更新 `online_status`，不接受 client 指定 `driver_id` / `user_id`
- 只接受 `ONLINE` / `OFFLINE`；`ACTIVE` / `SUSPENDED` 為 VALIDATION_ERROR
- `SUSPENDED` Driver 不可切換 Online Status，回傳 `ACCOUNT_SUSPENDED`，不改 `online_status`
- 不修改 Order、不發送 Notification
- 未實作 Accept Order、搶單、Web Push、Frontend Online/Offline UI

---

## TASK-006 — Admin Order CRUD / DRAFT

**Status:** completed

### 已完成

- `GET /api/v1/orders`
- `POST /api/v1/orders`
- `GET /api/v1/orders/:id`
- `PUT /api/v1/orders/:id`
- `DELETE /api/v1/orders/:id`
- Admin-only：AuthGuard + RolesGuard（`User.role = ADMIN`）
- 建立時固定 `status=DRAFT`、`dispatch_mode=OPEN`、`driver_id=null`、`created_by=current admin`
- `order_no`：`ORD-YYYYMMDD-NNN`（Asia/Taipei 日期），transaction + PostgreSQL advisory lock
- Create 與 `ORDER_CREATED` 同一 transaction
- PUT / DELETE 僅允許 DRAFT；非 DRAFT 回 `INVALID_ORDER_STATUS`
- DRAFT hard delete：先刪 OrderEvent / Notification，再刪 Order（不改 Schema CASCADE）
- `GET /orders` query：`status`、`date`（Taipei `scheduled_at` 日曆日）、`search`（`order_no` / `customer_name`）
- 未實作 Publish、Cancel、搶單、Notification、Frontend Order UI

---

## TASK-007 — Order Publish / DRAFT → OPEN

**Status:** completed

### 已完成

- `POST /api/v1/orders/:id/publish`
- Admin-only：AuthGuard + RolesGuard（`User.role = ADMIN`）
- Atomic `UPDATE ... WHERE id AND status = DRAFT` → `OPEN`
- 同一 transaction：Order OPEN + `ORDER_PUBLISHED` + `Notification(PENDING)`
- 通知對象：`User.role=DRIVER` 且 `User.status=ACTIVE` 且 `Driver.online_status=ONLINE`，且沒有 `ACCEPTED` / `IN_PROGRESS` Order
- 無符合資格 Driver 時仍 Publish 成功，Notification = 0
- 非 DRAFT / 重複 Publish → `INVALID_ORDER_STATUS`
- 未實作 Web Push、Accept / 搶單、Cancel、Frontend

---

## TASK-008 — Driver Open Orders / Order Detail

**Status:** completed

### 已完成

- `GET /api/v1/driver/orders/open`
- `GET /api/v1/driver/orders/:id`
- Driver-only：AuthGuard + RolesGuard（`User.role = DRIVER`）
- Driver context 由 current user → `drivers.user_id` 取得，不接受 client `driver_id` / `user_id`
- Open Orders 僅在可接單時回傳 `status=OPEN`：ACTIVE + ONLINE + 無 ACCEPTED / IN_PROGRESS；否則空陣列
- Order Detail：OPEN 或 `order.driver_id = current driver`（含 ACCEPTED / IN_PROGRESS / COMPLETED / CANCELLED）
- 其他 Driver 已接單與不存在訂單一律 `404 NOT_FOUND`
- GET 唯讀：不改 Order / Driver，不建立 `ORDER_VIEWED`
- 未實作 Accept / 搶單、Start / Complete、`GET /driver/orders`、Web Push、Frontend

---

## Frontend Phase A-1 — Foundation & Authentication

**Status:** completed

### 已完成

- Naive UI + Lucide
- CSS Variables + Scoped CSS
- Vite proxy：`/api` → `http://localhost:3001`
- 共用 API Client（`credentials: include`）
- Pinia Auth Store、`GET /auth/me` 初始化
- Router guard：`/login` 與受保護 `/`
- Login / Logout
- 最小 Authenticated Layout
- 未實作 Orders / Drivers / Accept / Cancel / Web Push

---

## Frontend Phase A-2 — Admin Orders List

**Status:** completed

### 已完成

- Admin 導覽：訂單 → `/orders`
- `GET /api/v1/orders`：`search` / `status` / `date`
- Orders table、Loading / Empty / Error / 403
- Status visual、Taipei 時間、NT$ 價格
- 查看 → `/orders/:id` navigation placeholder（未實作 Detail UI）
- 未實作 Create / Edit / Delete / Publish / Cancel / Drivers / Accept / Web Push

---

## Frontend Phase A-3 — Order Detail + Create Draft

**Status:** completed

### 已完成

- `GET /api/v1/orders/:id` Order Detail（唯讀）
- `POST /api/v1/orders` 建立 Draft
- `/orders/new` → 成功後進入 `/orders/:id`
- 未實作 Edit / Delete / Publish / Cancel / Timeline / Drivers / Accept / Web Push

---

## Frontend Phase A-4 — Edit / Delete / Publish Draft

**Status:** completed

### 已完成

- DRAFT：`PUT /orders/:id` 編輯
- DRAFT：`DELETE /orders/:id` 刪除（確認後回 `/orders`）
- DRAFT：`POST /orders/:id/publish` 發布（確認後重新載入 Detail）
- 非 DRAFT 不提供以上操作
- 未實作 Cancel / Accept / Drivers / Web Push

---

## Frontend Phase A-5 — Admin Driver Management

**Status:** completed

### 已完成

- Admin 導覽：司機 → `/drivers`
- `GET /api/v1/drivers` 司機列表
- `GET /api/v1/drivers/:id` 司機詳情
- `POST /api/v1/drivers` 新增司機
- `PUT /api/v1/drivers/:id` 編輯（空白密碼不送出）
- `PATCH /api/v1/drivers/:id/status` 啟用 / 停用
- 帳號狀態 `ACTIVE` / `SUSPENDED` 與上線狀態 `ONLINE` / `OFFLINE` 分開顯示
- 未實作 Delete Driver、Force Logout、Driver UI、Accept、Web Push

---

## Frontend Phase A-6 — Driver UI

**Status:** completed

### 已完成

- Driver 登入後進入 `/driver`
- Admin / Driver 路由依 role 隔離
- `PATCH /api/v1/driver/status` 上線 / 下線
- `GET /api/v1/driver/orders/open` 可搶訂單
- `GET /api/v1/driver/orders/:id` 司機訂單詳情
- Mobile-first Card / 大觸控區
- 未實作 My Orders、Start / Complete / Cancel、Web Push

---

## TASK-009 — Driver Accept Order

**Status:** completed

### 已完成

- `POST /api/v1/driver/orders/:id/accept`
- Atomic claim：`UPDATE ... WHERE id = :id AND status = 'OPEN'`
- 成功：`OPEN → ACCEPTED`、寫入 `driver_id` / `accepted_at`、建立 `ORDER_ACCEPTED`
- 失敗：`ORDER_ALREADY_ACCEPTED` / `DRIVER_OFFLINE` / `DRIVER_HAS_ACTIVE_ORDER` / `INVALID_ORDER_STATUS` / `NOT_FOUND`
- 同一 Driver 未完成訂單由 Business Rule + `idx_one_active_order_per_driver` 雙重保護
- Driver UI「我要接單」以 Backend 回傳為準
- 未實作 Start / Complete / Cancel、My Orders、Web Push

---

## TASK-010 — Driver My Orders / Start / Complete

**Status:** completed

### 已完成

- `GET /api/v1/driver/orders`：僅回傳目前 Driver 自己的訂單，支援 `status` filter，不回傳 DRAFT
- `POST /api/v1/driver/orders/:id/start`：僅自己的 `ACCEPTED` → `IN_PROGRESS`，寫入 `started_at` 與 `ORDER_STARTED`
- `POST /api/v1/driver/orders/:id/complete`：僅自己的 `IN_PROGRESS` → `COMPLETED`，寫入 `completed_at` 與 `ORDER_COMPLETED`
- 狀態、timestamp、event 同一 transaction；atomic `UPDATE ... WHERE`
- 非法 / 重複 transition → `INVALID_ORDER_STATUS`；其他 Driver → `404`；Admin → `403`
- 不接受 client `driver_id` / `user_id` / timestamp
- ONLINE / OFFLINE 不影響已接訂單的 Start / Complete
- SUSPENDED：沿用 leftover session `ACCOUNT_SUSPENDED`、正式停權撤 session `401`
- 未實作 Cancel、My Orders Frontend、Web Push

---

## TASK-011 — Admin Cancel Order

**Status:** completed

### 已完成

- `POST /api/v1/orders/:id/cancel`
- Admin-only：AuthGuard + RolesGuard（`User.role = ADMIN`）
- Atomic `UPDATE ... WHERE id AND status IN ('OPEN', 'ACCEPTED')` → `CANCELLED` + `cancelled_at`
- 同一 transaction 寫入 `ORDER_CANCELLED`
- `ACCEPTED` 取消保留 `driver_id` / `accepted_at`；該 Driver 可再接其他 OPEN 訂單
- 非法 / 重複 cancel → `INVALID_ORDER_STATUS`；不存在 → `NOT_FOUND`；Driver → `403`
- 不接受 client `driver_id` / `cancelled_at` / 狀態欄位
- 不發送 Web Push / Notification
- 未實作 Cancel Frontend、Web Push

---

## TASK-012 — Web Push

**Status:** completed

### 已完成

- `POST /api/v1/notifications/subscription`、`DELETE /api/v1/notifications/subscription`
- Driver-only；未登入 `401`、Admin `403`、SUSPENDED leftover session `ACCOUNT_SUSPENDED`
- 同一 User 只保留一筆 PushSubscription；新 subscription 取代舊的（含相同 endpoint）
- Logout / unsubscribe 移除目前 subscription
- Publish 同一 transaction：Order `OPEN` + `ORDER_PUBLISHED` + `Notification(PENDING)`
- 通知資格：`DRIVER + ACTIVE + ONLINE + 有效 PushSubscription`；持有 `ACCEPTED` / `IN_PROGRESS` 仍可收到通知
- Accept 資格維持既有規則，不因通知放寬而改變
- Transaction commit 後發送 Web Push；`PENDING → SENT / FAILED`
- 實際發送時 Order 必須仍為 `OPEN`；已不是 `OPEN` 的 PENDING 不發送
- Invalid subscription（404 / 410）：移除 subscription，Notification → `FAILED`
- Push failure 不影響 Publish / Order state；不做 retry / queue
- Web Push title / body 不存入 Notification；VAPID 由 env 提供
- 未實作 Frontend integration、`GET /notifications`、deployment

---

## TASK-013 — Frontend Web Push Integration

**Status:** completed

### 已完成

- Driver Home「開啟通知 / 關閉通知」；Permission 被拒絕只顯示「通知未開啟」
- 請求 Notification Permission、註冊 Service Worker、建立 PushSubscription
- `POST / DELETE /api/v1/notifications/subscription`
- 登入後依瀏覽器 Permission + 既有 subscription 恢復通知狀態（並重新 POST 給 Backend）
- Logout 先移除目前 browser / Backend subscription
- 收到 Push 顯示通知；點擊進入 `/driver/orders/:id`
- Permission 失敗不影響登入、Online/Offline、接單
- VAPID public key 使用 `VITE_VAPID_PUBLIC_KEY`（與 Backend 同一組 public key）
- 未實作 `GET /notifications`、deployment

---

## TASK-014 — Real Push & End-to-End Flow Verification

**Status:** completed

### 已完成

- 驗證 Publish → OPEN → Accept → Start → Complete → COMPLETED（`backend/test/dispatch-flow.e2e-spec.ts` + 本機瀏覽器 / API）
- 驗證 Offline / Busy / SUSPENDED / 同時搶單 / Admin Cancel（既有 e2e + dispatch-flow；本機另驗證 Offline Accept 與 Admin Cancel）
- 驗證 Push failure 不影響 Publish / Order
- 瀏覽器：Notification Permission = granted、Service Worker `/sw.js` 已註冊、`showNotification` 可顯示、click message 可導向 `/driver/orders/:id`、Driver UI「我要接單」成功
- Cursor 內建 Chromium 的 `PushManager.subscribe` 回 `AbortError: Registration failed - push service not available`，因此無法在此環境完成真實 Web Push 網路投遞 / FCM subscription
- 未實作 Driver Start / Complete UI、Admin Cancel UI、`GET /notifications`、deployment（Start / Complete 以 Driver API 驗證）

---

## TASK-015 — Driver My Orders + Start/Complete + Admin Cancel UI

**Status:** completed

### 已完成

- Driver「我的訂單」：目前訂單（`ACCEPTED` / `IN_PROGRESS`）與歷史訂單（`COMPLETED` / `CANCELLED`）
- `GET /api/v1/driver/orders`；`ACCEPTED` →「開始行程」；`IN_PROGRESS` →「完成訂單」
- `POST /api/v1/driver/orders/:id/start`、`POST /api/v1/driver/orders/:id/complete`
- Admin Order Detail：`OPEN` / `ACCEPTED` →「取消訂單」；`IN_PROGRESS` / `COMPLETED` / `CANCELLED` 唯讀
- `POST /api/v1/orders/:id/cancel`
- 未實作 `GET /notifications`、Order Events / Timeline、Dashboard、Security Hardening、deployment

---

## TASK-016 — Production Security Hardening + Final QA

**Status:** completed

### 已完成

- Login brute-force：同一 IP + username 連續失敗後鎖定；成功登入清除計數；鎖定期間不進行密碼驗證
- Rate limiting（in-memory，非 Redis）：Login、Accept、Publish、Cancel；production 預設較嚴、dev/test 較鬆，可用 env 覆寫
- Security headers：CSP、X-Content-Type-Options、Referrer-Policy、X-Frame-Options；HSTS 僅 production
- Production CORS：`FRONTEND_ORIGIN` allowlist + credentials；production 未設定則瀏覽器 Origin 拒絕
- Production Cookie 維持 HttpOnly / Secure / SameSite=Lax；`TRUST_PROXY` 供反代後取得真實 client IP
- 明確 JSON body 上限 100kb
- 未修改 Order business rules、Database Schema、API contract
- 未實作 `GET /notifications`、Order Events / Timeline、Dashboard、deployment

---

## TASK-015B — Admin Order Detail Driver 資訊

**Status:** completed

### 已完成

- `GET /api/v1/orders/:id`（含 PUT 成功回傳）增加 `driver`
- 未指派：`driver: null`
- 已指派：`username`、`vehicle_type`、`license_plate`、`vehicle_brand`、`vehicle_model`、`vehicle_color`
- Admin Order Detail 顯示接單司機與車輛資訊；Frontend 不另打 Driver API
- 已同步 `API-SPEC`；未改 Schema
- Dashboard / Dispatch Console 暫緩獨立 TASK，未縮減 UI-UX-SPEC

---

## TASK-016A — Admin Dashboard / Dispatch Console

**Status:** completed

### 已完成

- `GET /api/v1/admin/dashboard`：Admin-only
- `summary`：Backend 聚合六種 Order Status 數量
- `board_orders`：`DRAFT` / `OPEN` / `ACCEPTED` / `IN_PROGRESS`，依 `scheduled_at` 升序
- 未指派 `driver: null`；已指派 `driver: { username }`，不另打 Driver API
- 不使用 `active_orders`
- Admin 登入後進入 Dashboard；Status Summary 點擊 → `/orders?status=<status>`
- Dispatch Board 四欄卡片；點擊進入 Order Detail
- 完整訂單列表仍在 `/orders`，含既有搜尋／篩選
- 已同步 `API-SPEC`；未改 Schema、未做 WebSocket / SSE / 拖拉看板
- 未實作 `GET /notifications`、Order Events / Timeline、deployment


---
