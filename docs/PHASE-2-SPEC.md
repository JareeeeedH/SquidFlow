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

- **P2-01** — technical Specs synchronized for Driver GPS Location
- **P2-02** — product + technical Specs synchronized for Google Geocoding **without** persisting Pickup lat/lng in the database
- **P2-03** — product + technical Specs synchronized for straight-line Distance (computed; not stored)
- **P2-04** — product + technical Specs synchronized for **Google Maps JavaScript API** in-app map + Google Maps navigation handoff

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
- Save the pickup address as **text first** (existing `pickup_location` meaning). Only this text is persisted on the Order in the database.
- After Order creation succeeds, the system **automatically** performs geocoding.
- Geocoding must be handled **asynchronously** so Google Geocoding API latency does **not** block the Create Order response.
- Flow: `pickup_location` text → Google Geocoding API → latitude / longitude for Distance / Map use.
- If geocoding fails, keep the text pickup address and allow the Order to continue normally.
- Successful coordinates for an Order are reused for that Order’s Distance (P2-03) and Map (P2-04) needs.
- Multiple Drivers viewing the same Order must **not** each trigger a separate Google Geocoding call for the same Pickup address on that Order.

## 5.2 Persistence rules

- **Do not** store Pickup latitude / longitude in the database.
- Database Order records continue to store `pickup_location` text only (for geocoding purposes).
- Geocoding results are held and reused in Backend runtime for the same Order + current `pickup_location` (process-local memoization / single-flight). No Redis, queue, or worker infrastructure.
- After process restart, Backend may geocode again when Distance / Map needs coordinates; still at most one in-flight Google call per Order + address (not per Driver).

## 5.3 Address update

- If `pickup_location` is modified, geocoding must be performed again.
- Previous Pickup coordinates for that Order must be invalidated and must **not** remain treated as valid for the new address.
- If re-geocoding fails, keep the text address and do **not** reuse stale coordinates.

## 5.4 Failure and retry

- Geocoding failure must not block Order create / publish / claim / execution flows.
- Missing usable Pickup coordinates simply means distance / map Pickup point may be unavailable until a successful geocode exists in Backend runtime.
- Retry policy (confirmed): **maximum 2 total provider attempts** (including the initial request). On timeout / provider error, **retry once after 200ms**. Process-local only; no queue.
- `ZERO_RESULTS` / `INVALID` / `DISABLED` / no usable result: **do not retry**; Order remains valid with text only.

## 5.5 Provider

- **Selected Provider:** Google Geocoding API.
- Provider calls must be made from the **Backend**, not from the Browser.
- API keys / secrets must follow existing Secrets / Environment Variable rules.
- Phase 2 does **not** use Google Routes API for distance / ETA.

## 5.6 Google Terms notes (non-blocking for the no-DB model; residual caution)

Product decision: **do not persist Pickup lat/lng in DB**, which removes the previous “permanent multi-role DB storage” blocker.

Remaining Terms awareness (not legal advice; Map SDK selected):

- `[Official]` Geocoding content must not be used with a **non-Google map** (§6.2). **Resolved for Phase 2:** in-app map uses **Google Maps JavaScript API**.
- `[Official]` Caching / storage of lat/lng remains restricted; place_id may be stored indefinitely if ever needed later — Phase 2 does **not** require place_id columns.
- `[Judgment]` Runtime reuse of one Order geocode result for Distance / Map (instead of per-Driver Google calls) is the product rule; keep usage ephemeral and avoid building a durable lat/lng store.

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

- `< 1 km` → **integer meters**（整數公尺）
- `>= 1 km` → **1 decimal kilometer**（小數一位公里）

The value must be clearly labeled as **straight-line distance** (直線距離).

## 6.6 Relationship to Phase 1 rules

- Distance information is **reference only**.
- Distance must **not** change Phase 1 claim-order rules or Order State rules.

---

# 7. P2-04 Map & Google Maps Navigation

## 7.1 In-app map

- Provide map capability inside the Web App using **Google Maps JavaScript API** (selected Map SDK; aligns with Google Geocoding §6.2).
- Driver can see their own current location and the Pickup location.
- Admin can view Online Driver locations and related Pickup context.
- `OFFLINE` Drivers are not required on the Online Drivers map (same as P2-01).
- Map data reuses P2-01 Driver GPS and P2-02 runtime Pickup coordinates (not DB columns). Distance display reuses P2-03; map does **not** require WebSocket / Redis / Queue.
- **MVP map chrome:** no pixel-level fixed marker / zoom Spec. Follow existing UI/UX direction. **Driver and Pickup markers must be clearly distinguishable.** Use a **reasonable visible map range** (fit content; avoid extreme over-zoom).

## 7.2 Navigation

- After accepting an Order, Driver can use **Start Navigation**.
- Navigation is handled by **Google Maps** handoff (for example by opening Google Maps).
- SquidFlow does **not** implement turn-by-turn navigation.
- SquidFlow does **not** build its own routing engine.
- Phase 2 does **not** include road ETA or traffic navigation inside SquidFlow.

## 7.3 Failure degradation

- Map load failure, missing Pickup coordinates, missing Driver GPS, Maps key/config issues, or navigation handoff failure must **not** change Order State, claim/accept rules, or `ONLINE` / `OFFLINE`.
- Degrade by hiding or disabling map / navigation UI as needed; core dispatch flows continue.

## 7.4 Relationship to Phase 1 rules

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

# 11. Confirmed Product Decisions (display / retry / map chrome)

Previously open items are **confirmed**:

1. **Distance display precision**
   - `< 1 km` → integer meters
   - `>= 1 km` → 1 decimal kilometer
   - Label: **直線距離**
2. **Geocode retry**
   - Maximum **2** total provider attempts (including the initial request)
   - On timeout / provider error: retry **once** after **200ms**
   - `ZERO_RESULTS` / `INVALID` / `DISABLED` → **no retry**
   - Remains asynchronous and non-blocking; process-local; no queue
3. **Map UI chrome**
   - No pixel-level fixed chrome requirement for MVP
   - Follow existing UI/UX direction
   - Driver and Pickup must be clearly distinguishable
   - Use a reasonable visible map range

Also resolved (earlier):

- Geocoding Provider → **Google Geocoding API**
- In-app Map SDK → **Google Maps JavaScript API**
- Pickup lat/lng → **not stored in DB**; runtime reuse per Order for Distance / Map; no per-Driver Google calls for the same Order Pickup
- Editing `pickup_location` → must re-geocode; stale coordinates must not be reused
- Driver Order Detail → Map + straight-line distance + Start Navigation (navigation after accept)
- Admin Order / Dispatch context → Online Drivers + Pickup map
- Navigation → Google Maps external handoff; no in-app routing / ETA / turn-by-turn
- Keys → Backend Geocoding server key never in Frontend; Maps JavaScript API uses a separate Frontend-restricted key

---

# 12. Product Acceptance Focus

Phase 2 product acceptance should be able to demonstrate:

```text
Driver ONLINE → immediate first fix → update every 30 seconds
Driver OFFLINE → stop updates, keep last valid location
GPS / API failure → remain ONLINE/OFFLINE unchanged; keep last valid location; retry next cycle
Order create → save text pickup first; async Google Geocode afterward (no Create blocking)
Geocoding failure → keep text pickup; Order continues normally; no Pickup lat/lng in DB
Pickup coords (runtime) + Driver GPS → labeled straight-line distance (P2-03)
Same Order Pickup must not be Google-geocoded once per Driver
pickup_location edit → invalidate prior coords; re-geocode; never reuse stale coords
Missing either coordinate set → do not show distance
Distance is computed, not stored as an independent long-lived field
Driver distance for related OPEN / ACCEPTED / IN_PROGRESS Orders only; no other Drivers’ distances
Admin distance in dispatch / Dashboard / Order context for Online Drivers ↔ Pickup
Display units → integer meters when < 1 km; 1-decimal km when >= 1 km; labeled 直線距離
Geocode retry → max 2 attempts; 200ms once on provider error; no retry on ZERO_RESULTS/INVALID/DISABLED
Driver map → own location + Pickup
Admin map → ONLINE Drivers + related Pickup context; OFFLINE not on Online Drivers map
After accept → Start Navigation → Google Maps; no in-app turn-by-turn / routing engine
Map / Distance assistive only → Phase 1 dispatch / accept / Order State unchanged
No road distance / ETA / Google Routes-based distance in Phase 2
No Pickup latitude/longitude database columns for P2-02
```

---

# 13. Technical Spec Sync Notes

Treat this file as the Phase 2 product authority for:

- P2-01–P2-04 product rules above
- Straight-line distance only; no ETA; no Google Routes for distance / ETA
- Non-blocking async Pickup geocoding via **Google Geocoding API**
- **No** Pickup lat/lng columns in the database
- Runtime reuse of the same Order geocode result for Distance / Map (not per Driver)
- Map + Google Maps navigation handoff

**P2-01**, **P2-02**, **P2-03**, and **P2-04** technical Specs are synchronized with this document.

Display precision, geocode retry counts/delays, and map chrome principles above are **confirmed** (see §11) — no longer open product decisions.
