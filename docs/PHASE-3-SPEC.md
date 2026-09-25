# SquidFlow — White-label Driver Dispatch System
## Phase 3 Product Specification

**Document:** `PHASE-3-SPEC.md`  
**Status:** Product scope confirmed (source of truth for Phase 3 product rules)  
**Phase:** Phase 3 — Trip Mileage & Fare Calculation  
**Version:** v1.1  
**Related ADR:** `docs/adr/0001-arrive-and-final-fare.md`  
**Relationship to earlier phases:** Extends Phase 1 Order lifecycle and Phase 2 GPS. Does **not** change Accept / claim-order rules. Does **not** replace Phase 2 straight-line Driver→Pickup distance (that remains reference-only, not billed). Does **not** add a new Order Status.

---

# 1. Purpose and Authority

計算 Driver 執行訂單期間的**實際移動里程**，在「抵達」時鎖定里程並產生系統車資，再由 Driver 確認最終價格後完成訂單。

```text
ACCEPTED
  ↓
開始任務
  ↓
IN_PROGRESS
  ↓
GPS 10 秒更新＋累積里程（尚未抵達）
  ↓
[抵達]
  ↓
Backend 取得最新 GPS
  ↓
計算最後一段 mileage
  ↓
鎖定最終 trip_distance_meters
  ↓
依最終 mileage 計算 calculated_fare
  ↓
寫入 arrived_at
  ↓
仍維持 IN_PROGRESS
  ↓
Frontend 顯示 calculated_fare，Driver 可修改
  ↓
[完成] 送出 final_fare
  ↓
Backend 驗證並儲存 final_fare
  ↓
status → COMPLETED
```

## 1.1 Source of truth

`PHASE-3-SPEC.md` 是 Phase 3 **產品範圍與產品規則**的來源。  
抵達／最終車資決策見 `docs/adr/0001-arrive-and-final-fare.md`。

若其他 Spec 仍描述不同的 Phase 3 內容，以本文件為準，直到技術 Spec 同步完成。

## 1.2 What this document is / is not

- 是產品／需求 Spec
- **不是**實作 TASK 清單
- 詳細 API path、Schema migration、security 矩陣須同步於 `API-SPEC`、`DATABASE-SPEC`、`SYSTEM-ARCHITECTURE-SPEC`、`UI-UX-SPEC`

---

# 2. Product Phase Positioning

```text
Phase 1 — Core Dispatch MVP (implemented)
Phase 2 — Driver Location & Trip Information (implemented)
Phase 3 — Trip Mileage & Fare Calculation (this document)
Phase 4 — Advanced Dispatch & Communication（見 PHASE-4-SPEC.md）
```

---

# 3. Distinction from Phase 2 GPS / Distance

| 功能 | 用途 |
|------|------|
| Driver → Pickup 直線距離（P2-03） | 參考資訊，**不計費** |
| `IN_PROGRESS` 且尚未抵達期間的實際移動里程（本 Phase） | **車資計算依據** |

Phase 2 的 GPS / Distance / Map 規則繼續保留。

Local / DEV：真實 browser GPS 自動回傳維持關閉；DEV GPS Simulator 可繼續呼叫既有 `updateDriverLocation`（見 Frontend GPS 規則）。

---

# 4. Order Status（不變）

**不**新增 Order Status。Status 仍為：

```text
DRAFT / OPEN / ACCEPTED / IN_PROGRESS / COMPLETED / CANCELLED
```

「已抵達、等待最終價格確認」以 **`arrived_at != null`** 表示，**不是**新狀態。  
抵達後仍為 `IN_PROGRESS`，直到 Complete 成功才變 `COMPLETED`。

---

# 5. GPS Frequency

| 情境 | 頻率 |
|------|------|
| 一般 `ONLINE`（非本訂單里程追蹤） | 每 **30** 秒更新一次 |
| 本訂單 `IN_PROGRESS` | 每 **10** 秒更新一次（用於里程累計與地圖） |
| 完成任務後 | 停止該訂單里程追蹤；Driver GPS 回到 **30** 秒更新 |

**不**新增專用 GPS API，沿用：

```text
PATCH /api/v1/driver/location
```

Frontend 依 Order 狀態調整上報間隔；Backend 依規則決定是否計入里程。

抵達後、完成前：仍可更新 Driver 最新位置（地圖／定位），但**不得**再累加該訂單里程。

---

# 6. Mileage Calculation

Driver 點擊「開始任務」並成功（`ACCEPTED` → `IN_PROGRESS`）後，開始本次里程追蹤。

## 6.1 Segment rules

- 第一個有效 GPS 點：**只作為起點，不計距離**
- 之後每次有效 GPS：相鄰點以 **Haversine** 計算距離並累加

```text
trip_distance_meters = Σ 相鄰有效 GPS 點距離
```

## 6.2 When mileage accumulates

**僅**在以下條件同時成立時累積：

1. Order `status = IN_PROGRESS`
2. `arrived_at` 為 `null`（尚未抵達）

以下**不**計入：

- `DRAFT`、`OPEN`、`ACCEPTED`、`COMPLETED`、`CANCELLED`
- 開始任務前的 GPS
- **抵達之後**的 GPS（里程已鎖定）

## 6.3 Arrival last segment

Driver 執行「抵達」時，Request 必須帶最新 `latitude`／`longitude`。Backend：

1. 以該點作為最後一個有效 GPS 點
2. 若已有上一計費點，計算最後一段距離並累加
3. **鎖定** `trip_distance_meters`（最終實際里程）
4. 依費率寫入 `calculated_fare`
5. 寫入 `arrived_at`
6. 清除該訂單里程追蹤用的上一計費點（後續 GPS 不再累加）
7. **不**改變 `status`（仍為 `IN_PROGRESS`）
8. **不**覆寫 `price`（原始派車價格）

## 6.4 Out of scope for v1.1

本版本**不**加入：

- 最小距離過濾
- 最大速度過濾
- GPS smoothing

---

# 7. Destination

- `destination` 為選填，**不參與**車資計算
- 有／無 Destination：皆以 Driver **實際行駛里程**計費
- 無 Destination（Pickup → —）仍可正常累積里程與計費

---

# 8. Arrive Task

Driver 執行：

```text
POST /api/v1/driver/orders/:id/arrive
```

### Request

```json
{
  "latitude": 22.5775,
  "longitude": 120.3500
}
```

### 成功效果

- `arrived_at` 寫入
- `trip_distance_meters` 鎖定為最終值
- `calculated_fare` 依最終里程寫入
- `status` 仍為 `IN_PROGRESS`
- 該訂單後續 GPS **不再**累加里程

僅允許目前接單 Driver；僅允許 `IN_PROGRESS` 且 `arrived_at == null`。

---

# 9. Complete Task

Driver 執行：

```text
POST /api/v1/driver/orders/:id/complete
```

### Request

```json
{
  "final_fare": 280
}
```

### 前置條件

- `status = IN_PROGRESS`
- `arrived_at != null`（必須先抵達）
- 僅目前接單 Driver

### 成功效果

1. 驗證並儲存 `final_fare`
2. `status` → `COMPLETED`
3. 寫入 `completed_at`
4. 停止該訂單後續里程累計（抵達時已鎖定；Complete 再次保證）

**不得**在未抵達時 Complete。  
**不得**覆寫 `price`（原始派車價格保留）。  
**不得**在 Complete 時重算或改寫已鎖定的 `trip_distance_meters`／`calculated_fare`（除非產品後續另定；本版本 Complete 只存 `final_fare`）。

---

# 10. Fare Rate

| 項目 | 值 |
|------|-----|
| 起跳 | NT$100 |
| 基本里程 | 1.25 km（1250 m） |
| 超過基本里程 | 每完整增加 **200** 公尺 → **+ NT$5** |

## 10.1 Formula（以公尺）

```text
base_distance = 1250
base_fare = 100
increment_distance = 200
increment_fare = 5

if distance <= 1250:
  fare = 100
else:
  fare = 100 + floor((distance - 1250) / 200) × 5
```

此公式用於：

- Arrive 時寫入 `calculated_fare`
- `IN_PROGRESS` 且尚未抵達時，UI「預估價格」顯示（見 §14；顯示用，非最終權威）

## 10.2 Examples

| 行駛距離 | 系統車資 |
|----------|----------|
| 1.25 km | NT$100 |
| 1.26 km | NT$100 |
| 1.44 km | NT$100 |
| 1.45 km | NT$105 |
| 1.64 km | NT$105 |
| 1.65 km | NT$110 |
| 1.85 km | NT$115 |
| 2.05 km | NT$120 |

---

# 11. Order Price Fields

| 欄位 | 意義 |
|------|------|
| `price` | **原始派車價格**（Admin 建單／編輯；Complete **不**覆寫） |
| `calculated_fare` | Backend 於 **Arrive** 依最終 mileage 計算的系統價格 |
| `final_fare` | Driver 於 **Complete** 確認並儲存的最終價格 |
| `trip_distance_meters` | 任務實際里程；於 **Arrive** 鎖定 |
| `arrived_at` | 抵達時間；`null` = 尚未抵達 |

完成任務後：

```text
trip_distance_meters = 最終實際里程（Arrive 鎖定）
calculated_fare      = 系統依費率計算結果（Arrive 寫入）
final_fare           = Driver 確認價格（Complete 寫入）
price                = 仍為原始派車價格
```

建單／編輯時 Admin 填寫的 `price` 維持參考／派車標價語意，**不是**完成後的最終車資權威。最終向乘客／結算語意以 `final_fare` 為準（系統建議值為 `calculated_fare`）。

---

# 12. GPS Tracking State

系統只需保留：

- 上一個計費 GPS 點（僅在尚未抵達時）
- 目前累計里程

**不**保存：

- GPS History
- GPS Points 軌跡表
- GPS Track

抵達後：

- 保留最終 `trip_distance_meters`、`calculated_fare`、`arrived_at`
- Tracking state（上一計費點）清除

任務完成後：

- 另保留 `final_fare`、`completed_at`

實作上得以 Order 欄位或等效 Backend 儲存持有「上一計費點 + 累計里程」，以支援 concurrency 與程序重啟；**不得**另建 history／track 表。細節見 `DATABASE-SPEC`／`SYSTEM-ARCHITECTURE-SPEC`。

---

# 13. Backend Authority

以下由 Backend 作為唯一權威：

- `trip_distance_meters`（Arrive 鎖定）
- `calculated_fare`（Arrive 計算）
- `final_fare`（Complete 驗證並儲存）
- `arrived_at`

Frontend：

- **不**自行寫入最終里程
- **不**自行寫入 `calculated_fare`／`arrived_at`
- Complete 時送出 Driver 確認的 `final_fare`；Backend 驗證格式並儲存
- 尚未抵達時的「預估價格」僅供 UI 顯示（可依目前 `trip_distance_meters` 套用 §10 公式），**不是**最終權威

---

# 14. UI

## 14.1 `IN_PROGRESS`（尚未抵達）

```text
已行駛 X km
預估價格  NT$…
價格      NT$…（原始派車 price，若有）

[抵達]  [完成]   ← 完成 disabled
```

- **不**顯示到 Pickup 的直線距離（P2-03；見 `UI-UX-SPEC`）
- 底部主操作改為 **[抵達]／[完成]**（非「滑動完成」）
- 未抵達時「完成」必須 disabled

## 14.2 `IN_PROGRESS`（已抵達，`arrived_at != null`）

```text
已行駛 X km（鎖定）
系統價格  NT$…（calculated_fare）
[價格輸入框，預填 calculated_fare，可修改]

[抵達 disabled 或隱藏]  [完成]
```

- Driver 可修改價格
- 按完成 → 送出 `final_fare`

## 14.3 `COMPLETED`

```text
行駛里程   X km
車資       NT$…（final_fare）
```

可另顯示原始派車 `price`／系統 `calculated_fare` 作為參考（細部見 `UI-UX-SPEC`）；**車資主顯示以 `final_fare` 為準**。

**不**顯示 GPS 軌跡與計算細節。

顯示單位規則（產品）：累計里程以公里為主顯示（可小數）；車資以 NT$ 整數顯示（與費率一致）。細部排版見 `UI-UX-SPEC`。

---

# 15. GPS Failure

GPS 暫時失敗：

- 保留目前累計里程
- 下一個 10 秒週期繼續嘗試
- **不**改變 Order State
- **不**取消任務

GPS 缺失期間的實際路程**不推測、不補算**。

Arrive 時若座標無效 → 失敗，不寫入 `arrived_at`，不鎖定里程。

---

# 16. Concurrency

同一 Driver／Order 的 GPS／Arrive／Complete request 可能同時抵達。

Backend **必須**保證：

- 里程不重複累加
- 舊 GPS 不覆蓋較新的 tracking state
- `arrived_at` 已設定後不得再累積里程
- Arrive 不可重複成功（已抵達再 Arrive → 錯誤）
- 未抵達不可 Complete
- Complete 後不得再累積里程／再 Arrive

Frontend **不**負責 concurrency control。

---

# 17. Core Acceptance Flow

```text
Driver ACCEPTED
  ↓
開始任務
  ↓
IN_PROGRESS（arrived_at = null）
  ↓
GPS 每 10 秒 + Haversine 累加
  ↓
抵達（帶最新 lat/lng）
  ↓
最後一段距離 + 鎖定 trip_distance_meters
  ↓
計算 calculated_fare + arrived_at
  ↓
仍為 IN_PROGRESS
  ↓
Driver 確認／修改價格
  ↓
完成（final_fare）
  ↓
COMPLETED
  ↓
GPS 回 30 秒
```

---

# 18. Phase 3 Final Rules (Summary)

| 規則 | 值 |
|------|-----|
| 一般 GPS | 30 秒 |
| `IN_PROGRESS` GPS | 10 秒 |
| 里程累積 | 僅 `IN_PROGRESS` 且尚未抵達 |
| 里程鎖定時機 | Arrive |
| 起跳價 | NT$100 |
| 基本里程 | 1.25 km |
| 超過後 | 每完整 200 m + NT$5 |
| `price` | 原始派車價格（不覆寫） |
| `calculated_fare` | Arrive 系統計算 |
| `final_fare` | Complete Driver 確認 |
| Destination | 非必要、不計費 |
| 新 Order Status | **不**新增 |
| GPS History | 不保存 |
| Backend | 最終權威 |

---

# 19. Out of Scope for Phase 3

- 道路距離／ETA／Google Routes
- GPS history／track 儲存
- 自動派車／AI Dispatch／第三方通訊（屬 Phase 4，見 `PHASE-4-SPEC.md`）
- 變更 Phase 1 Accept／搶單條件
- 以 P2-03 直線距離計費
- 新增 Order Status（例如 ARRIVED）
