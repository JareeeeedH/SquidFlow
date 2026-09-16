# SquidFlow — White-label Driver Dispatch System
## Phase 2 Product Specification

**Document:** `PHASE-2-SPEC.md`  
**Status:** Product scope finalized (pre-implementation)  
**Phase:** Phase 2 — Driver Location & Trip Information  
**Relationship to Phase 1:** Extends existing Auth, Order, Online / Offline, and claim-order rules. Does **not** change the Phase 1 Order state machine or claim-order conditions.

---

# 1. Purpose and Authority

This document records the confirmed Phase 2 **product scope and product rules**.

## 1.1 Source of truth

`PHASE-2-SPEC.md` is the **product-level source of truth** for Phase 2 scope.

If another Spec still describes Phase 2 differently (for example older mentions of road distance or ETA), this document prevails for Phase 2 product intent until those Specs are synchronized.

## 1.2 What this document is / is not

This document:

- Is a product / requirements Spec
- Is **not** an implementation task list
- Does **not** define detailed API paths, Schema migrations, map SDK wiring, or security control matrices

## 1.3 Follow-up Spec synchronization

API, Database, Architecture, Security, Technology, and UI/UX technical details will be synchronized **after** the Phase 2 product discussion is finalized.

Entering implementation requires aligning (via separate TASK updates) at least:

- `DATABASE-SPEC.md` — latest Driver location and Pickup coordinates storage
- `API-SPEC.md` — location / distance / map data contracts
- `UI-UX-SPEC.md` — Driver / Admin map and distance presentation
- `SYSTEM-ARCHITECTURE-SPEC.md` / `TECHNOLOGY-SPEC.md` — map embedding and Google Maps navigation handoff
- `SECURITY-SPEC.md` — location visibility and access boundaries

Finalizing this product document does **not** mean the technical Specs above are already finalized.

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

- GPS permission denied or location failure must **not** affect `ONLINE` status.
- GPS failure or location-report API failure: keep the last valid location; retry on the next 30-second cycle.

## 4.3 Data scope

- Store the **latest location only**.
- Do **not** store location history.

## 4.4 Visibility

- A Driver can see **only their own** location.
- Admin can see the latest locations of **`ONLINE` Drivers**.
- `OFFLINE` Drivers do **not** need to appear on the current Online Drivers map.

---

# 5. P2-02 Pickup Geocoding

## 5.1 Behavior

- Order creation must **not** be blocked by geocoding.
- Save the pickup address as **text first** (existing `pickup_location` meaning).
- After Order creation, the system **automatically** performs geocoding.
- If geocoding fails, keep the text pickup address and allow the Order to continue normally.

## 5.2 Failure and retry

Detailed retry / failure implementation may be defined later in technical Specs. Product rule for Phase 2:

- Geocoding failure must not block Order create / publish / claim / execution flows.
- Missing Pickup coordinates simply means distance is unavailable until coordinates exist.

## 5.3 Relationship to distance

- If Pickup coordinates are not yet available: **do not show** distance.

---

# 6. P2-03 Distance Calculation

## 6.1 Inputs

Distance is calculated from:

- Driver latest coordinates
- Pickup coordinates

Distance is shown **only** when both Driver and Pickup coordinates are available.

## 6.2 Calculation method

- SquidFlow calculates **straight-line distance** itself (straight-line / great-circle class).
- Do **not** use Google Routes API for distance calculation.
- Straight-line distance must **not** be presented as road distance.
- Phase 2 has **no** road distance and **no** ETA.
- Driver count must **not** directly drive Google Routes API requests for distance / ETA (avoid scaling external routing cost by fleet size).

## 6.3 Update behavior

- Distance updates naturally when the latest Driver GPS position changes.
- No separate real-time routing engine is required for Phase 2.

## 6.4 Visibility

- Driver can see the distance to the Pickup for the **relevant Order**.
- Admin can see the distance between Online Drivers and Pickup.
- Drivers **cannot** see other Drivers’ distances.

## 6.5 Display rules

Display distance using:

- `< 1 km` → meters
- `>= 1 km` → kilometers

The value must be clearly labeled as **straight-line distance**.

---

# 7. P2-04 Map & Google Maps Navigation

## 7.1 In-app map

- Provide map functionality inside the Web App.
- Driver can see their own current location and the Pickup location.
- Admin can view Online Driver locations on a map.

## 7.2 Navigation

- After accepting an Order, Driver can use **Start Navigation**.
- Navigation is handled by **Google Maps** (for example by opening Google Maps, not by building an in-app navigation engine).
- SquidFlow does **not** implement turn-by-turn navigation.
- Phase 2 does **not** include road routing, traffic navigation, or ETA calculation inside SquidFlow.

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
- Road routing or traffic navigation inside SquidFlow

Phase 3 capabilities (advanced dispatch, third-party communication, and related topics) remain high-level Phase 3 planning only and are not expanded in this document.

---

# 9. Relationship to Existing Phase 1 Rules

The following Phase 1 rules are **unchanged** by Phase 2:

- Order state machine and claim-order conditions
- A Driver may hold at most one unfinished Order at a time
- Existing meaning of `ONLINE` / `OFFLINE` for claim eligibility and notifications
- Admin / Driver roles and ownership boundaries (Backend remains the final authority)

Phase 2 only **adds** location, distance, map, and a navigation handoff. Failure degradation must not break Phase 1 core flows (for example: GPS failure must not force Offline; geocoding failure must not block Order creation).

---

# 10. Terminology

Reuse existing Spec terms:

| Term | Meaning |
|------|---------|
| Admin / Driver | Existing roles |
| `ONLINE` / `OFFLINE` | Driver online status |
| Pickup / `pickup_location` | Pickup place as text |
| Order | Dispatch order |
| Straight-line distance | Calculated inside SquidFlow; not road distance |
| Start Navigation | Navigation entry that hands off to Google Maps |

---

# 11. Product Acceptance Focus

Phase 2 product acceptance should be able to demonstrate:

```text
Driver ONLINE → immediate first fix → update every 30 seconds
Driver OFFLINE → stop updates, keep last valid location
GPS failure → remain ONLINE; keep last valid location; retry next cycle
Order create → save text pickup first; geocode automatically afterward
Geocoding failure → keep text pickup; Order continues normally
Both Driver + Pickup coordinates available → show labeled straight-line distance
Missing either coordinate set → do not show distance
Display units → meters when < 1 km; kilometers when >= 1 km
Driver map → own location + Pickup; no other Drivers’ distances
Admin map → ONLINE Drivers’ latest locations; OFFLINE not required on this map
After accept → Start Navigation → Google Maps; no in-app turn-by-turn
No road distance / ETA / Google Routes-based distance in Phase 2
```

---

# 12. Known Conflicts Pending Spec Sync

**P2-01** technical details are synchronized in `DATABASE-SPEC.md`, `API-SPEC.md`, `SYSTEM-ARCHITECTURE-SPEC.md`, and `SECURITY-SPEC.md`.

Cross-document Phase 2 outlines in `MVP-SPEC.md`, `DEVELOPMENT-STATUS.md`, and `UI-UX-SPEC.md` have been aligned to remove road distance / ETA as Phase 2 scope.

Remaining technical Spec work (not fully specified in this P2-01 pass):

- P2-02 Pickup Geocoding storage / jobs / retry contract
- P2-03 straight-line distance API / presentation contract
- P2-04 map embedding and Google Maps navigation handoff details
- `TECHNOLOGY-SPEC.md` map / Geolocation implementation notes as needed

Until those are written, treat this file as the Phase 2 product authority for:

- Straight-line distance only
- No ETA in Phase 2
- No Google Routes API for distance / ETA
- Automatic post-create Pickup geocoding without blocking Order creation
- Map + Google Maps navigation handoff
- Unresolved product ambiguities listed earlier in discussion (not decided here)
