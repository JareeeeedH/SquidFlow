# 白牌司機群派車系統
## Technology Specification v0.1

**版本：** v0.1  
**狀態：** 第一版定案  
**適用階段：** MVP

---

### Frontend

```text
Vue 3
Vite
TypeScript
Vue Router
Pinia
Naive UI
Lucide Icons
CSS Variables
Scoped CSS
```

Naive UI 是主要 Vue UI Component Library。

Lucide 是系統 Icon Library。

樣式策略：

```text
CSS Variables + Scoped CSS
```

MVP 前端不使用：

```text
Tailwind CSS
Vuetify
Element Plus
PrimeVue
Quasar
其他 UI Framework
其他大型 CSS Framework
```

不因單一頁面需求引入另一套 UI Framework 或 Icon Library。

Frontend 只負責 UI、互動與 API 呼叫。Business Rule 由 Backend 保證。

### Backend
Node.js / NestJS / TypeScript

### Database
PostgreSQL / Prisma

### API
REST API

### Notification
Web Push

### Architecture
Modular Monolith

### Deployment
Docker

### Version Control
Git / GitHub

### MVP 暫不使用
Redis / WebSocket / SSE / Message Queue / Microservices / Kubernetes
