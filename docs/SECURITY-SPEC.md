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
- 不得透過修改 `user_id`、`driver_id`、`order_id` 等參數繞過權限。

---

# 4. Input & Injection Protection

## Input Validation

- 所有 Request Body、Query、Path Parameters 必須由 Backend 驗證。
- Create / Update 只接受明確允許的欄位。
- 不得直接將整個 Request Body 映射至 Database Model。

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
