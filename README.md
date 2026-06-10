# Hyebin & Andrew Workouts 🏋️

A Strong-style workout tracker. **iPhone-optimized**, no backend — all data is saved on the device (`localStorage`). Ships with **Hyebin** and **Andrew** profiles — tap a name chip at the top to switch.

## Features (baseline)
- **Two sections** (bottom tabs): **Workouts** (do/log) and **History** (previous results).
- **Workouts → Exercises → Sets**: log weight, reps, and **RPE (effort, 1–10)** per set.
- **Structured exercises**: pick **Angle** (Incline / Decline / Flat / None) + **name** + **Equipment** (Barbell / Dumbbell / Machine / Cables / …). Exercises are **saved to a library** and reusable across workouts.
- **Previous results** shown inline as you lift (the `PREV` column) and pre-filled so you just adjust — plus full session history.
- **Session duration timer** counts up while you train (like Strong).
- **Rest timer** with countdown, ±15s, skip, and a beep + vibrate when it ends.
- **Couples mode**: tap a name chip at the top to switch people — each profile keeps separate history and weights.
- lb / kg toggle (top-right).

## Run locally
Just open `index.html` in a browser, or serve it:
```bash
cd workout-tracker
python3 -m http.server 8080   # then visit http://localhost:8080
```

## Deploy to GitHub Pages
1. Create a repo and push these files:
   ```bash
   cd workout-tracker
   git add -A && git commit -m "LiftLog baseline"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. On GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / root**.
3. Open the published URL on your iPhone in Safari → **Share → Add to Home Screen** for a full-screen app.

## Notes
- Data lives in the browser on each device. "Add to Home Screen" keeps the same storage.
- Backup/sync across phones (e.g. a shared cloud backend or export/import) is intentionally left out of this baseline.
