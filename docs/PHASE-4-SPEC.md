# SquidFlow — White-label Driver Dispatch System
## Phase 4 Product Specification

**Document:** `PHASE-4-SPEC.md`  
**Status:** Planning only (high-level; detailed requirements TBD)  
**Phase:** Phase 4 — Advanced Dispatch & Communication  
**Relationship:** After Phase 3 (Trip Mileage & Fare). Does **not** change Phase 1 claim rules or Phase 3 fare rules until separately specified.

---

# 1. Purpose

Phase 4 covers advanced dispatch automation and third-party communication. This document records the **phase boundary and topic list only**. Detailed product rules, API, and data models are **not** defined yet.

---

# 2. Product Phase Positioning

```text
Phase 1 — Core Dispatch MVP (implemented)
Phase 2 — Driver Location & Trip Information (implemented)
Phase 3 — Trip Mileage & Fare Calculation (see PHASE-3-SPEC.md)
Phase 4 — Advanced Dispatch & Communication (this document)
```

---

# 3. Advanced Dispatch

- 自動派車
- AI Dispatch
- Priority／自動重派
- 進階車隊追蹤
- `dispatch_mode`：`DIRECT`／`PRIORITY`／`AUTO` 等（見 `MVP-SPEC` 未來預留）

詳細需求於進入實作前再定義。

---

# 4. Communication

- 第三方通訊整合（電話、LINE、簡訊等）

目前**不**指定第三方服務、API 或技術方案。

---

# 5. Out of Scope Until Specified

- 不定義 API／Schema／UI 細節
- 不引入 Redis／Queue／WebSocket 等架構變更（若需要，須另開 Architecture 變更）
- 不變更 Phase 1 Accept／搶單、Phase 2 GPS／Distance、Phase 3 里程／費率，除非本 Phase 後續 Spec 明確修改

---

# 6. Source of Truth

進入 Phase 4 實作前，應擴充本文件（或拆分子 Spec）並同步 `MVP-SPEC`、`API-SPEC`、`DATABASE-SPEC`、`SYSTEM-ARCHITECTURE-SPEC`、`UI-UX-SPEC`、`SECURITY-SPEC`。
