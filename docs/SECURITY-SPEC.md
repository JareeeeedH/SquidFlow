# 白牌司機群派車系統
## Security Specification v1.0

**版本：** v1.0  
**狀態：** 第一版定案  
**適用階段：** MVP

---

# 1. Security Principles

1. Backend 是最終安全邊界。
2. Frontend 不得視為安全機制。
3. User Input 一律視為不可信資料。
4. 敏感資訊不得明文儲存、寫入 Git 或 Log。
5. Security 設計以基礎防禦為主，避免 MVP 過度工程化。

---

# 2. Authentication & Session

- 使用 Username / Password。
- Password 必須使用 Hash 儲存。
- 使用 Server-side Session + HttpOnly Cookie。
- Production Cookie 必須使用 `Secure`，並設定適當 `SameSite`。
- Single Active Session：新 Session 建立後，舊 Session 必須失效。
- `SUSPENDED` User 不得登入。
- User 被停權後，既有 Session 必須立即失效。
- Production 使用 HTTPS。

---

# 3. Authorization & Ownership

- 所有權限由 Backend 驗證。
- Role：`ADMIN`、`DRIVER`。
- Frontend UI 不得作為權限控制。
- Backend 必須驗證 Resource Ownership。
- 知道 `id` 不代表有權限存取 Resource。
- Driver 不得存取其他 Driver 的受限 Order。
- Driver 不得更新或讀取其他 Driver 的 GPS 位置。
- 不得透過修改 `user_id`、`driver_id`、`order_id` 等參數繞過權限。

---

# 4. Input & Injection Protection

## Input Validation

- 所有 Request Body、Query、Path Parameters 必須由 Backend 驗證。
- Create / Update 只接受明確允許的欄位。
- 不得直接將整個 Request Body 映射至 Database Model。
- Driver location 上報必須由 Backend 驗證座標範圍：
  - `latitude`：`-90` ～ `90`
  - `longitude`：`-180` ～ `180`

## Injection

- SQL Query 使用 Prisma / Parameterized Query。
- 不得將 User Input 直接拼接成 SQL。
- User Input 不得直接當 HTML / JavaScript 執行。
- 不任意使用 `dangerouslySetInnerHTML`。
- 不得將未驗證 Input 直接傳入 Shell / OS Command。
- 不得讓 User Input 任意控制 Server File Path。

---

# 5. API Abuse Protection

- Login 必須具備基本 Brute-force Protection。
- 高風險 API 必須具備基本 Rate Limiting。
- 高風險 API 包含 Login、Accept、Publish、Cancel 等。
- API 必須限制 Request Body 與 Input Size。
- 防止異常請求大量消耗 Application / Database 資源。

目前不要求 Redis-based Distributed Rate Limiting。

Wave Dispatch 僅由 Backend 在 Publish 後執行；不新增 Client 可控的 Dispatch／Notify API，避免繞過資格檢查或重送通知。

---

# 6. CSRF & Browser Security

- Cookie-based Session 必須具備基本 CSRF 防護。
- 使用適當的 `SameSite`、HTTPS、Origin / Referer Check 或 CSRF Token。
- Production 設定基本 Security Headers：
  - Content-Security-Policy
  - X-Content-Type-Options
  - Referrer-Policy
  - Frame Protection
  - HSTS

---

# 7. Secrets & Logging

- Secrets 不得 Hard-code 或 Commit 到 Git。
- Password、Password Hash、Session Token、API Key、Secret、Private Key、Database Credentials 不得寫入 Log。
- 敏感資訊不得回傳給 Client。
- `OrderEvent.metadata` 不得存放敏感資訊。

---

# 8. Error Handling

Production Error 不得暴露：

- Stack Trace
- SQL / Database Error
- Server File Path
- Environment Variables
- Framework Internal Details

使用統一 Error Format：

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Internal server error"
  }
}
```

---

# 9. Order & Business Logic Security

- Order State Transition 必須由 Backend 控制。
- Backend 必須驗證目前 Order State。
- Frontend 不得直接決定 Order Status。
- Accept 必須確認：
  - Order = `OPEN`
  - Driver = `ACTIVE`
  - Driver = `ONLINE`
  - Driver 沒有其他 unfinished Order
- 多個 Driver 同時 Accept 時，只允許一個成功。
- Concurrency Control 必須由 Backend / Database 保證。
- `OrderEvent` 用於 Order History / Audit，不作為 Concurrency Control。

---

# 9A. Driver Location Security（Phase 2 / P2-01）

產品規則見 `PHASE-2-SPEC.md`（P2-01）。沿用既有 `ADMIN` / `DRIVER` 授權模型，不新增 Role 或 Permission 體系。

- Driver location update / read 必須通過 Authentication；僅 `DRIVER`。
- Driver 只能更新／讀取**自己的**最新位置。
- Admin 讀取 Online Driver locations 必須通過既有 Admin Authorization（僅 `ADMIN`）。
- Admin Online locations API 只回傳 `ONLINE` Drivers；不因此開放其他 Driver 的受限資源。
- 座標範圍必須由 Server-side Validation 強制執行。
- Location update **不得**改變 `online_status`。
- Location 相關 API 不引入道路距離、ETA，或 Google Routes API。

---

# 9B. Pickup Geocoding Security（Phase 2 / P2-02）

產品選定 Provider：**Google Geocoding API**。見 `PHASE-2-SPEC.md` P2-02。

- **Geocoding server key**（例如 `GOOGLE_GEOCODING_API_KEY`）**不得**進入 Frontend 或 Git；僅 Backend Environment Variables／既有 Secrets 規範。
- Provider Geocoding 呼叫僅允許 Backend。
- Error response / Log **不得**暴露 API key 或 provider secrets。
- **不**新增 Driver（或任何角色）可呼叫的公開 Geocoding endpoint。
- **不**把 Pickup lat/lng 寫入 Database；避免以 DB 做長期座標倉儲。
- **不**新增 Role／Permission 體系。
- **不**引入 Google Routes API。

> 說明：本節約束的是 **Geocoding server key**。P2-04 的 Google Maps JavaScript API 使用**分開的** Frontend-restricted key，見 §9D；兩把 key 不得混用或把 Geocoding server key 放到瀏覽器。

---

# 9C. Straight-line Distance Security（Phase 2 / P2-03）

產品規則見 `PHASE-2-SPEC.md` P2-03。

- Distance 由 Backend 計算；Frontend **不得**自行發明搶單／狀態規則。
- Driver 只能取得**自己的** `distance_meters`（附加於自己可讀的 Order API）；**不得**讀取其他 Driver 的 Distance。
- Admin Online Driver distances（`GET /api/v1/orders/:id/online-driver-distances`）僅 `ADMIN`；只含 `ONLINE` Drivers。
- **不**新增公開 Geocoding endpoint；Pickup 座標僅經內部 `GeocodingService.getPickupCoordinates`。
- **不**把 Distance 或 Pickup lat/lng 寫入 Database。
- Distance 為參考資訊；**不得**改變 claim-order 條件或 Order State。
- **不**新增 Role／Permission 體系。
- **不**引入 Google Routes API、道路距離、或 ETA。

---

# 9D. Map & Navigation Security（Phase 2 / P2-04）

產品選定 in-app Map SDK：**Google Maps JavaScript API**；導航為 Google Maps handoff。見 `PHASE-2-SPEC.md` P2-04。

- Maps JavaScript API 使用**分開的** Frontend-restricted browser key（Environment／build 注入；建議限制 HTTP referrer／應用程式限制）。
- **Geocoding server key 不得**進入 Frontend、Git，或與 Maps browser key 混用。
- Frontend **不得**直接呼叫 Google Geocoding API；Pickup 座標僅經 Backend Order Detail 的 ephemeral 欄位或既有內部 geocode。
- Ephemeral `pickup_latitude`／`pickup_longitude` 僅提供給已授權的 Admin Order Detail 或 Driver 可讀 Order Detail；**不**等同公開 Geocoding endpoint。
- Driver Map 只能使用**自己的**位置 + 該 Order Pickup；**不得**藉 Map API 取得其他 Driver 位置（Admin Online Drivers API 除外且僅 ADMIN）。
- Map 載入失敗、key 缺失、導航 handoff 失敗：**不得**改變 Order State、Accept、或 Online／Offline。
- **不**把 Pickup lat/lng／route／ETA 寫入 Database。
- **不**新增 Role／Permission 體系。
- **不**引入 Google Routes API、道路距離、App 內 turn-by-turn。

---

# 10. MVP Security Baseline

SquidFlow MVP 必須至少具備：

- Authentication / Session Security
- Backend Authorization
- Resource Ownership / IDOR Protection
- Input Validation
- SQL Injection Protection
- XSS Protection
- Parameter Tampering Protection
- Basic Command / Path Traversal Protection
- Login Brute-force Protection
- API Rate Limiting
- Request Size Limit
- CSRF Protection
- HTTPS / Secure Cookie
- Basic Security Headers
- Secrets Protection
- Secure Error Handling
- Order Business Logic / Concurrency Protection
- Driver Location Ownership / Coordinate Validation（Phase 2 / P2-01）
- Straight-line Distance Visibility／Ownership（Phase 2 / P2-03）
- Map／Navigation Key Separation & Failure Isolation（Phase 2 / P2-04）

---

# 11. Out of Scope for MVP

目前不要求：

- MFA
- OAuth / SSO
- Advanced RBAC
- WAF
- SIEM
- Zero Trust
- Enterprise Security Monitoring
- Advanced DDoS Protection
- Distributed Security Infrastructure
- Location history storage / real-time tracking infrastructure（Phase 2 亦不實作）
