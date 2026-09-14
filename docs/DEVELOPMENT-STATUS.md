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
2. npm run db:up
3. cd backend && npm install && npm run prisma:generate
4. cd frontend && npm install
5. npm run dev:backend
6. npm run dev:frontend
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

### Next

下一個 Task 等待中。
