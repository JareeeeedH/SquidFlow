# ADR 0001 — Arrive step and final fare confirmation

**Status:** Accepted  
**Date:** 2026-09-25  
**Deciders:** Product / SquidFlow  
**Related:** `PHASE-3-SPEC.md` v1.1、`API-SPEC.md`、`DATABASE-SPEC.md`、`UI-UX-SPEC.md`、`MVP-SPEC.md`、`SYSTEM-ARCHITECTURE-SPEC.md`

---

## Context

Phase 3 v1.0 將「鎖定里程 + 依費率寫入車資 + 完成訂單」綁在單一 `complete` 動作，並以覆寫 `price` 作為最終車資。

實務上需要：

1. Driver 先標記**抵達**，讓系統用當下 GPS 收尾最後一段里程並鎖定。
2. 系統算出建議車資後，Driver 可**確認或修改**再完成。
3. 保留 Admin 建單時的**原始派車價格**，不要被系統車資蓋掉。
4. **不**為「等待確認價格」新增 Order Status（狀態機維持 Phase 1）。

---

## Decision

採用兩段式收尾，仍維持 `IN_PROGRESS` 直到 Complete：

```text
IN_PROGRESS (arrived_at = null)
  → POST /arrive（最新 lat/lng）
  → 鎖定 trip_distance_meters + calculated_fare + arrived_at
  → 仍為 IN_PROGRESS
  → Driver 編輯價格
  → POST /complete（final_fare）
  → COMPLETED
```

### Price fields

| Field | Meaning |
|-------|---------|
| `price` | 原始派車價格；Complete **不**覆寫 |
| `calculated_fare` | Arrive 時依最終里程計算的系統價格 |
| `final_fare` | Complete 時 Driver 確認並儲存的最終價格 |
| `arrived_at` | `!= null` 表示已抵達、等待最終價格確認 |

### Mileage

- 僅在 `IN_PROGRESS` 且 `arrived_at == null` 時累積。
- Arrive 納入 Request GPS 的最後一段距離後鎖定。
- Arrive 後 GPS 可更新位置，但不再累加該訂單里程。

### Fare formula（unchanged）

```text
distance <= 1250m → 100
distance > 1250m → 100 + floor((distance - 1250) / 200) * 5
```

結果寫入 `calculated_fare`（不再覆寫 `price`）。

### APIs

- `POST /api/v1/driver/orders/:id/arrive` — body: `latitude`, `longitude`
- `POST /api/v1/driver/orders/:id/complete` — body: `final_fare`；**必須**已抵達

### UI

- `IN_PROGRESS`：已行駛 + 預估價格；底部 **[抵達] [完成]**；未抵達時完成 disabled。
- 抵達後：價格 input 預填 `calculated_fare`，可改；完成送出 `final_fare`。
- OPEN／ACCEPTED 仍用既有滑動接單／開始行程。

### Local / DEV

- 真實 browser GPS 自動回傳維持關閉。
- DEV GPS Simulator 繼續可用。

---

## Consequences

### Positive

- 原始派車價與系統／最終車資語意分離。
- 無需新 Status，狀態機與既有看板／權限改動較小。
- 里程在抵達當下收尾，避免完成當下 GPS 抖动或不一致。

### Negative / trade-offs

- Order 需新增 `arrived_at`、`calculated_fare`、`final_fare`（及既有 `trip_distance_meters` 鎖定時機改為 Arrive）。
- Complete API 從無 body 改為必填 `final_fare`（破壞既有 Complete contract）。
- Driver Detail／列表 UI 需從「滑動完成」改為抵達／完成雙 CTA。
- 既有「Complete 覆寫 `price`」的實作與 Spec／測試需遷移。

### Out of scope

- 不新增 `ARRIVED` Status。
- 不改 Accept／搶單、P2-03 直線距離計費、GPS history。
- 本 ADR 只定 Spec；實作另開 Task。

---

## Alternatives considered

1. **新增 `ARRIVED` Status** — 語意清楚，但牽動看板、權限、通知與所有狀態表；否決，改用 `arrived_at`。
2. **Complete 一次做完並覆寫 `price`**（v1.0）— 無法保留派車價、無法讓 Driver 調價；否決。
3. **Arrive 不帶 GPS、只鎖目前累計** — 可能漏最後一段；否決，Arrive 必須帶最新座標。
