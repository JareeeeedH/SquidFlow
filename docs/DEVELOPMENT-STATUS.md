# Development Status

## Product Phase Roadmap

與正式 Spec 一致的產品階段邊界：

```text
Phase 1 — 核心派車 MVP（產品功能已實作）
Phase 2 — Driver Location & Trip Information（P2-01～P2-04 已實作）
Phase 3 — Trip Mileage & Fare Calculation（Spec 已定義；實作未開始）
Phase 4 — Advanced Dispatch & Communication（僅規劃；見 PHASE-4-SPEC.md）
```

> 產品功能（P1 + P2 + Wave Dispatch）已收斂；Phase 3 里程／車資見 `PHASE-3-SPEC.md`；Phase 4 見 `PHASE-4-SPEC.md`。Production deployment（Docker／HTTPS／反向代理）仍見 Production Readiness Audit，不屬本文件「功能完成」範圍。

### Phase 1

核心派車 MVP：登入、訂單生命週期、搶單、Driver 上線／離線、Web Push、Admin／Driver UI。詳見下方已完成 TASK。

### Wave Dispatch（分批距離派單）

- 已實作：Publish 後 Backend Wave Dispatch；候選 = ACTIVE + ONLINE + 無 busy Order + 有效 GPS + PushSubscription + 尚未通知；Haversine 近→遠、同距隨機；每波 ≦5、間隔 10s；Accept／Cancel／非 OPEN／無候選則停止；沿用 Accept atomic claim；無 Redis／Queue／WebSocket／SSE／Routes
- Spec 已同步：`MVP-SPEC`、`API-SPEC`、`DATABASE-SPEC`、`SYSTEM-ARCHITECTURE-SPEC`、`SECURITY-SPEC`、`PHASE-2-SPEC`

### Phase 2（P2-01／P2-02／P2-03／P2-04 已實作）

產品範圍以 `PHASE-2-SPEC.md` 為準。包含：

- Driver Location（P2-01：已實作 — GPS、立即首次定位、每 30 秒更新、Backend 只存最新位置；Online／Offline 控制更新；失敗不改 Online 狀態）
- Pickup Geocoding（P2-02：已實作 — Google Geocoding API；建單不阻塞；非同步 geocode；**不**存 Pickup lat/lng 到 DB；同 Order 結果供 Distance／Map；改地址重 geocode）
- Straight-line Distance（P2-03：已實作 — `DistanceService` + `distance_meters`；無道路距離／ETA）
- Map & Google Maps Navigation handoff（P2-04：已實作 — Google Maps JavaScript API；Driver／Admin Map；ephemeral Pickup 座標；導航 handoff；Maps／導航失敗不影響核心流程）

不做自動派車、AI Dispatch、進階派車、通訊整合、location history、道路距離、ETA、Google Routes 距離／ETA；不引入 Redis／Queue／Worker／WebSocket 做 geocoding／distance／map。任務期間里程計費屬 Phase 3。

### Phase 3 — Trip Mileage & Fare Calculation（Spec 已定義；尚未實作）

產品範圍以 `PHASE-3-SPEC.md` 為準。

- `IN_PROGRESS` GPS 10 秒 + Haversine 累加 `trip_distance_meters`
- Complete 鎖定里程並依費率寫入最終 `price`
- 沿用 `PATCH /api/v1/driver/location`；不保存 GPS History
- Backend 為里程／車資唯一權威

### Phase 4 — Advanced Dispatch & Communication（僅規劃）

產品範圍以 `PHASE-4-SPEC.md` 為準（僅簡述）：

- Advanced Dispatch：自動派車、AI Dispatch、Priority／自動重派、進階車隊追蹤
- Communication：第三方通訊整合（不指定服務或技術方案）

---

## TASK-001 â Project Bootstrap

**Status:** completed

### å·²å®æçåºç¤ç°å¢

- Frontendï¼Vue 3 + Vite + TypeScript + Vue Router + Pinia
- Backendï¼NestJS + TypeScript Modular Monolith éª¨æ¶
- Prismaï¼å·²è¨­å®ï¼å°æªå»ºç«æ¥­åè³æè¡¨
- PostgreSQLï¼Docker Composeï¼`postgres:16`ï¼
- Health checkï¼`GET /api/v1/health`
- Root scriptsï¼`dev:frontend`ã`dev:backend`ã`db:up`ã`db:down`ã`build`ã`lint`ã`test`

### ååæ¹å¼

```text
1. è¤è£½ backend/.env.example çº backend/.envï¼é è¨­ PORT=3001ï¼å°é½ Vite proxyï¼
2. è¤è£½ frontend/.env.example çº frontend/.envï¼ä¸¦å¡«å¥è Backend ç¸åç VAPID public key
3. npm run db:up
4. cd backend && npm install && npm run prisma:generate
5. cd frontend && npm install
6. npm run dev:backend
7. npm run dev:frontend
```

æ¬æ©é è¨­ï¼Docker PostgreSQL å°æ `localhost:5433`ï¼Backend `PORT=3001`ï¼è Vite `/api` proxy ä¸è´ï¼ãè¥ host `3001` è¢«å ç¨ï¼åææ¹ `backend/.env` ç `PORT` è `frontend/vite.config.ts` proxy targetã

---

## TASK-002 â Database Schema / Prisma

**Status:** completed

### å·²å®æ

- Prisma schema ä¾ DATABASE-SPEC å»ºç« 7 å¼µè¡¨ï¼`users`ã`drivers`ã`orders`ã`order_events`ã`notifications`ã`push_subscriptions`ã`sessions`
- ç¬¬ä¸å migrationï¼`20260914202731_init`
- Partial unique indexï¼
  - `idx_one_active_order_per_driver`
  - `idx_one_active_session_per_user`
- å°æªå¯¦ä½ Auth / Order / Driver API

---

## TASK-003 â Authentication / Session

**Status:** completed

### å·²å®æ

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- Session + HttpOnly Cookieï¼`squidflow_session`ï¼
- PostgreSQL SessionãSingle Active Session transaction
- bcrypt password hashing
- AuthGuard / RolesGuard åºç¤
- æªå¯¦ä½ Frontend Login UIãDriver / Order / Notification API

---

## TASK-004 â Admin Driver Management

**Status:** completed

### å·²å®æ

- `GET /api/v1/drivers`
- `POST /api/v1/drivers`
- `GET /api/v1/drivers/:id`
- `PUT /api/v1/drivers/:id`
- `PATCH /api/v1/drivers/:id/status`
- Admin-onlyï¼AuthGuard + RolesGuardï¼`User.role = ADMIN`ï¼
- å»ºç« Driver æåä¸ transaction å¯«å¥ User + Driver
- User.role = DRIVERãUser.status = ACTIVEãDriver.online_status = OFFLINE ç± Backend æ±ºå®
- password ä½¿ç¨æ¢æ PasswordService / bcryptï¼PUT æªæä¾åä¸æ¹å¯ç¢¼
- username / license_plate unique è½çºçµ±ä¸ API error
- æªå¯¦ä½ Driver Management UIãOrder APIãDriver online/offlineãWeb Push

---

## TASK-005 â Driver Online / Offline

**Status:** completed

### å·²å®æ

- `PATCH /api/v1/driver/status`
- Driver-onlyï¼AuthGuard + RolesGuardï¼`User.role = DRIVER`ï¼
- ä»¥ current user å°æç Driver æ´æ° `online_status`ï¼ä¸æ¥å client æå® `driver_id` / `user_id`
- åªæ¥å `ONLINE` / `OFFLINE`ï¼`ACTIVE` / `SUSPENDED` çº VALIDATION_ERROR
- `SUSPENDED` Driver ä¸å¯åæ Online Statusï¼åå³ `ACCOUNT_SUSPENDED`ï¼ä¸æ¹ `online_status`
- ä¸ä¿®æ¹ Orderãä¸ç¼é Notification
- æªå¯¦ä½ Accept Orderãæ¶å®ãWeb PushãFrontend Online/Offline UI

---

## TASK-006 â Admin Order CRUD / DRAFT

**Status:** completed

### å·²å®æ

- `GET /api/v1/orders`
- `POST /api/v1/orders`
- `GET /api/v1/orders/:id`
- `PUT /api/v1/orders/:id`
- `DELETE /api/v1/orders/:id`
- Admin-onlyï¼AuthGuard + RolesGuardï¼`User.role = ADMIN`ï¼
- å»ºç«æåºå® `status=DRAFT`ã`dispatch_mode=OPEN`ã`driver_id=null`ã`created_by=current admin`
- `order_no`ï¼`ORD-YYYYMMDD-NNN`ï¼Asia/Taipei æ¥æï¼ï¼transaction + PostgreSQL advisory lock
- Create è `ORDER_CREATED` åä¸ transaction
- PUT / DELETE ååè¨± DRAFTï¼é DRAFT å `INVALID_ORDER_STATUS`
- DRAFT hard deleteï¼ååª OrderEvent / Notificationï¼ååª Orderï¼ä¸æ¹ Schema CASCADEï¼
- `GET /orders` queryï¼`status`ã`date`ï¼Taipei `created_at` æ¥ææ¥ï¼ã`search`ï¼`order_no` / `customer_name`ï¼
- æªå¯¦ä½ PublishãCancelãæ¶å®ãNotificationãFrontend Order UI

---

## TASK-007 â Order Publish / DRAFT â OPEN

**Status:** completed

### å·²å®æ

- `POST /api/v1/orders/:id/publish`
- Admin-onlyï¼AuthGuard + RolesGuardï¼`User.role = ADMIN`ï¼
- Atomic `UPDATE ... WHERE id AND status = DRAFT` â `OPEN`
- åä¸ transactionï¼Order OPEN + `ORDER_PUBLISHED` + `Notification(PENDING)`
- éç¥å°è±¡ï¼`User.role=DRIVER` ä¸ `User.status=ACTIVE` ä¸ `Driver.online_status=ONLINE`ï¼ä¸æ²æ `ACCEPTED` / `IN_PROGRESS` Order
- ç¡ç¬¦åè³æ ¼ Driver æä» Publish æåï¼Notification = 0
- é DRAFT / éè¤ Publish â `INVALID_ORDER_STATUS`
- æªå¯¦ä½ Web PushãAccept / æ¶å®ãCancelãFrontend

---

## TASK-008 â Driver Open Orders / Order Detail

**Status:** completed

### å·²å®æ

- `GET /api/v1/driver/orders/open`
- `GET /api/v1/driver/orders/:id`
- Driver-onlyï¼AuthGuard + RolesGuardï¼`User.role = DRIVER`ï¼
- Driver context ç± current user â `drivers.user_id` åå¾ï¼ä¸æ¥å client `driver_id` / `user_id`
- Open Orders åå¨å¯æ¥å®æåå³ `status=OPEN`ï¼ACTIVE + ONLINE + ç¡ ACCEPTED / IN_PROGRESSï¼å¦åç©ºé£å
- Order Detailï¼OPEN æ `order.driver_id = current driver`ï¼å« ACCEPTED / IN_PROGRESS / COMPLETED / CANCELLEDï¼
- å¶ä» Driver å·²æ¥å®èä¸å­å¨è¨å®ä¸å¾ `404 NOT_FOUND`
- GET å¯è®ï¼ä¸æ¹ Order / Driverï¼ä¸æ°å¢ OrderEvent
- æªå¯¦ä½ Accept / æ¶å®ãStart / Completeã`GET /driver/orders`ãWeb PushãFrontend

---

## Frontend Phase A-1 â Foundation & Authentication

**Status:** completed

### å·²å®æ

- Naive UI + Lucide
- CSS Variables + Scoped CSS
- Vite proxyï¼`/api` â `http://localhost:3001`
- å±ç¨ API Clientï¼`credentials: include`ï¼
- Pinia Auth Storeã`GET /auth/me` åå§å
- Router guardï¼`/login` èåä¿è­· `/`
- Login / Logout
- æå° Authenticated Layout
- æªå¯¦ä½ Orders / Drivers / Accept / Cancel / Web Push

---

## Frontend Phase A-2 â Admin Orders List

**Status:** completed

### å·²å®æ

- Admin å°è¦½ï¼è¨å® â `/orders`
- `GET /api/v1/orders`ï¼`search` / `status` / `date`
- Orders tableãLoading / Empty / Error / 403
- Status visualãTaipei æéãNT$ å¹æ ¼
- æ¥ç â `/orders/:id` navigation placeholderï¼æªå¯¦ä½ Detail UIï¼
- æªå¯¦ä½ Create / Edit / Delete / Publish / Cancel / Drivers / Accept / Web Push

---

## Frontend Phase A-3 â Order Detail + Create Draft

**Status:** completed

### å·²å®æ

- `GET /api/v1/orders/:id` Order Detailï¼å¯è®ï¼
- `POST /api/v1/orders` å»ºç« Draft
- `/orders/new` â æåå¾é²å¥ `/orders/:id`
- æªå¯¦ä½ Edit / Delete / Publish / Cancel / Drivers / Accept / Web Push

---

## Frontend Phase A-4 â Edit / Delete / Publish Draft

**Status:** completed

### å·²å®æ

- DRAFTï¼`PUT /orders/:id` ç·¨è¼¯
- DRAFTï¼`DELETE /orders/:id` åªé¤ï¼ç¢ºèªå¾å `/orders`ï¼
- DRAFTï¼`POST /orders/:id/publish` ç¼å¸ï¼ç¢ºèªå¾éæ°è¼å¥ Detailï¼
- é DRAFT ä¸æä¾ä»¥ä¸æä½
- æªå¯¦ä½ Cancel / Accept / Drivers / Web Push

---

## Frontend Phase A-5 â Admin Driver Management

**Status:** completed

### å·²å®æ

- Admin å°è¦½ï¼å¸æ© â `/drivers`
- `GET /api/v1/drivers` å¸æ©åè¡¨
- `GET /api/v1/drivers/:id` å¸æ©è©³æ
- `POST /api/v1/drivers` æ°å¢å¸æ©
- `PUT /api/v1/drivers/:id` ç·¨è¼¯ï¼ç©ºç½å¯ç¢¼ä¸éåºï¼
- `PATCH /api/v1/drivers/:id/status` åç¨ / åç¨
- å¸³èçæ `ACTIVE` / `SUSPENDED` èä¸ç·çæ `ONLINE` / `OFFLINE` åéé¡¯ç¤º
- æªå¯¦ä½ Delete DriverãForce LogoutãDriver UIãAcceptãWeb Push

---

## Frontend Phase A-6 â Driver UI

**Status:** completed

### å·²å®æ

- Driver ç»å¥å¾é²å¥ `/driver`
- Admin / Driver è·¯ç±ä¾ role éé¢
- `PATCH /api/v1/driver/status` ä¸ç· / ä¸ç·
- `GET /api/v1/driver/orders/open` å¯æ¶è¨å®
- `GET /api/v1/driver/orders/:id` å¸æ©è¨å®è©³æ
- Mobile-first Card / å¤§è§¸æ§å
- æªå¯¦ä½ My OrdersãStart / Complete / CancelãWeb Push

---

## TASK-009 â Driver Accept Order

**Status:** completed

### å·²å®æ

- `POST /api/v1/driver/orders/:id/accept`
- Atomic claimï¼`UPDATE ... WHERE id = :id AND status = 'OPEN'`
- æåï¼`OPEN â ACCEPTED`ãå¯«å¥ `driver_id` / `accepted_at`ãå»ºç« `ORDER_ACCEPTED`
- å¤±æï¼`ORDER_ALREADY_ACCEPTED` / `DRIVER_OFFLINE` / `DRIVER_HAS_ACTIVE_ORDER` / `INVALID_ORDER_STATUS` / `NOT_FOUND`
- åä¸ Driver æªå®æè¨å®ç± Business Rule + `idx_one_active_order_per_driver` ééä¿è­·
- Driver UIãæè¦æ¥å®ãä»¥ Backend åå³çºæº
- æªå¯¦ä½ Start / Complete / CancelãMy OrdersãWeb Push

---

## TASK-010 â Driver My Orders / Start / Complete

**Status:** completed

### å·²å®æ

- `GET /api/v1/driver/orders`ï¼ååå³ç®å Driver èªå·±çè¨å®ï¼æ¯æ´ `status` filterï¼ä¸åå³ DRAFT
- `POST /api/v1/driver/orders/:id/start`ï¼åèªå·±ç `ACCEPTED` â `IN_PROGRESS`ï¼å¯«å¥ `started_at` è `ORDER_STARTED`
- `POST /api/v1/driver/orders/:id/complete`ï¼åèªå·±ç `IN_PROGRESS` â `COMPLETED`ï¼å¯«å¥ `completed_at` è `ORDER_COMPLETED`
- çæãtimestampãevent åä¸ transactionï¼atomic `UPDATE ... WHERE`
- éæ³ / éè¤ transition â `INVALID_ORDER_STATUS`ï¼å¶ä» Driver â `404`ï¼Admin â `403`
- ä¸æ¥å client `driver_id` / `user_id` / timestamp
- ONLINE / OFFLINE ä¸å½±é¿å·²æ¥è¨å®ç Start / Complete
- SUSPENDEDï¼æ²¿ç¨ leftover session `ACCOUNT_SUSPENDED`ãæ­£å¼åæ¬æ¤ session `401`
- æªå¯¦ä½ CancelãMy Orders FrontendãWeb Push

---

## TASK-011 â Admin Cancel Order

**Status:** completed

### å·²å®æ

- `POST /api/v1/orders/:id/cancel`
- Admin-onlyï¼AuthGuard + RolesGuardï¼`User.role = ADMIN`ï¼
- Atomic `UPDATE ... WHERE id AND status IN ('OPEN', 'ACCEPTED')` â `CANCELLED` + `cancelled_at`
- åä¸ transaction å¯«å¥ `ORDER_CANCELLED`
- `ACCEPTED` åæ¶ä¿ç `driver_id` / `accepted_at`ï¼è©² Driver å¯åæ¥å¶ä» OPEN è¨å®
- éæ³ / éè¤ cancel â `INVALID_ORDER_STATUS`ï¼ä¸å­å¨ â `NOT_FOUND`ï¼Driver â `403`
- ä¸æ¥å client `driver_id` / `cancelled_at` / çææ¬ä½
- ä¸ç¼é Web Push / Notification
- æªå¯¦ä½ Cancel FrontendãWeb Push

---

## TASK-012 â Web Push

**Status:** completed

### å·²å®æ

- `POST /api/v1/notifications/subscription`ã`DELETE /api/v1/notifications/subscription`
- Driver-onlyï¼æªç»å¥ `401`ãAdmin `403`ãSUSPENDED leftover session `ACCOUNT_SUSPENDED`
- åä¸ User åªä¿çä¸ç­ PushSubscriptionï¼æ° subscription åä»£èçï¼å«ç¸å endpointï¼
- Logout / unsubscribe ç§»é¤ç®å subscription
- Publish åä¸ transactionï¼Order `OPEN` + `ORDER_PUBLISHED` + `Notification(PENDING)`
- éç¥è³æ ¼ï¼`DRIVER + ACTIVE + ONLINE + ææ PushSubscription`ï¼ææ `ACCEPTED` / `IN_PROGRESS` ä»å¯æ¶å°éç¥
- Accept è³æ ¼ç¶­ææ¢æè¦åï¼ä¸å éç¥æ¾å¯¬èæ¹è®
- Transaction commit å¾ç¼é Web Pushï¼`PENDING â SENT / FAILED`
- å¯¦éç¼éæ Order å¿é ä»çº `OPEN`ï¼å·²ä¸æ¯ `OPEN` ç PENDING ä¸ç¼é
- Invalid subscriptionï¼404 / 410ï¼ï¼ç§»é¤ subscriptionï¼Notification â `FAILED`
- Push failure ä¸å½±é¿ Publish / Order stateï¼ä¸å retry / queue
- Web Push title / body ä¸å­å¥ Notificationï¼VAPID ç± env æä¾
- æªå¯¦ä½ Frontend integrationãdeployment

---

## TASK-013 â Frontend Web Push Integration

**Status:** completed

### å·²å®æ

- Driver Homeãéåéç¥ / éééç¥ãï¼Permission è¢«æçµåªé¡¯ç¤ºãéç¥æªéåã
- è«æ± Notification Permissionãè¨»å Service Workerãå»ºç« PushSubscription
- `POST / DELETE /api/v1/notifications/subscription`
- ç»å¥å¾ä¾çè¦½å¨ Permission + æ¢æ subscription æ¢å¾©éç¥çæï¼ä¸¦éæ° POST çµ¦ Backendï¼
- Logout åç§»é¤ç®å browser / Backend subscription
- æ¶å° Push é¡¯ç¤ºéç¥ï¼é»æé²å¥ `/driver/orders/:id`
- Permission å¤±æä¸å½±é¿ç»å¥ãOnline/Offlineãæ¥å®
- VAPID public key ä½¿ç¨ `VITE_VAPID_PUBLIC_KEY`ï¼è Backend åä¸çµ public keyï¼
- æªå¯¦ä½ deployment

---

## TASK-014 â Real Push & End-to-End Flow Verification

**Status:** completed

### å·²å®æ

- é©è­ Publish â OPEN â Accept â Start â Complete â COMPLETEDï¼`backend/test/dispatch-flow.e2e-spec.ts` + æ¬æ©çè¦½å¨ / APIï¼
- é©è­ Offline / Busy / SUSPENDED / åææ¶å® / Admin Cancelï¼æ¢æ e2e + dispatch-flowï¼æ¬æ©å¦é©è­ Offline Accept è Admin Cancelï¼
- é©è­ Push failure ä¸å½±é¿ Publish / Order
- çè¦½å¨ï¼Notification Permission = grantedãService Worker `/sw.js` å·²è¨»åã`showNotification` å¯é¡¯ç¤ºãclick message å¯å°å `/driver/orders/:id`ãDriver UIãæè¦æ¥å®ãæå
- Cursor å§å»º Chromium ç `PushManager.subscribe` å `AbortError: Registration failed - push service not available`ï¼å æ­¤ç¡æ³å¨æ­¤ç°å¢å®æçå¯¦ Web Push ç¶²è·¯æé / FCM subscription
- æªå¯¦ä½ Driver Start / Complete UIãAdmin Cancel UIãdeploymentï¼Start / Complete ä»¥ Driver API é©è­ï¼

---

## TASK-015 â Driver My Orders + Start/Complete + Admin Cancel UI

**Status:** completed

### å·²å®æ

- Driverãæçè¨å®ãï¼ç®åè¨å®ï¼`ACCEPTED` / `IN_PROGRESS`ï¼èæ­·å²è¨å®ï¼`COMPLETED` / `CANCELLED`ï¼
- `GET /api/v1/driver/orders`ï¼`ACCEPTED` âãéå§è¡ç¨ãï¼`IN_PROGRESS` âãå®æè¨å®ã
- `POST /api/v1/driver/orders/:id/start`ã`POST /api/v1/driver/orders/:id/complete`
- Admin Order Detailï¼`OPEN` / `ACCEPTED` âãåæ¶è¨å®ãï¼`IN_PROGRESS` / `COMPLETED` / `CANCELLED` å¯è®
- `POST /api/v1/orders/:id/cancel`
- æªå¯¦ä½ DashboardãSecurity Hardeningãdeployment

---

## TASK-016 â Production Security Hardening + Final QA

**Status:** completed

### å·²å®æ

- Login brute-forceï¼åä¸ IP + username é£çºå¤±æå¾éå®ï¼æåç»å¥æ¸é¤è¨æ¸ï¼éå®æéä¸é²è¡å¯ç¢¼é©è­
- Rate limitingï¼in-memoryï¼é Redisï¼ï¼LoginãAcceptãPublishãCancelï¼production é è¨­è¼å´ãdev/test è¼é¬ï¼å¯ç¨ env è¦å¯«
- Security headersï¼CSPãX-Content-Type-OptionsãReferrer-PolicyãX-Frame-Optionsï¼HSTS å production
- Production CORSï¼`FRONTEND_ORIGIN` allowlist + credentialsï¼production æªè¨­å®åçè¦½å¨ Origin æçµ
- Production Cookie ç¶­æ HttpOnly / Secure / SameSite=Laxï¼`TRUST_PROXY` ä¾åä»£å¾åå¾çå¯¦ client IP
- æç¢º JSON body ä¸é 100kb
- æªä¿®æ¹ Order business rulesãDatabase SchemaãAPI contract
- æªå¯¦ä½ Dashboardãdeployment

---

## TASK-015B â Admin Order Detail Driver è³è¨

**Status:** completed

### å·²å®æ

- `GET /api/v1/orders/:id`ï¼å« PUT æååå³ï¼å¢å  `driver`
- æªææ´¾ï¼`driver: null`
- å·²ææ´¾ï¼`username`ã`vehicle_type`ã`license_plate`ã`vehicle_brand`ã`vehicle_model`ã`vehicle_color`
- Admin Order Detail é¡¯ç¤ºæ¥å®å¸æ©èè»è¼è³è¨ï¼Frontend ä¸å¦æ Driver API
- å·²åæ­¥ `API-SPEC`ï¼æªæ¹ Schema
- Dashboard / Dispatch Console æ«ç·©ç¨ç« TASKï¼æªç¸®æ¸ UI-UX-SPEC

---

## TASK-016A â Admin Dashboard / Dispatch Console

**Status:** completed

### å·²å®æ

- `GET /api/v1/admin/dashboard`ï¼Admin-only
- `summary`ï¼Backend èåå­ç¨® Order Status æ¸é
- `board_orders`ï¼`DRAFT` / `OPEN` / `ACCEPTED` / `IN_PROGRESS`ï¼ä¾ `created_at` éåº
- æªææ´¾ `driver: null`ï¼å·²ææ´¾ `driver: { username }`ï¼ä¸å¦æ Driver API
- ä¸ä½¿ç¨ `active_orders`
- Admin ç»å¥å¾é²å¥ Dashboardï¼Status Summary é»æ â `/orders?status=<status>`
- Dispatch Board åæ¬å¡çï¼é»æé²å¥ Order Detail
- å®æ´è¨å®åè¡¨ä»å¨ `/orders`ï¼å«æ¢ææå°ï¼ç¯©é¸
- å·²åæ­¥ `API-SPEC`ï¼æªæ¹ Schemaãæªå WebSocket / SSE / ææçæ¿
- æªå¯¦ä½ deployment

---

## TASK-016B â Sync Dashboard UI-UX Spec

**Status:** completed

### å·²å®æ

- `UI-UX-SPEC`ï¼Dashboard = Status Summary + Dispatch Board
- Status Summary é¡¯ç¤ºå­ç¨® statusï¼ä¸é¡¯ç¤ºãå¨é¨ãï¼é»æ â `/orders?status=<status>`
- Dispatch Board åæ¬ï¼`DRAFT` / `OPEN` / `ACCEPTED` / `IN_PROGRESS`ï¼å¡çé²å¥ Order Detail
- å®æ´è¨å®æå° / ç¯©é¸ / ç®¡çç¶­æå¨ `/orders`
- Dashboard ä¸å«å®æ´ Order Listãæå° / æ¥æç¯©é¸ãBI / å ±è¡¨ãRealtime
- æªæ¹ Backend / Frontend / Schema / API contract

---

## TASK-016C â Admin Dashboard UI Polish

**Status:** completed

### å·²å®æ

- Status Summaryï¼æ¸å­å±¤ç´ãOrderStatusTagãå¯é»æ hover / focusãOPEN / ACCEPTED / IN_PROGRESS è¼é«è¾¨è­åº¦
- Dispatch Boardï¼æ¬ä½ headerãå¡çè³è¨åå±¤ãå¸æ© / æªææ´¾ãcompact empty state
- Desktop / Laptop / Tablet æ¬ä½ååèª¿æ´
- æªæ¹ API / Schema / business rules / routing

---

## TASK â Driver Management UI Polish

**Status:** completed

### å·²å®æ

- å¸æ©ç®¡çé æ¨é¡ãèªªæèãæ°å¢å¸æ©ãPrimary CTA
- åè¡¨æ¬ä½å±¤ç´ï¼å¸³èãä¸ç·çæãè»çãè»è¼ãå¸³èçæåªå
- Online Status è Account Status ç¶­æåéé¡¯ç¤º
- æä½æ¬åºå®å³å´ï¼ãæ¥çãé²å¥æ¢æå¸æ©è©³æ
- æªæ¹ API / Schema / business rules / filter / search

---

## TASK â Driver UI/UX Polish

**Status:** completed

### å·²å®æ

- Driver Homeï¼ä¸ç·çæä½çºä¸»è¦çæåï¼éç¥èå¸³èçæéçºæ¬¡è¦å±¤ç´ï¼ãå¯æ¶è¨å®ãçº Primary CTA
- Open Ordersï¼å¡çæ¹çºè¡ç¨ / å®è / å¹æ ¼ / CTA æè®å±¤ç´
- Order Detailï¼è¡ç¨èæéåªåï¼ä¾æ¢æçæé¡¯ç¤ºãæè¦æ¥å®ããéå§è¡ç¨ããå®æè¨å®ã
- My Ordersï¼ç®åè¨å®èæ­·å²è¨å®è¦è¦ºåå±¤ï¼æ­·å²ä¿æå¯è®
- Loading / success / error çææ´æ¸æ¥ï¼ç¶­ææ¢æ double-submit guard
- æªæ¹ API / Schema / business rules / Notification Center / Dashboard / Realtime

---

## TASK â Remove Driver Vehicle Type / Year

**Status:** completed

### å·²å®æ

- `drivers.vehicle_type`ã`drivers.vehicle_year` æ¹çº nullableï¼æ¢æè³æä¿ç
- Create / Update Driver API ä¸åè¦æ±æåå³éå©æ¬ï¼æ° Driver å¯«å¥ `NULL`
- Driver List / Detail / Create / Edit UI ç§»é¤è»åèå¹´ä»½
- Order API `AssignedDriver` ç§»é¤ `vehicle_type`ï¼`vehicle_year` æ¬ä¾å°±ä¸å¨ nested driverï¼
- `orders.vehicle_type` å¾çºå·² DROPï¼è¦ Simplify Order Creation Fields
- å·²åæ­¥ MVP / DATABASE / API / UI-UX Spec

---

## TASK â Simplify Order Creation Fields

**Status:** completed

### å·²å®æ

- DROP `orders.scheduled_at`ã`orders.vehicle_type`ï¼ä¸ä¿ç nullable
- `customer_name` / `destination` / `price` / `note` æ¹çº optionalï¼DB è API ä½¿ç¨ `NULL`ï¼UI é¡¯ç¤º `â`
- Create / Update åªè¦æ± `pickup_location`ï¼ä¸æ¥åå·²åªæ¬ä½
- Dashboard / Driver Open / Driver My Orders / Admin Orders çä¾ `created_at` DESC
- `GET /orders?date=` æ¹çº Taipei æ¥ææ¥ç¯©é¸ `created_at`
- Push åªé¡¯ç¤ºè¡ç¨èæå¡«çå¹æ ¼ï¼ç¡ destination åªé¡¯ç¤º pickup
- `drivers.vehicle_type` ç¶­æåæ¬¡ nullable æ±ºç­ï¼æªåä¿®æ¹
- å·²åæ­¥ MVP / DATABASE / API / UI-UX Spec

---

## TASK â Polish Admin Create Order UI

**Status:** completed

### å·²å®æ

- å»ºç«æ´¾è»å®é æ¹çºç½®ä¸­ãæå¤§å¯¬åº¦ 800pxï¼Header è Form Card åå¯¬
- è¡¨å®åæãè¡ç¨è³è¨ããè²»ç¨èåè¨»ãï¼ä¸è»å°é»ç¶­æå¿å¡«å¼·èª¿
- ãå²å­èç¨¿ãç¶­æå³ä¸ Primary CTA
- æªæ¹æ¬ä½ãAPIãSchemaãvalidationãrouting æ business rules

---

## TASK â Polish Admin Create Driver UI

**Status:** completed

### å·²å®æ

- æ°å¢å¸æ©é æ¹çºç½®ä¸­ãæå¤§å¯¬åº¦ 800pxï¼Header è Form Card åå¯¬
- è¡¨å®åæãå¸³èè³è¨ããè»è¼è³è¨ãï¼å¿å¡«æ¬ä½é¡¯ç¤º `*`
- ãå»ºç«å¸æ©ãç¶­æ Primary CTAï¼ãåæ¶ãç¶­æ Secondary
- æªæ¹æ¬ä½ãAPIãSchemaãvalidationãrouting æ business rules

---

## TASK â Compact Admin Dashboard Order Cards

**Status:** completed

### å·²å®æ

- Dispatch Board å¡çæ¹çºä¸è¡ï¼å®è+å®¢æ¶+å¹æ ¼ãè¡ç¨ãæé+å¸æ©
- ç¡ `customer_name` ä¸çç©ºç½ï¼`price` / `destination` é¡¯ç¤º `â`ï¼æªææ´¾é¡¯ç¤ºæªææ´¾
- éä½ card padding èåç´éè·ï¼ä¿ç status è²æ¢è click / hover
- æªæ¹ API / Schema / business rules

---

## TASK â Polish Admin Order Detail UI

**Status:** completed

### å·²å®æ

- Admin è¨å®è©³ææ¹çºç½®ä¸­ 7:3 éæ¬ï¼å·¦å´è¨å®è³è¨ + æ¥å®å¸æ©ï¼å³å´çæ / æä½ / æé
- è¡ç¨æ¹çº `ä¸è»å°é» â ç®çå°`ï¼æé«è¡ç¨èå¹æ ¼å±¤ç´
- æªææ´¾é¡¯ç¤ºå°ç¡ï¼å·²ææ´¾åªé¡¯ç¤ºå¯é»æ usernameï¼é²å¥æ¢æ Driver Detail
- ä¸é¡¯ç¤ºè»ç / è»è¼ / è»è²ï¼æªæ°å¢ APIãSchema æ business action

---

## TASK â Polish Admin Driver Detail UI

**Status:** completed

### å·²å®æ

- å¸æ©è©³ææ¹çºç½®ä¸­ç´ 960pxã7:3 éæ¬ï¼å·¦å´å¸³è / è»è¼ï¼å³å´çæ / æä½
- æé«å¸³èèè»çå±¤ç´ï¼ä¸ç·æç¤ºéçºæ¬¡è¦æå­ï¼ä¸æä¾ Admin æ§å¶ Online / Offline
- æªæ¹ API / Schema / business rules

---

## TASK â Polish Driver Home Mobile UI

**Status:** completed

### å·²å®æ

- Driver Home æ¹çº compact Online / Notification switch bar
- ç§»é¤ Home ä¸èå°è¦½éè¤çå¯æ¶è¨å® / æçè¨å®å¥å£
- æªæ¹ APIãPush rulesãå°è¦½ IA æ business rules

---

## TASK â Update Phase 2 / Phase 3 Specification

**Status:** completed

### å·²å®æ

- çµ±ä¸ Phase 1 / 2 / 3 éçæ¼ MVP / Architecture / API / Database / UI-UX / DEVELOPMENT-STATUS
- Phase 2 éå® Location / Distance / Mapï¼ç¬¬ä¸æ¹éè¨èé²éæ´¾è»ç§»è³ Phase 3
- æªæ¹ Backend / Frontend / Schema / Migration / API å¯¦ä½

---

## TASK â P2-01 Driver GPS Location Technical Spec Sync

**Status:** completed

### å·²å®æ

- ä»¥ `PHASE-2-SPEC.md` çºç¢åæºæï¼åæ­¥ P2-01 è³ DATABASE / API / Architecture / Security
- Driver ææ°ä½ç½®æ¬ä½ãDriver location ä¸å ±ï¼è®å APIãAdmin ONLINE locations APIãGPS lifecycle èææ¬è¦åå·²å¯«å¥ Spec
- ç§»é¤ï¼æ´æ­£è finalized Phase 2 è¡çªçéè·¯è·é¢ï¼ETA æè¿°ï¼ç¸éæä»¶ï¼
- æªæ¹ Backend / Frontend / Schema / Migration / API å¯¦ä½

---

## TASK â P2-02 Pickup Geocoding Technical Spec Sync

**Status:** completed

### å·²å®æ

- Provider å®çº Google Geocoding APIï¼å»ºå®ï¼æ¹å°åå¾éåæ­¥ geocodeï¼å¤±æä¸å½±é¿ Order
- **ä¸**æ°å¢ Pickup lat/lng DB æ¬ä½ï¼å Order çµæä¾ Distanceï¼Mapï¼é¿å per-Driver éè¤ Google å¼å«
- åæ­¥ PHASE-2 / API / DATABASE / Architecture / Security / UI-UX / MVP / DEVELOPMENT-STATUS
- ç§»é¤ååãæ°¸ä¹å¯«å¥ Order DBãä¹ BLOCKINGï¼æ®é¤ï¼P2-04 å°å SDK é ç¬¦å Google Â§6.2
- æªæ¹ Backend / Frontend / Schema / Migration / API å¯¦ä½

---

## TASK â P2-03 Straight-line Distance Technical Spec Sync

**Status:** completed

### å·²å®æ

- ä»¥ `PHASE-2-SPEC.md` çºç¢åæºæï¼åæ­¥ P2-03 è³ APIï¼DATABASEï¼Architectureï¼Securityï¼UI-UXï¼MVPï¼DEVELOPMENT-STATUS
- å®ç¾© `DistanceService`ãéé `GeocodingService.getPickupCoordinates` åå¾ transient Pickup åº§æ¨ãcanonical `distance_meters`
- Driverï¼Admin visibilityãç¼ºåº§æ¨è¡çºãå®ä½éæª»èç²¾åº¦ï¼æ´æ¸å¬å°ºï¼1 ä½å°æ¸å¬éï¼å·²å¯«å¥ Spec
- **ä¸**æ°å¢ Distanceï¼Pickup lat/lng DB æ¬ä½ï¼**ä¸**å¼å¥ Redisï¼Queueï¼Workerï¼Routesï¼ETA
- æªæ¹ Backendï¼Frontendï¼Schemaï¼Migrationï¼API å¯¦ä½

---

## TASK â P2-04 Map & Navigation Technical + UI/UX Spec Sync

**Status:** completed

### å·²å®æ

- Map SDK å®çº Google Maps JavaScript APIï¼å°èªçº Google Maps handoff
- åæ­¥ PHASE-2ï¼APIï¼DATABASEï¼Architectureï¼Securityï¼Technologyï¼UI-UXï¼MVPï¼DEVELOPMENT-STATUS
- å®ç¾© ephemeral `pickup_latitude`ï¼`pickup_longitude`ï¼Order Detailï¼ï¼æ²¿ç¨ P2-01ï¼P2-03ï¼ä¸æ¹ P2-03 distances array shape
- éæ¸ Geocoding server key vs Maps browser keyï¼Mapï¼å°èªå¤±æä¸å½±é¿æ ¸å¿æ´¾è»
- æªæ¹ Backendï¼Frontendï¼Schemaï¼Migrationï¼API å¯¦ä½

---

## TASK â P2-04 Map & Google Maps Navigation Implementation

**Status:** completed

### å·²å®æ

- Backend Order Detailï¼Adminï¼Driverï¼éå  ephemeral `pickup_latitude`ï¼`pickup_longitude`ï¼runtime geocodeï¼é DBï¼
- Frontendï¼`OrderMap`ãMaps JS loaderã`VITE_GOOGLE_MAPS_API_KEY`ãè·é¢æ ¼å¼ãGoogle Maps å°èª handoff
- Driver Order Detailï¼Mapï¼èªå·±ä½ç½® + Pickupï¼+ ç´ç·è·é¢ + ACCEPTED å¾ãéå§å°èªã
- Admin Order Detailï¼Mapï¼ONLINE Drivers + Pickupï¼+ æ²¿ç¨ `online-driver-distances`
- Mapï¼å°èªï¼ç¼º keyï¼ç¼ºåº§æ¨å¤±æéé¢ï¼ä¸å½±é¿ Acceptï¼Onlineï¼Offlineï¼æ ¸å¿ Order
- æªæ°å¢ Pickup lat/lng DB æ¬ä½ãWebSocketï¼Redisï¼Queueï¼Routingï¼ETAï¼æªæ¹ P2-03 distances array shape

---

## TASK â Premium Polish Driver Mobile UI

**Status:** completed

### å·²å®æ

- Driver Layout / Home / Open Orders / My Orders / Order Detail è¦è¦º polishï¼deep navy accentãcompact cardsï¼
- Open Orders ç´ 3 è¡ compact cardï¼My Orders æ­·å²ç¡æä½ CTA
- Home ç¶­æä¸éè¤å¯æ¶è¨å®å¥å£ï¼ä¸é¡¯ç¤º list å±¤ `customer_name`
- æªæ¹ API / Backend / Schema / business rules / IA

---

## TASK â Driver Home Final UI Cleanup + Status Hydration

**Status:** completed

### å·²å®æ

- æ°å¢ `GET /api/v1/driver/status`ï¼Homeï¼Layout hydrate online status
- Header ç§»é¤ãæ´¾è»ãèé æ¬ Online æå­ï¼å¸³èçæåè¡é¡¯ç¤º
- æªæ¹ SchemaãPATCH contractãOrderï¼Push rules

---

---

## TASK â Remove unused Notification list / OrderEvent read & unused event types

**Status:** completed

### å·²å®æ

- èª Specï¼Prisma enum ç§»é¤ ORDER_VIEWEDãORDER_ACCEPT_FAILED
- ç§»é¤æªå¯¦ä½å¥ç´ï¼GET /notificationsãGET /orders/:id/events
- ä¿ç lifecycle OrderEvent å¯«å¥è Web Push subscription API
- æªæ¹ Order StateãAccept concurrencyãAuthãPush ç¼éãGPSï¼Geocodingï¼Distanceï¼Map


---

## TASK ¡X Wave Dispatch¡]¤À§å¶ZÂ÷¬£³æ¡^

**Status:** completed

### ¤w§¹¦¨

- `WaveDispatchService`¡GPublish «á¤Àªi³qª¾¡F¨Cªi ¡Ø5¡B¶¡¹j 10s¡FHaversine ªñ¡÷»·¡B¦P¶ZÀH¾÷
- ­Ô¿ï¡GACTIVE + ONLINE + µL ACCEPTED/IN_PROGRESS + GPS + PushSubscription + ©|¥¼³qª¾¦¹ Order
- Accept / Cancel / «D OPEN / µL­Ô¿ï«h°±¤î¡Fªu¥Î Accept atomic claim
- µL·s DB Äæ¦ì¡F¥H¬J¦³ Notification §@¬°¤w³qª¾¬ö¿ý
- ¤£¤Þ¤J Redis / Queue / WebSocket / SSE / Routes / ETA
- Unit + e2e¡]wave-dispatch / publish / notifications / dispatch-flow¡^
- Spec ¦P¨B¡GMVP / API / DB / Architecture / Security / Phase-2 / Development Status

---

## TASK — Phase 3 Trip Mileage & Fare Specification

**Status:** completed（Spec only；實作未開始）

### 已完成

- 新增 `PHASE-3-SPEC.md`：任務期間實際里程＋固定費率車資
- Phase 3 = Trip Mileage & Fare；原 Advanced Dispatch／Communication 改列 **Phase 4**（`PHASE-4-SPEC.md`）
- 同步路線圖：`MVP-SPEC`、`PHASE-2-SPEC`、`DATABASE-SPEC`、`API-SPEC`、`SYSTEM-ARCHITECTURE-SPEC`、`UI-UX-SPEC`、`DEVELOPMENT-STATUS`、`AGENTS.md`
- 未改 Backend／Frontend／Prisma migration／執行期行為

---

## TASK — Promote Pending to Phase 4 Specification

**Status:** completed（Spec only）

### 已完成

- 新增 `PHASE-4-SPEC.md`：Advanced Dispatch & Communication（僅規劃簡述）
- 各 Spec 路線圖 Pending → Phase 4；`AGENTS.md` 列入 Source of Truth
- 未改執行期行為
