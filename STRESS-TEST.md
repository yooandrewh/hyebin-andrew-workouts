# Stress test & debug log

Automated tests driven against the running app in the preview (real functions + DOM, not mocks).
`confirm()`/`alert()` were stubbed during runs so destructive/guard paths execute without blocking.

## Round 1 — core flows (27/27 ✓)
- reset/defaults, **XSS escaping** (profile name `<img onerror>` not injected)
- empty workout → add 2 exercises → log → finish offers template; session + template saved; volume math
- PREV seeding from a saved template; cancel clears active session
- **per-profile isolation** (Andrew can't see Hyebin's history)
- goals: save / read banner text / clear
- `bump()` stepper clamping (RPE 1–10, sets from empty → 1)
- How-to YouTube URL generation
- **cloud merge** (`onCloudData`): keeps local-only data, adds remote, no duplicate ids
- guard: can't delete the template of an in-progress workout
- performance: render **300 sessions in 19ms**
- delete session

## Round 2 — adversarial (found 2 real bugs)
- ✓ goalText variants (sets-only, single rep, rpe-only, empty, "1 set")
- ✓ merge with empty/partial remote doesn't crash or wipe local
- ✓ template exercise de-dupe
- ✗ **BUG 1 — seeding used the selected profile chip, not the active session's profile.** Switching the name chip mid-workout then adding an exercise seeded from the wrong person's history.
- ✗ **BUG 2 — phantom logging.** Pre-filled sets you never touched/checked were saved as if completed.
- ✓ rest timer can't go negative

### Fixes
- **BUG 1:** `seedSets()` now reads `S.active.profileId` (the session's owner), falling back to the current profile only when no session is active.
- **BUG 2 (fixed by redesign):** sets are no longer pre-filled with real values. The next-set recommendation is shown as a **grey placeholder overlay**; the stored value stays empty until you **type** or tap **✓** (which commits the recommendation). Untouched/unchecked sets are never logged.

## Round 3 — progressive-overload engine + bug-fix verification (10/10 ✓ after one fix)
- ✓ FIX-BUG1: seeds from the active session's profile
- ✓ FIX-BUG2: untouched seeded session does **not** save
- ✓ R1: all sets hit top of range → **+5 lb**, reps reset to bottom; warmups present
- ✓ R2: not all at top → same weight, **+1 rep** per set toward the top
- ✓ R3: lower-body compound (squat) → **+10 lb** jump
- ✓ R4: first time (no history) → reps = bottom of range, no warmups, weight blank
- ✓ R5: **missing RPE** still progresses (assume target met, overload anyway)
- ✓ R6: tapping ✓ commits the grey recommendation into the logged value
- ✓ R7: warmup sets excluded from volume
- ✗→✓ **BUG 3 — warmups were computed from last week's weight, not today's recommended weight.** Fixed: warmups are 50% / 70% of the *recommended* working weight.

## Round 4 — proportional increment + live link
- ✓ regression: core flow, recommendations, both bug fixes, cloud merge still pass
- ✓ **proportional weight jump** scales with load (135→+5, 315→+10, 405 squat→+15, 1080 leg press→+40)
- ✓ live link: partner strip renders from injected presence; own presence filtered out; stale (>90s) heartbeats dropped; rest countdown ticks
- ✓ `myPresence()` builds correct active status from a live session
- ✓ presence hooks don't break core flows; no-op when cloud is off

## Round 5 — security review + hardening (13/13 ✓)
Threat model: with cloud sync on, the Firebase web config is public and the baseline Firestore rules are open, so **all synced/presence data must be treated as untrusted**.
- Found 2 reachable **stored-XSS** vectors (only via the cloud channel; local data is app-generated and safe):
  1. `color` interpolated into `style="..."` → attribute breakout.
  2. record `id` interpolated into inline `onclick="...('id')"` → JS-string breakout (HTML-escaping does **not** fix this, since entities decode before JS parses).
- **Fix:** `sanitizeCloud()` validates every incoming record at ingest — ids must match `^[A-Za-z0-9_-]{1,64}$` (bad records/entries dropped), colors coerced to a safe hex; presence sanitized the same way; `safeColor()` also applied in render (defense in depth). Verified: injected `<img onerror>`, breakout ids, and attribute-breakout colors are all neutralized while legitimate data still merges.
- **Still recommended (needs your Firebase project):** lock Firestore with Firebase Auth instead of open `if true` rules so only you two can read/write. Flagged in SETUP-FIREBASE.md.
- Edge cases verified: inverted rep range, bodyweight (no warmups), junk numeric input, warmup-only finish.

## Status
All five rounds pass. No console errors across runs. Verified visually: grey recommendation overlay, two warmup (W) rows, the progression note, the grey→green commit on ✓, and the live "working out together" partner strip with ticking rest timer.
