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
- Dashboard 與訂單分頁，不把所有操作塞進同一畫面

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

## Desktop

左側固定導覽：

```text
派車管理

訂單
司機

────────────

管理員
登出
```

## Mobile（≤900px）

Compact header + hamburger drawer：

```text
[☰]  SquidFlow
```

Header 僅 Menu + Brand（不顯示 username）。Drawer 內為相同導覽項目、username 與登出。Desktop sidebar 維持不變。

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

- **Desktop：** 一列六格（窄螢幕可 3 欄）。
- **Mobile：** **3×2 compact grid**（六個 status 皆顯示）。

## 4.2 Dispatch Board

### Desktop

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

### Mobile

不使用四欄 Kanban。改為可收合狀態區，僅涵蓋：

```text
OPEN
ACCEPTED
IN_PROGRESS
```

Mobile Dashboard：

- 不顯示頁面標題「Dashboard」與副標「派車管理」
- 不顯示「重點訂單」區塊標題與說明文字
- Status Summary（3×2）後接可收合狀態區；保留「完整訂單」入口
- 各狀態區可收合／展開；展開後顯示該狀態全部訂單，預設收合（依 `board_orders` 的 `created_at` 降序）

草稿不進 Mobile 此區。完整訂單（含草稿／已完成／已取消與搜尋篩選）維持 `/orders`。

Board card（Desktop／Mobile 共用資訊）：

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
- Desktop 保留看板視覺；Mobile 聚焦執行中訂單，不把所有操作塞進 Kanban

## 4.3 自動刷新

Dashboard 與 Orders 共用下列規則（HTTP polling，非推播）：

- 頁面可見且使用者停留在該頁時，每 **30 秒** 自動重新取得最新資料
- 進入頁面時立即取得一次，不等待 30 秒
- 離開頁面或瀏覽器分頁不可見時停止 polling；回到頁面時立即 refresh
- 保留手動刷新（與自動刷新共用同一套 fetch／reload）
- 手動刷新 UI：正常顯示簡潔「**更新**」按鈕；進行中改為「**更新中...**」、icon **緩慢旋轉**、按鈕 disabled
- 手動刷新進行中：主內容區顯示**輕量 loading overlay**（保留頁面結構、不整頁跳轉、避免明顯 layout shift）
- 手動刷新完成後進入 **10 秒** cooldown；cooldown 期間不可再次手動刷新（**不**顯示倒數／Toast／「已更新」／「最後更新」等時間文字）
- 自動 polling：**靜默**更新資料；**不**顯示 Toast、overlay 或額外成功提示；不受手動 cooldown 影響
- 若已有 refresh request 進行中，**不**重複發送 request
- 只更新資料：不整頁 reload、不造成明顯閃爍
- **不**使用 WebSocket／SSE／Push 或其他即時通訊架構

## 4.4 不包含

Dashboard 不包含：

```text
完整 Order List
搜尋 / 日期篩選
BI / 報表
WebSocket / SSE / Push realtime
```

完整訂單搜尋 / 篩選 / 管理維持在 `/orders`。允許 §4.3 的 HTTP polling（30 秒）。

---

# 5. Admin Orders

路徑：`/orders`

頁面標題：**訂單**（不再使用「Orders」／「訂單列表」作為標題或副標）。

完整訂單搜尋 / 篩選 / 管理。與「訂單管理」為同一功能，導覽與 UI 用語統一為 **訂單**。不是 Dashboard 的一部分。

從 Order Detail／Create 返回時使用：**返回訂單**。

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

自動刷新規則同 §4.3（30 秒 HTTP polling；可見時執行；離開／隱藏停止；回頁立即 refresh；手動刷新 cooldown／回饋；不整頁 reload／明顯閃爍）。

### Desktop

DataTable 呈現。

### Mobile

改 **Card List**（不用橫向滑動 Table）。Compact card（約 80–90px）顯示：

```text
訂單號                         Status
客戶 · 路線（上車 → 目的地）
價格 · 時間
```

- Search 置頂保留
- Status Filter：**全部** + 六種 Order Status 以 Chips 呈現，顯示各狀態數量（數量來自既有 Dashboard `summary`）；預設「全部」；點擊即過濾列表（同步 `?status=`）
- Chips **自動換行**，不使用左右滑動
- **不**使用獨立「篩選」按鈕／Filter Drawer（Mobile）
- 排序維持 `created_at` 降序（既有 API）
- Desktop 維持 DataTable + Search／Status Select／Date Filter

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

沿用既有 Create + Publish API；不新增 Backend。

### Mobile

- 單欄表單
- 底部固定 CTA：`儲存草稿`／`發布搶單`
- Desktop 維持既有欄位與雙 CTA（底部 sticky／頁尾操作列）

---

# 7. Admin Order Detail

## Desktop

採置中雙欄，約 7:3。左側為訂單資訊與接單司機，右側為狀態 / 操作 / 時間。不提供 Order Events 讀取 API／Timeline UI。

```text
┌──────────────────────────────────────────────┐
│ ORD-20260915-001                     OPEN     │
├─────────────────────────┬────────────────────┤
│ 訂單資訊                │ 訂單狀態            │
│ 客戶：王先生            │ OPEN               │
│ 左營高鐵站 → 小港機場    │ [取消訂單]          │
│ NT$ 1,200               │ 建立時間            │
│ 備註：2件行李            │ 更新時間            │
│                         │                    │
│ 接單司機                │                    │
│ driver01                │                    │
└─────────────────────────┴────────────────────┘
```

未指派顯示尚無。已指派只顯示 Driver username，點擊進入 Driver Detail。車牌 / 車輛 / 車色不在此頁顯示。

## Mobile（≤900px）

Compact Detail View（高資訊密度；對齊 §9 Driver Detail Mobile 方向）。**不**使用多個大型 Card 堆疊。

```text
← 返回訂單
訂單詳情
ORD-…                          [Status]

客戶    王先生
行程    左營高鐵站 → 小港機場
價格    NT$ 1,200
備註    2件行李
接單司機  尚無 / driver01
────────────────
[地圖：Pickup + Online Drivers]
直線距離列（若有）
────────────────
建立時間  …（次要、較小字）

║ [編輯]  [發布] ║   ← sticky bottom（DRAFT）
  刪除（次要 destructive）
║ [取消訂單] ║       ← sticky（OPEN／ACCEPTED）
```

規則：

- Breakpoint 與 Admin Mobile 一致：**≤900px**
- 頁面頂部保留：返回訂單、訂單詳情、Order No、**Status Badge**
- **不再**重複顯示「訂單狀態」Card／Section（Status 只在頂部）
- **不**顯示「搶單中，可取消此訂單」等與 Status Badge 重複的狀態說明文案（頂欄 hint 與操作區旁白皆不需要）
- 訂單資訊採 **左右 label／value Compact Summary**（客戶／行程／價格／備註／接單司機）+ 緊湊分隔；**不**讓每欄各自佔大型垂直區塊
- 接單司機：標題維持「**接單司機**」；未指派顯示「尚無」；已指派僅 username 可點進 Driver Detail
- **地圖提前**：Compact Summary 之後盡早呈現地圖（非 DRAFT 且有座標／Online Drivers 時），使地圖更早進入首屏可視區；採緊湊區塊
- 時間戳降為次要資訊，置於地圖之後、內容較下方；以較小字體呈現（至少含建立時間；其他有值時間可一併列出）
- DRAFT 主要 CTA「編輯／發布」使用 **sticky bottom action bar**；「刪除」降為次要 destructive（較低視覺重量）
- OPEN／ACCEPTED：「取消訂單」置於 sticky／緊湊操作區，**不**另附「可取消此訂單」說明；IN_PROGRESS／COMPLETED／CANCELLED 維持唯讀（無主 CTA）
- Desktop 7:3 雙欄與右側狀態／操作／時間欄**不變**
- 不改變 Order State、API、資料結構或業務邏輯

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

### Desktop

DataTable：

```text
┌─────────────────────────────────────────────────────────┐
│ 司機管理                                  [+ 新增司機] │
├─────────────────────────────────────────────────────────┤
│ 帳號      車牌      車輛            狀態        │
│ driver01  ABC-1234  Toyota Camry    ONLINE      │
│ driver02  DEF-5678  Toyota Sienta   OFFLINE     │
└─────────────────────────────────────────────────────────┘
```

### Mobile

改 **Card List**（不用橫向滑動 Table）。Compact card（約 **70–80px**），高資訊密度：

```text
username                    [上線/離線] [啟用/停用]
車牌 · 品牌 型號 · 車色
```

- Status 使用緊湊 Badge，不額外拉高卡片
- 次要資訊併行，避免每欄各佔一行
- Desktop DataTable 維持不變

## Driver Detail

### Desktop

採置中雙欄，約 7:3。左側為 Driver Profile，右側為狀態 / 操作。

```text
┌──────────────────────────────────────────────┐
│ driver01                                     │
├─────────────────────────┬────────────────────┤
│ 帳號資訊                │ 狀態               │
│ 帳號：driver01          │ 帳號狀態 ACTIVE    │
│                         │ 上線狀態 OFFLINE   │
│ 車輛資訊                │                    │
│ 車牌：ABC-1234          │ 操作               │
│ 品牌 / 型號 / 車色      │ [編輯] [停用]      │
└─────────────────────────┴────────────────────┘
```

帳號狀態與上線狀態分開顯示。上線狀態只讀，由司機端切換。

### Mobile

保留返回入口。緊湊 Section + 分隔線（不使用過大多 Card 堆疊）：

```text
← 返回…
driver01
[上線/離線]  [啟用/停用]

帳號
driver01
────────────────
車輛
車牌 · 品牌 · 型號 · 車色
────────────────
[編輯]  [停用/啟用]
```

- CTA 為 compact 並排，不另設「操作」標題或上線狀態說明文案（狀態已由 Header Badge 表達）
- 上線狀態仍只讀；帳號狀態操作維持既有確認流程
- Desktop 雙欄不變

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

保留「帳號資訊 / 車輛資訊」分組、既有 validation、密碼 show-hide。

### Mobile

- 單欄表單
- 底部固定 CTA：`建立司機`
- Desktop 維持分組與操作列

---

# 11. Driver Navigation

Driver 採簡化導覽。

```text
可搶訂單
我的訂單
狀態
```

上方固定顯示品牌名稱 **SquidFlow** 與登出（可點品牌回狀態頁）。**不**在頂欄顯示裝飾 icon 或使用者名稱。Online / Offline **不**在頂欄重複顯示，只在狀態頁 Switch Bar。

導覽保留「狀態 / 可搶訂單 / 我的訂單」。

---

# 12. Driver Status Home

登入後進入狀態頁（導覽「狀態」）。視覺採白／淡灰底 + deep navy（`#0B1F3A`）header／accent，不使用大面積深色背景。

```text
┌─────────────────────┐
│ driver01  帳號狀態 [啟用] │
├─────────────────────┤
│ 上線狀態      [● 上線]│
│ 通知          [● 開啟]│
│ 目前可搶單…          │
└─────────────────────┘
```

帳號狀態與 Tag 同一行。進入／重整狀態頁時以 `GET /driver/status` hydrate 上線狀態，Switch 與 Server 一致。上線 / 通知採 compact switch。下線仍需確認。可搶訂單與我的訂單由上方導覽進入，Home 不重複列出入口。

---

# 13. Driver Open Orders

顯示可搶的 OPEN 訂單列表。採 compact card（約 3 行），不顯示 `customer_name`。

頁面標題僅 **可搶訂單**；**不**顯示「點選卡片查看行程」等副標提示。

```text
┌──────────────────────────────┐
│ 09/15 11:20  搶單中  NT$1,200 │
│ 左營高鐵站 → 高雄小港機場       │
│ ORD-…                   查看 → │
└──────────────────────────────┘
```

時間 / Status / Price 同層；路線最醒目；Order No 為 secondary。

路線採左右並排（上車 → 下車）：

- 兩側各自限制在可用寬度內（`min-width: 0`／等寬欄），不得互相撐開 layout
- 長地址允許自然換行，最多 **2 行**（不以單行 ellipsis 為主）
- 下車地為 `null` 時顯示「—」
- **不得**出現 horizontal scrollbar；以 flex／grid 寬度約束處理，不以 `overflow-x: hidden` 掩蓋

---

# 14. Driver Order Detail

路線與地圖為核心；價格／直線距離次之；Primary action 置底且清楚。

OPEN／ACCEPTED／IN_PROGRESS 的主操作皆為 **滑動確認 Bar**（非點擊按鈕）。

## Mobile layout

高資訊密度；減少大型 Card 與垂直留白。

```text
← 返回
ORD-…                 [Status]
09/15 11:20

左營高鐵站 → 高雄小港機場

[地圖]

直線距離    1.2 km
價格        NT$ 1,200

客戶        …
備註        …

║ 滑動接單 → ║
```

規則：

- 頂部：返回／Order No／Status／日期時間
- 緊湊路線（上車 → 下車）；降低 padding；長文字不得造成 horizontal overflow（寬度約束／換行；`null` 下車地顯示「—」）
- 路線後**立即**顯示地圖（功能維持：Pickup／自己位置 marker、開始導航等既有規則）
- 地圖下方：直線距離＋價格的 **Compact Summary**（左右 label／value；不各自大型 Card）；`distance_meters` 為 null 時不顯示距離列
- 客戶／備註降為次要 Compact 資訊，置於距離／價格之後
- **不**重複顯示已在頂部呈現的 Order No／Status
- 底部保留既有滑動確認（OPEN 接單／ACCEPTED 開始／IN_PROGRESS 完成）；未滑至末端不觸發；進行中 loading 鎖定；失敗後可再滑
- 不改變 Order State、API、Map／Distance 業務邏輯

- OPEN：滑動接單
- ACCEPTED：滑動開始行程
- IN_PROGRESS：滑動完成訂單

---

# 15. Driver Accept Order

滑動「接單」至末端確認。

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

開始行程／完成訂單同樣採滑動確認（見 §14／§16）。

---

# 16. Driver My Orders

不顯示頁面標題「我的訂單」與副標「目前訂單與歷史訂單」。結構：

```text
目前訂單
（目前訂單列表，或空狀態）
歷史訂單
（歷史列表）
```

- 保留「目前訂單」「歷史訂單」Section 標題
- 目前訂單空狀態保留 icon +「目前沒有進行中的訂單」；歷史訂單標題緊接其後
- Current / History 分層清楚；列表不顯示 `customer_name`
- 間距緊湊，不因移除頁面標題留下多餘空白

## 目前訂單

```text
目前訂單
09/15 11:20  已接單  NT$1,200
左營高鐵站 → 高雄小港機場
ORD-…
║ 滑動開始行程 → ║
```

開始後：

```text
IN_PROGRESS

║ 滑動完成訂單 → ║
```

列表與訂單詳情的開始／完成皆為滑動確認 Bar（規則同 §14）。

頂列為時間／Status／Price；Order No 在路線下方。路線換行／寬度約束規則同 §13。

## 歷史訂單

compact，無操作 CTA；標題 **歷史訂單** 保留：

```text
歷史訂單
2026-09-15
已完成
左營高鐵站 → 高雄小港機場
ORD-…
```

- 日期獨立一行；Status 次之；路線左右並排；Order No 在路線下方
- 路線換行／寬度約束規則同 §13（最多 2 行；`null` 下車地顯示「—」；無水平捲軸）

Route 為主要資訊；日期 / Order No / Status 為次要。

---

# 17. Driver Online / Offline

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

# 18. Web Push Notification

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

# 19. Status Visual Consistency

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

# 20. UX Rules

### Admin

- 首頁以 Dashboard 為主
- Status Summary 點擊後到 `/orders?status=<status>`
- Desktop Dispatch Board 提供看板感；Mobile 為 OPEN／ACCEPTED／IN_PROGRESS 可收合狀態區（預設收合；展開後顯示該狀態全部訂單）
- 完整訂單在 `/orders`（頁面標題「訂單」；Desktop Table／Mobile Card）
- 建單盡量單頁完成；Create 提供儲存草稿與發布搶單
- 發布後訂單唯讀
- 只顯示目前狀態可執行的操作
- Mobile Navigation：compact header + hamburger

### Driver

- 登入後進入狀態頁；可搶訂單與我的訂單由導覽進入
- Online Status 於狀態頁 Switch 顯示，並以 GET hydrate
- 上線 / 通知使用 compact switch
- Open / My Orders 使用 compact card；路線為主、單號為次；長地址最多 2 行換行，避免水平溢出
- deep navy 僅用於 header、accent、active、primary action
- 新訂單優先使用 Web Push 通知
- 搶單按鈕明確、醒目
- 一個畫面完成主要操作
- 僅顯示 Driver 可操作的功能

---

# 21. Responsive Design

### Admin

支援：

```text
Desktop
Laptop
Tablet
Mobile
```

Admin 採 **Responsive + Mobile-priority** 強化（compact header／Card List／sticky CTA），Desktop 維持 Dispatch Console DataTable／四欄看板。斷點參考：`≤900px` 為 Mobile 佈局。

### Driver

主要支援：

```text
Mobile
Tablet
```

Driver UI 以 Mobile First 設計。

---

# 22. MVP UI Scope

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
├── Status Home
├── Open Orders
├── Order Detail
└── My Orders
```

## Product Phase UI Boundary

```text
Phase 1 — 核心派車 MVP UI Scope（上表；已實作）
Phase 2 — Driver Location & Trip Information（地圖 / 直線距離相關 UI；已對齊）
Phase 3 — Advanced Dispatch & Communication（進階派車與通訊相關 UI）
```

產品範圍以 `PHASE-2-SPEC.md` 為準。Phase 3 UI 細節於進入該階段時再定義。目前不設計 Phase 3 通訊介面。Phase 2 UI **不**呈現道路距離或 ETA。維持既有 Modern SaaS + Dispatch Console 視覺／操作方向（見 §1）；不另開一套地圖產品視覺語言。

P2-02：不提供手動觸發 Geocoding 的 UI；Geocoding 為建單／修改 `pickup_location` 後的系統非同步行為。UI **不**假設 Order DB 內有 Pickup lat/lng 欄位；距離／地圖所需座標由 Backend 在執行期提供（見 `PHASE-2-SPEC.md` P2-02）。In-app Map SDK：**Google Maps JavaScript API**（P2-04）。

P2-03 Straight-line Distance UI（已對齊產品＋API contract）：

- 顯示資料來源：Backend `distance_meters`（見 `API-SPEC.md` §5C）；**不**由 Frontend 呼叫 Google／自行 geocode
- `distance_meters === null`（或缺欄位語意為無法計算）→ **不顯示**距離區塊；不得顯示假的道路距離或 ETA；**真實**直線距離為 `0` 時可顯示（與「缺座標不顯示」不同）
- 有值時必須標示 **「直線距離」**
- 單位：`< 1 km`（即 `< 1000` meters）→ 以 **meters** 顯示；`>= 1 km` → 以 **kilometers** 顯示
- 顯示捨入／小數精度（已確認）：`< 1 km` → **整數公尺**；`>= 1 km` → **小數一位公里**；標示 **「直線距離」**（見 `PHASE-2-SPEC.md` §6.5／§11）
- Driver：僅在相關 `OPEN`／`ACCEPTED`／`IN_PROGRESS` Order 情境顯示自己的直線距離；**不**顯示其他 Driver 的距離
- Admin：在 Dispatch／Dashboard／Order 情境，可顯示 ONLINE Drivers ↔ 該 Order Pickup 的直線距離（資料來自 `GET /api/v1/orders/:id/online-driver-distances`）
- Distance 僅為參考資訊；UI **不得**因距離改變搶單按鈕可用性或 Order State 操作規則（仍以 Phase 1 Backend 規則為準）

P2-04 Map & Navigation UI（已對齊）：

- Map SDK：Frontend 使用 **Google Maps JavaScript API**（browser-restricted key；**不得**使用 Geocoding server key）
- **Driver Order Detail**：顯示 Map（自己的最新位置 + Pickup）+ 直線距離（P2-03）+ **開始導航**
  - Pickup marker：僅當 `pickup_latitude`／`pickup_longitude` 皆有值
  - Driver marker：僅當有可用自己的最新位置（P2-01）
  - 「開始導航」：Driver **接單後**可用；handoff 至 Google Maps（外部）；缺座標時可降級用文字 `pickup_location`；失敗不影響 Order／Online 狀態
- **Admin Order／Dispatch context**：顯示 Online Drivers + Pickup Map
  - Online Driver markers：沿用 P2-01／P2-03 Admin APIs（僅 `ONLINE`）
  - Pickup：Admin Order Detail 的 ephemeral Pickup 座標
- Map 載入失敗、缺座標、key 缺失 → 隱藏或降級地圖區塊；**不得**阻擋訂單操作或 Online／Offline
- **不做** App 內 turn-by-turn、道路路線繪製、ETA／交通導航 UI
- Map chrome（已確認）：不強制像素級固定 Spec；維持既有 UI direction；**Driver 與 Pickup marker 必須可清楚區分**；地圖範圍合理可見（見 `PHASE-2-SPEC.md` §7.1／§11）

---

# 23. UI Framework & Styling

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

# 24. Design Tokens

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

# 25. Component Usage Rules

1. 優先使用 Naive UI 現有元件。
2. 不重複建立已有基礎元件。
3. 不因單一頁面需求引入新的 UI Framework。
4. 不因單一頁面需求引入新的 Icon Library。
5. Product-specific component 可以建立，但應建立在 Naive UI 基礎元件之上。
6. Business Logic 不應因 UI framework 而進入 Presentation Layer。
7. Frontend 不得取代 Backend 的 Business Rule。
