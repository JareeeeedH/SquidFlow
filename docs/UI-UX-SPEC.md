# 白牌司機群派車系統
## UI/UX Specification v0.1

**Version：** v0.1  
**Status：** 第一版定案  
**Frontend：** Vue 3 / Vite / Vue Router / Pinia

---

# 1. UI / UX Design Direction

### Admin

- Desktop Web First
- Dashboard + Status Board + Order List
- 高資訊密度
- 快速建單、派單、查看狀態
- 操作集中於單一工作區

### Driver

- Mobile Web / PWA First
- 簡化操作
- 大型操作按鈕
- 單手操作優先
- 快速查看新單、搶單、更新訂單狀態

---

# 2. Application Structure

```text
Authentication
└── Login

Admin
├── Dashboard / Orders
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

## 4.1 Status Summary

```text
全部        12
DRAFT        2
OPEN         4
ACCEPTED     3
IN_PROGRESS  2
COMPLETED    1
CANCELLED    0
```

點擊狀態可快速篩選訂單。

## 4.2 Order Status Board

以狀態區塊呈現目前派車狀況：

```text
┌───────────┬───────────┬───────────┬──────────────┐
│ DRAFT     │ OPEN      │ ACCEPTED  │ IN_PROGRESS  │
│     2     │     4     │     3     │      2       │
├───────────┼───────────┼───────────┼──────────────┤
│ Order     │ Order     │ Order     │ Order        │
│ Order     │ Order     │ Order     │ Order        │
└───────────┴───────────┴───────────┴──────────────┘
```

用途：

- 快速掌握目前訂單狀況
- 快速找出正在搶單與正在執行的訂單
- 保留看板的視覺感，但不把所有操作都塞進 Kanban

## 4.3 Order List

Dashboard 下方提供完整訂單列表。

欄位：

```text
訂單編號
預約時間
客戶
上車地點
目的地
車型
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

---

# 5. Admin Create Order

## Form

```text
建立派車單

客戶姓名 *
上車地點 *
目的地 *
預約日期 *
預約時間 *
車型 *
價格 *
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

# 6. Admin Order Detail

採「訂單資訊 + 狀態 / 操作 + Timeline」布局。

```text
┌──────────────────────────────────────────────┐
│ ORD-20260915-001                     OPEN     │
├─────────────────────────┬────────────────────┤
│ 訂單資訊                │ 訂單狀態            │
│                         │                    │
│ 客戶：王先生            │ OPEN               │
│ 預約：15:30              │                    │
│                         │ 接單司機            │
│ 左營高鐵站               │ 尚無                │
│ ↓                       │                    │
│ 小港機場                 │ [取消訂單]          │
│                         │                    │
│ 車型：5人座             │                    │
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

# 7. Admin Order Actions

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

# 8. Admin Driver Management

## Driver List

```text
┌─────────────────────────────────────────────────────────┐
│ 司機管理                                  [+ 新增司機] │
├─────────────────────────────────────────────────────────┤
│ 帳號      車型    車牌      車輛            狀態        │
│ driver01  5人座   ABC-1234  Toyota Camry    ONLINE      │
│ driver02  7人座   DEF-5678  Toyota Sienta   OFFLINE     │
└─────────────────────────────────────────────────────────┘
```

## Driver Detail

```text
帳號
帳號狀態
Online Status

車型
車牌
品牌
型號
車色
年份
```

操作：

```text
編輯
停用 / 啟用
```

---

# 9. Admin Create Driver

```text
新增司機

帳號 *
密碼 *

車型 *
車牌 *
品牌 *
型號 *
車色 *
年份 *

[取消]    [建立司機]
```

建立後同時建立：

```text
User
Driver
```

---

# 10. Driver Navigation

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

# 11. Driver Home — Open Orders

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
│ 15:30                │
│ 左營高鐵站            │
│ ↓                    │
│ 小港機場              │
│                     │
│ 5人座                 │
│ $1,200                │
│                     │
│ [查看訂單]            │
└─────────────────────┘
```

---

# 12. Driver Order Detail

```text
┌─────────────────────┐
│ ← 訂單詳情            │
├─────────────────────┤
│                     │
│ 15:30               │
│                     │
│ 左營高鐵站            │
│        ↓             │
│ 小港機場              │
│                     │
│ 車型：5人座           │
│ 價格：$1,200          │
│ 備註：2件行李          │
│                     │
│ [     我要接單     ]   │
└─────────────────────┘
```

---

# 13. Driver Accept Order

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

# 14. Driver My Orders

分為：

```text
目前訂單
歷史訂單
```

## 目前訂單

```text
15:30
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

# 15. Driver Online / Offline

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

# 16. Web Push Notification

收到新訂單：

```text
🚕 新派車單

15:30
左營高鐵站 → 小港機場
5人座 / $1,200

查看訂單
```

點擊後直接進入 Order Detail。

---

# 17. Order Status Display

全系統使用一致的狀態：

```text
DRAFT
OPEN
ACCEPTED
IN_PROGRESS
COMPLETED
CANCELLED
```

UI 使用一致的視覺標示：

```text
DRAFT
草稿

OPEN
搶單中

ACCEPTED
已接單

IN_PROGRESS
行程中

COMPLETED
已完成

CANCELLED
已取消
```

---

# 18. UX Rules

### Admin

- 首頁以 Dashboard 為主
- Status Summary 可快速篩選
- Status Board 提供看板感
- Order List 提供完整資訊
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

# 19. Responsive Design

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

# 20. MVP UI Scope

```text
Authentication
└── Login

Admin
├── Dashboard / Orders
├── Create Order
├── Order Detail
├── Driver List
└── Driver Detail / Edit

Driver
├── Open Orders
├── Order Detail
└── My Orders
```