# 白牌司機群派車系統
## UI/UX Specification v0.1

**Version：** v0.1  
**Status：** 第一版定案  
**Frontend：** Vue 3 / Vite / Vue Router / Pinia / Naive UI / Lucide Icons / CSS Variables + Scoped CSS

---

# 1. UI / UX Design Direction

SquidFlow 採：

**Modern SaaS Visual + Dispatch Console UX**

核心原則：

> 視覺上像現代 SaaS，操作上像 Dispatch / Operations Console。

視覺方向：

- Modern
- Clean
- Professional
- Clear visual hierarchy
- Appropriate whitespace
- Consistent components
- 不追求花俏動畫
- 不呈現傳統 ERP 的老舊視覺感

操作方向：

- 高效率
- Status 一眼可辨識
- 快速搜尋 / Filter
- 重要操作明確突出
- 減少不必要頁面跳轉
- 優先考慮 Dispatch / Operation 工作流程

### Admin

**Desktop-first**

Admin UI 主要用於：

- Order Management
- Driver Management
- Order Monitoring
- Dispatch Operation

UX 原則：

- 支援較高資訊密度
- Table / List / Filter / Search 為重要操作模式
- Status 必須清楚
- 常用操作要容易找到
- 可以使用 Sidebar / Drawer / Dialog
- 不需要把所有內容塞在單一頁面
- 保持專業 SaaS Dashboard 感

畫面方向：

- Dashboard = Status Summary + Dispatch Board
- 完整 Order List 在 `/orders`
- 快速建單、派單、查看狀態
- Dashboard 與訂單管理分頁，不把所有操作塞進同一畫面

### Driver

**Mobile-first**

Driver UI 的核心不是「完整資料展示」，而是：

> 快速看單 → 查看重要資訊 → 執行操作

UX 原則：

- 單手操作友善
- 大型觸控區域
- 重要操作清楚突出
- 減少不必要資訊
- 清楚呈現 Order Status
- 避免密集桌面式 Table
- 重要 CTA 應容易在手機上觸碰

Driver UI 可以採用：

- Cards
- List
- Large Buttons
- Bottom / Drawer based interaction
- 簡單清楚的狀態呈現

畫面方向：

- Mobile Web / PWA First
- 登入後快速查看新單、搶單、更新訂單狀態

---

# 2. Application Structure

```text
Authentication
└── Login

Admin
├── Dashboard
├── Orders
├── Order Detail
├── Create Order
├── Driver Management
└── Driver Detail

Driver
├── Open Orders
├── Order Detail
└── My Orders
```

---

# 3. Admin Navigation

```text
派車管理

訂單
司機

────────────

管理員
登出
```

---

# 4. Admin Dashboard

Admin 登入後進入 Dashboard。

Dashboard = **Status Summary + Dispatch Board**。

數量由 Backend 聚合，Frontend 不自行加總。

## 4.1 Status Summary

顯示六種 Order Status 數量。不顯示「全部」數量。

```text
DRAFT        2
OPEN         4
ACCEPTED     3
IN_PROGRESS  2
COMPLETED    1
CANCELLED    0
```

點擊 status → `/orders?status=<status>`。

## 4.2 Dispatch Board

四欄呈現目前派車狀況：

```text
┌───────────┬───────────┬───────────┬──────────────┐
│ DRAFT     │ OPEN      │ ACCEPTED  │ IN_PROGRESS  │
│     2     │     4     │     3     │      2       │
├───────────┼───────────┼───────────┼──────────────┤
│ Order     │ Order     │ Order     │ Order        │
│ Order     │ Order     │ Order     │ Order        │
└───────────┴───────────┴───────────┴──────────────┘
```

`COMPLETED` / `CANCELLED` 只出現在 Status Summary，不進入 Board。

Board card：

```text
ORD-20260915-026 · 王先生        NT$ 1,200
左營高鐵站 → 高雄小港機場
09/15 11:20 · 未指派
```

有 `customer_name` 才顯示姓名，不留空白。`price` / `destination` 未填顯示 `—`。未指派司機顯示未指派；已指派顯示司機 username。長地址以 ellipsis 單行顯示。

點擊卡片進入 Order Detail。

用途：

- 快速掌握目前訂單狀況
- 快速找出正在搶單與正在執行的訂單
- 保留看板的視覺感，但不把所有操作都塞進 Kanban

## 4.3 不包含

Dashboard 不包含：

```text
完整 Order List
搜尋 / 日期篩選
BI / 報表
Realtime
```

完整訂單搜尋 / 篩選 / 管理維持在 `/orders`。

---

# 5. Admin Orders

路徑：`/orders`

完整訂單搜尋 / 篩選 / 管理。不是 Dashboard 的一部分。

欄位：

```text
訂單編號
建立時間
客戶
上車地點
目的地
價格
司機
狀態
```

支援：

```text
日期篩選
狀態篩選
訂單編號 / 客戶搜尋
```

可由 Dashboard Status Summary 帶入 `?status=<status>`。

---

# 6. Admin Create Order

## Form

```text
建立派車單

客戶姓名
上車地點 *
目的地
價格
備註

[儲存草稿]    [發布搶單]
```

## 操作

### 儲存草稿

```text
建立
→ DRAFT
```

### 發布搶單

```text
建立
→ DRAFT
→ OPEN
```

---

# 7. Admin Order Detail

採「訂單資訊 + 狀態 / 操作 + Timeline」布局。

```text
┌──────────────────────────────────────────────┐
│ ORD-20260915-001                     OPEN     │
├─────────────────────────┬────────────────────┤
│ 訂單資訊                │ 訂單狀態            │
│                         │                    │
│ 客戶：王先生            │ OPEN               │
│                         │                    │
│                         │ 接單司機            │
│ 左營高鐵站               │ 尚無                │
│ ↓                       │                    │
│ 小港機場                 │ [取消訂單]          │
│                         │                    │
│ 價格：$1,200             │                    │
│ 備註：2件行李            │                    │
└─────────────────────────┴────────────────────┘

訂單紀錄

10:00  建立訂單
10:02  發布搶單
10:03  Driver A 查看
10:04  Driver A 搶單成功
```

---

# 8. Admin Order Actions

依 Order Status 顯示可用操作。

| Status | 操作 |
|---|---|
| `DRAFT` | 編輯 / 發布 / 刪除 |
| `OPEN` | 取消 |
| `ACCEPTED` | 取消 |
| `IN_PROGRESS` | 唯讀 |
| `COMPLETED` | 唯讀 |
| `CANCELLED` | 唯讀 |

---

# 9. Admin Driver Management

## Driver List

```text
┌─────────────────────────────────────────────────────────┐
│ 司機管理                                  [+ 新增司機] │
├─────────────────────────────────────────────────────────┤
│ 帳號      車牌      車輛            狀態        │
│ driver01  ABC-1234  Toyota Camry    ONLINE      │
│ driver02  DEF-5678  Toyota Sienta   OFFLINE     │
└─────────────────────────────────────────────────────────┘
```

## Driver Detail

```text
帳號
帳號狀態
Online Status

車牌
品牌
型號
車色
```

操作：

```text
編輯
停用 / 啟用
```

---

# 10. Admin Create Driver

```text
新增司機

帳號 *
密碼 *

車牌 *
品牌 *
型號 *
車色 *

[取消]    [建立司機]
```

建立後同時建立：

```text
User
Driver
```

---

# 11. Driver Navigation

Driver 採簡化導覽。

```text
可搶訂單
我的訂單
```

上方固定顯示：

```text
🟢 ONLINE
```

---

# 12. Driver Home — Open Orders

登入後進入「可搶訂單」。

```text
┌─────────────────────┐
│ 🚕 派車              │
│                     │
│ 🟢 ONLINE            │
│ [切換 OFFLINE]       │
├─────────────────────┤
│ 新訂單                │
│                     │
│ 左營高鐵站            │
│ ↓                    │
│ 小港機場              │
│                     │
│ $1,200                │
│                     │
│ [查看訂單]            │
└─────────────────────┘
```

---

# 13. Driver Order Detail

```text
┌─────────────────────┐
│ ← 訂單詳情            │
├─────────────────────┤
│                     │
│ 左營高鐵站            │
│        ↓             │
│ 小港機場              │
│                     │
│ 價格：$1,200          │
│ 備註：2件行李          │
│                     │
│ [     我要接單     ]   │
└─────────────────────┘
```

---

# 14. Driver Accept Order

點擊「我要接單」。

```text
搶單中...
```

### 成功

```text
✅ 接單成功
```

Order：

```text
OPEN → ACCEPTED
```

### 失敗

```text
❌ 此訂單已被其他司機接走
```

或：

```text
❌ 目前無法接單
```

---

# 15. Driver My Orders

分為：

```text
目前訂單
歷史訂單
```

## 目前訂單

```text
左營高鐵 → 小港機場
ACCEPTED

[開始行程]
```

開始後：

```text
IN_PROGRESS

[完成訂單]
```

## 歷史訂單

顯示：

```text
日期
行程
狀態
```

---

# 16. Driver Online / Offline

狀態：

```text
ONLINE
OFFLINE
```

### ONLINE

- 可以收到新訂單通知
- 可以搶單

### OFFLINE

- 不接收新訂單通知
- 不可搶新訂單

切換 OFFLINE 時：

```text
確定要下線嗎？

下線後將不再收到新的派車通知。

[取消] [確定]
```

---

# 17. Web Push Notification

收到新訂單：

```text
🚕 新派車單

左營高鐵站 → 小港機場
$1,200

查看訂單
```

有 destination：`pickup → destination`。無 destination：只顯示 pickup。
有 price 才顯示價格，不產生空字串或 `$0`。不含預約時間與車型。

點擊後直接進入 Order Detail。

---

# 18. Status Visual Consistency

全系統 Status 必須使用一致的：

- 文字
- 視覺語意
- Color / Tag / Badge 規則

不允許不同頁面自行發明新的 status visual language。

## 18.1 Order Status

```text
DRAFT        草稿
OPEN         搶單中
ACCEPTED     已接單
IN_PROGRESS  行程中
COMPLETED    已完成
CANCELLED    已取消
```

語意對應：

```text
DRAFT        Muted
OPEN         Warning
ACCEPTED     Info
IN_PROGRESS  Primary
COMPLETED    Success
CANCELLED    Danger
```

## 18.2 Account / Driver Status

```text
ACTIVE       啟用
SUSPENDED    停用
ONLINE       上線
OFFLINE      離線
```

語意對應：

```text
ACTIVE       Success
SUSPENDED    Danger
ONLINE       Success
OFFLINE      Muted
```

`ACTIVE` / `SUSPENDED` 是帳號狀態。  
`ONLINE` / `OFFLINE` 是上線狀態。  
兩者分開顯示，不可混用同一組視覺規則造成語意混淆。

---

# 19. UX Rules

### Admin

- 首頁以 Dashboard 為主
- Status Summary 點擊後到 `/orders?status=<status>`
- Dispatch Board 提供看板感
- 完整 Order List 在 `/orders`
- 建單盡量單頁完成
- 發布後訂單唯讀
- 只顯示目前狀態可執行的操作

### Driver

- 登入後直接看到可搶訂單
- Online Status 固定可見
- 新訂單優先使用 Web Push 通知
- 搶單按鈕明確、醒目
- 一個畫面完成主要操作
- 僅顯示 Driver 可操作的功能

---

# 20. Responsive Design

### Admin

主要支援：

```text
Desktop
Laptop
Tablet
```

### Driver

主要支援：

```text
Mobile
Tablet
```

Driver UI 以 Mobile First 設計。

---

# 21. MVP UI Scope


```text
Authentication
└── Login

Admin
├── Dashboard
├── Orders
├── Create Order
├── Order Detail
├── Driver List
└── Driver Detail / Edit

Driver
├── Open Orders
├── Order Detail
└── My Orders
```


---

# 22. UI Framework & Styling

## Naive UI

Naive UI 是 SquidFlow 的主要 Vue UI Component Library。

主要用途包含但不限於：

- Button
- Input
- Select
- Form
- Data Table
- Dialog
- Drawer
- Dropdown
- Tag / Badge
- Notification / Message
- Date Picker
- Pagination
- Loading
- Empty State

原則：

> 優先使用 Naive UI 提供的既有元件，不重複自行建立已有的基礎 UI 元件。

## Lucide Icons

系統 Icon 優先使用 Lucide。

- 不要在不同頁面自行混用多套 Icon Library
- 不因單一頁面需求引入另一套 Icon Library

## Styling

目前採：

```text
CSS Variables + Scoped CSS
```

不使用 Tailwind CSS。  
不建立新的 CSS Framework。  
不因 UI Framework 使用需求而增加其他大型 styling framework。

---

# 23. Design Tokens

目前只定義 Token 類型，不建立獨立 design-system package。

實作時以 CSS Variables 表達，全系統共用。

## Color

```text
Primary
Success
Warning
Danger
Info
Background
Surface
Text
Muted Text
Border
```

## Typography

```text
Page Title
Section Title
Body
Label
Caption
Important Number / Price
```

## Spacing

採一致 spacing scale：

```text
4 / 8 / 12 / 16 / 24 / 32
```

不要每個頁面任意創造新的 spacing。

## Radius

保持簡單且一致，主要使用：

```text
4 / 8 / 12
```

不要每個 component 自行設定不同 radius。

---

# 24. Component Usage Rules

1. 優先使用 Naive UI 現有元件。
2. 不重複建立已有基礎元件。
3. 不因單一頁面需求引入新的 UI Framework。
4. 不因單一頁面需求引入新的 Icon Library。
5. Product-specific component 可以建立，但應建立在 Naive UI 基礎元件之上。
6. Business Logic 不應因 UI framework 而進入 Presentation Layer。
7. Frontend 不得取代 Backend 的 Business Rule。
