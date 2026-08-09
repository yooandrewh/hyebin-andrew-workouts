# LiftLog — Hyebin & Andrew Workouts

Strong-style workout tracker. Single-file vanilla JS PWA, iPhone-first, no build step.
Repo: `yooandrewh/hyebin-andrew-workouts`. Deploys to GitHub Pages on push to `main`.

## Run

```bash
python3 -m http.server 8080   # then open http://localhost:8080
```

## Layout

- `index.html` — the entire app (markup, CSS, JS). Everything lives here.
- `firebase-config.js` — cloud sync config (project `ha-workouts`)
- `version.js` — build stamp, rewritten by GitHub Actions on push
- `SETUP-FIREBASE.md`, `STRESS-TEST.md` — setup + QA notes

## Data model

`localStorage`, plus optional Firebase sync. Profiles use **stable ids** (`hyebin`, `andrew`)
— never generate profile ids at runtime, that caused duplicate profiles across synced devices.

Each exercise carries `ex.goal = {sets, repsLow, repsHigh, rpe, notes}`.

## Progression engine (Jeff Nippard principles)

The next set is recommended as a **grey placeholder overlay** in the weight/reps inputs.
Tapping ✓ commits it; typing overrides it. Untouched/unchecked sets are **not** logged.

- **Straight sets** by default — same weight across all working sets.
- **Earn weight via reps**: if every working set hit the TOP of the goal range (e.g. 12 of 8–12),
  recommend more weight and reset reps to the BOTTOM of the range. Otherwise hold weight and
  add ~1 rep per set toward the top.
- **Weight jumps are proportional, never flat**: ~2.5% upper body, ~3.5% lower body, rounded to
  the nearest 5 lb, floored at 5 (upper) / 10 (lower). So 135→+5, 315→+10, 405 squat→+15,
  1080 leg press→+40.
- 2–3 working sets, 1–2 RIR on early sets, last set near failure.
- **RPE is optional** — if it's missing, assume the target was met and progress anyway.
  Never block progression on a forgotten RPE.
- **Warmups**: 2 sets at ~50% then ~70% of working weight, same target reps. Excluded from
  volume and PRs. Skip entirely for light/bodyweight work (under ~50 lb).

## Conventions

- iOS standalone mode is a first-class target — test navigation, rest-timer audio, and status
  bar behavior there, not just in mobile Safari.
- Version badge in the footer is stamped automatically; don't hand-edit `version.js`.
