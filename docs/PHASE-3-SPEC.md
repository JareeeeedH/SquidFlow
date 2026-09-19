# SquidFlow — White-label Driver Dispatch System
## Phase 3 Product Specification

**Document:** `PHASE-3-SPEC.md`  
**Status:** Product scope confirmed (source of truth for Phase 3 product rules)  
**Phase:** Phase 3 — Trip Mileage & Fare Calculation  
**Version:** v1.0  
**Relationship to earlier phases:** Extends Phase 1 Order lifecycle and Phase 2 GPS. Does **not** change Accept / claim-order rules. Does **not** replace Phase 2 straight-line Driver→Pickup distance (that remains reference-only, not billed).

---

# 1. Purpose and Authority

計算 Driver 執行訂單期間的**實際移動里程**，並依固定費率產生訂單車資。

```text
ACCEPTED
  ↓
開始任務
  ↓
IN_PROGRESS
  ↓
GPS 10 秒更新＋累積里程
  ↓
完成任務
  ↓
鎖定最終里程
  ↓
計算車資
  ↓
寫入 Order
```

## 1.1 Source of truth

`PHASE-3-SPEC.md` 是 Phase 3 **產品範圍與產品規則**的來源。

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
| `IN_PROGRESS` 期間實際移動里程（本 Phase） | **車資計算依據** |

Phase 2 的 GPS / Distance / Map 規則繼續保留。

---

# 4. GPS Frequency

| 情境 | 頻率 |
|------|------|
| 一般 `ONLINE`（非本訂單里程追蹤） | 每 **30** 秒更新一次 |
| 本訂單 `IN_PROGRESS` | 每 **10** 秒更新一次（用於里程累計） |
| 完成任務後 | 停止該訂單里程追蹤；Driver GPS 回到 **30** 秒更新 |

**不**新增專用 GPS API，沿用：

```text
PATCH /api/v1/driver/location
```

Frontend 依 Order 狀態調整上報間隔；Backend 依規則決定是否計入里程。

---

# 5. Mileage Calculation

Driver 點擊「開始任務」並成功（`ACCEPTED` → `IN_PROGRESS`）後，開始本次里程追蹤。

## 5.1 Segment rules

- 第一個有效 GPS 點：**只作為起點，不計距離**
- 之後每次有效 GPS：相鄰點以 **Haversine** 計算距離並累加

```text
trip_distance_meters = Σ 相鄰有效 GPS 點距離
```

## 5.2 Out of scope for v1.0

本版本**不**加入：

- 最小距離過濾
- 最大速度過濾
- GPS smoothing

## 5.3 Scope by Order status

**僅**在 `IN_PROGRESS` 期間累積。

以下狀態**不**計入：`DRAFT`、`OPEN`、`ACCEPTED`、`COMPLETED`、`CANCELLED`。

開始任務前的 GPS **不**計入。

---

# 6. Destination

- `destination` 為選填，**不參與**車資計算
- 有／無 Destination：皆以 Driver **實際行駛里程**計費
- 無 Destination（Pickup → —）仍可正常累積里程與計費

---

# 7. Complete Task

Driver 執行：

```text
POST /api/v1/driver/orders/:id/complete
```

成功：`IN_PROGRESS` → `COMPLETED`

Backend 必須：

1. 結束該訂單里程追蹤
2. 使用目前已累積的有效里程
3. 鎖定 `trip_distance_meters`
4. 依費率計算 `price` 並寫入 Order
5. 停止該訂單後續里程累計

完成後**不得**再增加該訂單里程。

---

# 8. Fare Rate

| 項目 | 值 |
|------|-----|
| 起跳 | NT$100 |
| 基本里程 | 1.25 km（1250 m） |
| 超過基本里程 | 每完整增加 **200** 公尺 → **+ NT$5** |

## 8.1 Formula（以公尺）

```text
base_distance = 1250
base_fare = 100
increment_distance = 200
increment_fare = 5

if distance <= 1250:
  price = 100
else:
  price = 100 + floor((distance - 1250) / 200) × 5
```

## 8.2 Examples

| 行駛距離 | 車資 |
|----------|------|
| 1.25 km | NT$100 |
| 1.26 km | NT$100 |
| 1.44 km | NT$100 |
| 1.45 km | NT$105 |
| 1.64 km | NT$105 |
| 1.65 km | NT$110 |
| 1.85 km | NT$115 |
| 2.05 km | NT$120 |

---

# 9. Order Data

Order **新增**：

- `trip_distance_meters`

既有：

- `price` → Phase 3 完成任務後寫入的**最終車資**

完成任務後：

```text
trip_distance_meters = 最終實際里程
price = 依費率計算出的車資
```

**不**新增：`calculated_fare`、`final_price` 等第二套價格欄位。

建單／編輯時若仍允許 Admin 填寫 `price`（Phase 1 選填），該值在 **Complete 時必須被費率計算結果覆寫**；Complete 後的 `price` 以本 Phase 費率為唯一權威。

---

# 10. GPS Tracking State

系統只需保留：

- 上一個計費 GPS 點
- 目前累計里程

**不**保存：

- GPS History
- GPS Points 軌跡表
- GPS Track

任務完成後：

- 保留最終 `trip_distance_meters`
- Tracking state（上一點）清除

實作上得以 Order 欄位或等效 Backend 儲存持有「上一計費點 + 累計里程」，以支援 concurrency 與程序重啟；**不得**另建 history／track 表。細節見 `DATABASE-SPEC`／`SYSTEM-ARCHITECTURE-SPEC`。

---

# 11. Backend Authority

以下由 Backend 作為唯一權威：

- `trip_distance_meters`
- `price`（完成後最終車資）

Frontend **不**自行計算或寫入最終車資／最終里程。

---

# 12. GPS Failure

GPS 暫時失敗：

- 保留目前累計里程
- 下一個 10 秒週期繼續嘗試
- **不**改變 Order State
- **不**取消任務

GPS 缺失期間的實際路程**不推測、不補算**。

---

# 13. Concurrency

同一 Driver／Order 的 GPS request 可能同時抵達。

Backend **必須**保證：

- 里程不重複累加
- 舊 GPS 不覆蓋較新的 tracking state
- `trip_distance_meters` 與上一個計費 GPS 點保持一致
- 完成後不得再累積里程

Frontend **不**負責 concurrency control。

---

# 14. UI

`IN_PROGRESS`：

```text
已行駛 3.8 km
```

`COMPLETED`：

```text
行駛里程   8.4 km
車資       NT$275
```

**不**顯示 GPS 軌跡與計算細節。

顯示單位規則（產品）：累計里程以公里為主顯示（可小數）；車資以 NT$ 整數顯示（與費率一致）。細部排版見 `UI-UX-SPEC`。

---

# 15. Core Acceptance Flow

```text
Driver ACCEPTED
  ↓
開始任務
  ↓
IN_PROGRESS
  ↓
GPS 每 10 秒
  ↓
Haversine 累加
  ↓
完成任務
  ↓
鎖定最終里程
  ↓
依費率計算 price
  ↓
COMPLETED
  ↓
GPS 回 30 秒
```

---

# 16. Phase 3 Final Rules (Summary)

| 規則 | 值 |
|------|-----|
| 一般 GPS | 30 秒 |
| `IN_PROGRESS` GPS | 10 秒 |
| 起跳價 | NT$100 |
| 基本里程 | 1.25 km |
| 超過後 | 每完整 200 m + NT$5 |
| 里程來源 | 任務期間實際 GPS 累加 |
| 計算方式 | Haversine |
| Destination | 非必要、不計費 |
| `Order.price` | 最終系統計算車資 |
| GPS History | 不保存 |
| Backend | 最終權威 |

---

# 17. Out of Scope for Phase 3

- 道路距離／ETA／Google Routes
- GPS history／track 儲存
- 自動派車／AI Dispatch／第三方通訊（屬 Phase 4，見 `PHASE-4-SPEC.md`）
- 變更 Phase 1 Accept／搶單條件
- 以 P2-03 直線距離計費
