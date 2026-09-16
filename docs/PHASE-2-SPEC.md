# SquidFlow — White-label Driver Dispatch System
## Phase 2 Product Specification

**Document:** `PHASE-2-SPEC.md`  
**Status:** Product scope confirmed (source of truth for Phase 2 product rules)  
**Phase:** Phase 2 — Driver Location & Trip Information  
**Relationship to Phase 1:** Extends existing Auth, Order, Online / Offline, and claim-order rules. Does **not** change the Phase 1 Order state machine or claim-order conditions.

---

# 1. Purpose and Authority

This document records the confirmed Phase 2 **product scope and product rules**.

## 1.1 Source of truth

`PHASE-2-SPEC.md` is the **product-level source of truth** for Phase 2 scope.

If another Spec still describes Phase 2 differently, this document prevails for Phase 2 product intent until those Specs are synchronized.

## 1.2 What this document is / is not

This document:

- Is a product / requirements Spec
- Is **not** an implementation task list
- Does **not** define detailed API paths, Schema migrations, map SDK wiring, Provider selection, or security control matrices

## 1.3 Follow-up Spec synchronization

API, Database, Architecture, Security, Technology, and UI/UX technical details must stay aligned with this document.

Known sync status:

- **P2-01** — technical Specs have been synchronized for Driver GPS Location
- **P2-02 / P2-03 / P2-04** — product rules below are confirmed; technical Spec sync follows after remaining implementation decisions (including Geocoding Provider)

---

# 2. Product Phase Positioning

```text
Phase 1 — Core Dispatch MVP (implemented)
Phase 2 — Driver Location & Trip Information (this document)
Phase 3 — Advanced Dispatch & Communication (out of scope here)
```

Phase 2 focuses on:

- Where the Driver is (GPS)
- Pickup coordinates (Geocoding)
- Straight-line distance from Driver to Pickup
- In-app maps, plus navigation handled by Google Maps

Map and distance are **assistive information only**. They do **not** change Phase 1 dispatch / accept / Order State rules.

---

# 3. Phase 2 Feature Slices

| ID | Name |
|----|------|
| P2-01 | Driver GPS Location |
| P2-02 | Pickup Geocoding |
| P2-03 | Distance Calculation |
| P2-04 | Map & Google Maps Navigation |

---

# 4. P2-01 Driver GPS Location

## 4.1 Behavior

- Driver `ONLINE` → start GPS.
- After becoming `ONLINE`, obtain the **first** location **immediately**.
- Continue updating location every **30 seconds**.
- Driver `OFFLINE` → **stop** GPS updates.
- After going `OFFLINE`, **keep** the last valid location (do not clear it).

## 4.2 Failure and permission

- GPS permission denied, GPS failure, or location-report API failure must **not** change `ONLINE` / `OFFLINE` status.
- On GPS or API failure: keep the last valid location; retry on the next 30-second cycle.

## 4.3 Data scope

- Store the **latest location only**.
- Do **not** store location history.

## 4.4 Visibility

- A Driver can see **only their own** location.
- Admin can see the latest locations of **`ONLINE` Drivers**.
- `OFFLINE` Drivers are **not** included on the current Online Drivers map.

---

# 5. P2-02 Pickup Geocoding

## 5.1 Behavior

- Order creation must **not** be blocked by geocoding.
- Save the pickup address as **text first** (existing `pickup_location` meaning).
- After Order creation, the system **automatically** performs geocoding.
- If geocoding fails, keep the text pickup address and allow the Order to continue normally.
- When coordinates are obtained successfully, they are available for subsequent Distance and Map features.

## 5.2 Failure and retry

Detailed retry / failure implementation may be defined later in technical Specs. Product rules for Phase 2:

- Geocoding failure must not block Order create / publish / claim / execution flows.
- Missing Pickup coordinates simply means distance / map Pickup point may be unavailable until coordinates exist.

## 5.3 Provider status (not finalized)

- The Geocoding Provider is **not finally decided**.
- Public Nominatim is **not** a formal production provider candidate.
- Mapbox Temporary does **not** meet the current need to **store** geocoding results.
- Current research candidates may include: **Mapbox Permanent**, **HERE**, **TGOS**.
- **Google** Geocoding remains contingent on confirming related Terms and the in-app Map strategy.
- The final Provider is a **product decision** and is **not** selected by this document.

---

# 6. P2-03 Distance Calculation

## 6.1 Inputs

Distance is calculated from:

- Driver latest GPS coordinates
- Pickup coordinates

Distance is shown **only** when both coordinate sets are available. If either side is missing, do **not** show distance.

## 6.2 Calculation method

- SquidFlow calculates **straight-line distance** itself.
- Do **not** use Google Routes API.
- Do **not** calculate road distance.
- Do **not** calculate ETA.
- Driver count must **not** directly drive Google Routes API requests for distance / ETA.

## 6.3 Persistence and update behavior

- Distance does **not** need to be stored as an independent long-lived data field.
- Distance updates naturally when the latest Driver GPS position changes.
- No separate real-time routing engine is required for Phase 2.

## 6.4 Visibility

- Driver may see their own straight-line distance to Pickup for related Orders in statuses:
  - `OPEN`
  - `ACCEPTED`
  - `IN_PROGRESS`
- Admin may see straight-line distance between Online Drivers and Pickup in dispatch / Dashboard / Order context.
- Drivers **cannot** see other Drivers’ distances.

## 6.5 Display rules

Display distance using:

- `< 1 km` → meters
- `>= 1 km` → kilometers

The value must be clearly labeled as **straight-line distance** (直線距離).

## 6.6 Relationship to Phase 1 rules

- Distance information is **reference only**.
- Distance must **not** change Phase 1 claim-order rules or Order State rules.

---

# 7. P2-04 Map & Google Maps Navigation

## 7.1 In-app map

- Provide map capability inside the Web App.
- Driver can see their own current location and the Pickup location.
- Admin can view Online Driver locations and related Pickup context.
- `OFFLINE` Drivers are not required on the Online Drivers map (same as P2-01).

## 7.2 Navigation

- After accepting an Order, Driver can use **Start Navigation**.
- Navigation is handled by **Google Maps** (for example by opening Google Maps).
- SquidFlow does **not** implement turn-by-turn navigation.
- SquidFlow does **not** build its own routing engine.
- Phase 2 does **not** include road ETA or traffic navigation inside SquidFlow.

## 7.3 Relationship to Phase 1 rules

- Map and distance are assistive information only.
- They must **not** change Phase 1 dispatch / accept rules.

---

# 8. Phase 2 Boundaries (Explicitly Out of Scope)

Phase 2 does **not** include:

- Automatic dispatch
- AI dispatch
- Advanced dispatch logic
- Communication integrations
- Location history
- Road distance
- ETA
- Google Routes API for distance / ETA
- In-app turn-by-turn navigation / full in-vehicle navigation engine
- Built-in routing engine
- Road routing or traffic navigation inside SquidFlow

Phase 3 capabilities (advanced dispatch, third-party communication, and related topics) remain high-level Phase 3 planning only and are not expanded in this document.

---

# 9. Relationship to Existing Phase 1 Rules

The following Phase 1 rules are **unchanged** by Phase 2:

- Order state machine and claim-order conditions
- A Driver may hold at most one unfinished Order at a time
- Existing meaning of `ONLINE` / `OFFLINE` for claim eligibility and notifications
- Admin / Driver roles and ownership boundaries (Backend remains the final authority)

Phase 2 only **adds** location, geocoding, distance, map, and a navigation handoff. Failure degradation must not break Phase 1 core flows (for example: GPS failure must not force Offline; geocoding failure must not block Order creation).

---

# 10. Terminology

Reuse existing Spec terms:

| Term | Meaning |
|------|---------|
| Admin / Driver | Existing roles |
| `ONLINE` / `OFFLINE` | Driver online status |
| Pickup / `pickup_location` | Pickup place as text |
| Order | Dispatch order |
| Straight-line distance | Calculated inside SquidFlow; not road distance; reference only |
| Start Navigation | Navigation entry that hands off to Google Maps |

---

# 11. Open Product Decisions

Still **not** decided in this document:

1. Final **Geocoding Provider** (candidates may include Mapbox Permanent, HERE, TGOS; Google only after Terms + Map strategy confirmation).
2. In-app **map SDK / map strategy** (must be consistent with the chosen Geocoding Provider Terms where applicable).
3. Detailed geocoding **retry / failure** technical policy (product rule: failure must not block Orders; exact intervals / caps are technical Spec work).
4. Exact UI layout for where Admin / Driver see distance and maps (product contexts above are confirmed; screen-level UI remains for UI/UX Spec).
5. Whether editing `pickup_location` automatically re-triggers geocoding.
6. Exact rounding / precision rules for meter and kilometer display beyond the unit threshold.

---

# 12. Product Acceptance Focus

Phase 2 product acceptance should be able to demonstrate:

```text
Driver ONLINE → immediate first fix → update every 30 seconds
Driver OFFLINE → stop updates, keep last valid location
GPS / API failure → remain ONLINE/OFFLINE unchanged; keep last valid location; retry next cycle
Order create → save text pickup first; geocode automatically afterward
Geocoding failure → keep text pickup; Order continues normally
Both Driver + Pickup coordinates available → show labeled straight-line distance
Missing either coordinate set → do not show distance
Distance is computed, not stored as an independent long-lived field
Driver distance for related OPEN / ACCEPTED / IN_PROGRESS Orders only; no other Drivers’ distances
Admin distance in dispatch / Dashboard / Order context for Online Drivers ↔ Pickup
Display units → meters when < 1 km; kilometers when >= 1 km; labeled straight-line
Driver map → own location + Pickup
Admin map → ONLINE Drivers + related Pickup context; OFFLINE not on Online Drivers map
After accept → Start Navigation → Google Maps; no in-app turn-by-turn / routing engine
Map / Distance assistive only → Phase 1 dispatch / accept / Order State unchanged
No road distance / ETA / Google Routes-based distance in Phase 2
```

---

# 13. Technical Spec Sync Notes

Treat this file as the Phase 2 product authority for:

- P2-01–P2-04 product rules above
- Straight-line distance only; no ETA; no Google Routes for distance / ETA
- Non-blocking post-create Pickup geocoding
- Map + Google Maps navigation handoff
- Geocoding Provider **not** finalized here

**P2-01** technical Specs are already synchronized.

Remaining technical Spec work (after product confirmation of open decisions where needed):

- P2-02 Pickup Geocoding storage / jobs / retry contract and Provider choice
- P2-03 straight-line distance API / presentation contract
- P2-04 map embedding and Google Maps navigation handoff details
- Related Technology / Security / UI-UX updates
