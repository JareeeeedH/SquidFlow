# AGENTS.md

## Project

白牌司機群派車系統。

所有產品、技術、Database、API、UI/UX、Architecture 與 Security 規則，以 `docs/` 為準。

## Rules

1. 開始開發前，先閱讀相關 `docs/` Spec。
2. 不自行新增或修改產品需求。
3. 不自行改變既定 Architecture、API 或 Database Schema。
4. Business Logic 必須由 Backend 保證，Frontend 不作為最終規則。
5. 修改 Database / API / Business Rule 時，確認對應 Spec 是否需要同步。
6. 優先重用現有程式碼，不重複建立功能。
7. 保持程式簡單，不過度工程化。
8. 重要功能必須測試，尤其是權限、Order State、搶單與資料一致性。
9. 不將密碼、API Key、Secret 等敏感資訊寫入 Git。
10. 遇到 Spec 衝突或需求不明確時，不自行猜測，先提出問題。

## Development Flow

```text
Read Spec
↓
Inspect Code
↓
Plan
↓
Implement
↓
Test
↓
Review
```

## Source of Truth

```text
docs/
├── MVP-SPEC.md
├── PHASE-2-SPEC.md
├── PHASE-3-SPEC.md
├── PHASE-4-SPEC.md
├── TECHNOLOGY-SPEC.md
├── DATABASE-SPEC.md
├── API-SPEC.md
├── UI-UX-SPEC.md
├── SYSTEM-ARCHITECTURE-SPEC.md
├── SECURITY-SPEC.md
└── adr/                  # Architecture Decision Records
```
