# Hyebin & Andrew Workouts 🏋️

A Strong-style workout tracker. **iPhone-optimized**, no backend — all data is saved on the device (`localStorage`). Ships with **Hyebin** and **Andrew** profiles — tap a name chip at the top to switch.

## Features
- **Two sections** (bottom tabs): **Workouts** (do/log) and **History** (previous results).
- **Templates**: save reusable workout plans (e.g. "Push Day") with a fixed exercise list. Start a template, **or** start an **Empty Workout** — and at the end the app asks **"Save as a template?"** (or "update the template?" if you changed it).
- **Workouts → Exercises → Sets**: log weight (lb), reps, and **RPE (effort, 1–10)** per set.
- **Structured exercises**: pick **Angle** (Incline / Decline / Flat / None) + **name** + **Equipment** (Barbell / Dumbbell / Machine / Cables / …). Exercises are **saved to a library**; the name field is **type-to-search** so saved exercises pop up as you type.
- **Previous results** shown inline as you lift (the `PREV` column) and pre-filled so you just adjust — plus full session history.
- **Session duration timer** counts up while you train (like Strong).
- **Rest timer** with countdown, ±15s, skip, and a beep + vibrate when it ends.
- **Couples mode**: tap a name chip at the top to switch people — each profile keeps separate history and weights.
- **Light / dark theme** toggle (top-right), light by default.
- **Cloud sync (optional)** so Hyebin's and Andrew's phones share data — see [SETUP-FIREBASE.md](SETUP-FIREBASE.md). Off by default (local only) until configured.
- **Auto build version** shown in the footer, stamped on every push by GitHub Actions.

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
2. On GitHub: **Settings → Pages → Source: GitHub Actions**. The included workflow
   ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) builds + deploys on every push and stamps the version.
3. Open the published URL on your iPhone in Safari → **Share → Add to Home Screen** for a full-screen app.

Live URL: **https://yooandrewh.github.io/hyebin-andrew-workouts/**

## Notes
- **Without cloud sync:** data lives in each device's browser (separate per phone). "Add to Home Screen" keeps the same storage.
- **With cloud sync on** ([SETUP-FIREBASE.md](SETUP-FIREBASE.md)): both phones share one dataset and stay in sync.
- The footer shows the live build version (date + commit), updated automatically on each push.
