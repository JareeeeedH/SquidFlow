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

### Next

下一個 Task 等待中。
