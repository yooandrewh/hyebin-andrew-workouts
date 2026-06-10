# Turn on cloud sync (Hyebin ↔ Andrew shared data)

This makes both phones share **one** dataset — log on either phone and it shows up on the other in a second or two. It's free. ~5 minutes, mostly clicking.

You only have to do this once, and only **you** can do the account steps (I can't log into Google for you).

---

## 1. Create a Firebase project
1. Go to **https://console.firebase.google.com** and sign in with a Google account.
2. Click **Create a project** (or **Add project**).
3. Name it something like `ha-workouts`. Click **Continue**.
4. Google Analytics: **turn it off** (toggle off) → **Create project** → wait → **Continue**.

## 2. Add a Web App
1. On the project home, click the **`</>`** (Web) icon ("Add an app to get started").
2. App nickname: `H+A Workouts`. **Don't** check "Firebase Hosting". Click **Register app**.
3. You'll see a code block with a `const firebaseConfig = { … }` object. **Copy that object** (just the `{ apiKey: …, … }` part). Click **Continue to console**.

## 3. Create the database
1. Left sidebar → **Build → Firestore Database**.
2. Click **Create database**.
3. Choose a location near you → **Next**.
4. Select **Start in test mode** → **Enable**. (We'll lock it down in step 5.)

## 4. Paste your config into the app
1. Open **`firebase-config.js`** in this repo.
2. Replace the empty `window.FIREBASE_CONFIG = { … };` with your copied keys, e.g.:
   ```js
   window.FIREBASE_CONFIG = {
     apiKey: "AIzaSy............",
     authDomain: "ha-workouts.firebaseapp.com",
     projectId: "ha-workouts",
     storageBucket: "ha-workouts.appspot.com",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abcdef1234567890"
   };
   ```
3. Save, commit, and push:
   ```bash
   cd ~/workout-tracker
   git add firebase-config.js && git commit -m "Enable cloud sync" && git push
   ```
4. Wait ~1 minute for the deploy. Reopen the app on **both** phones. The footer should change from "local only" to **✓ cloud connected / ✓ synced**.

## 5. (Recommended) Add a simple security rule
Test mode lets anyone read/write for 30 days. To keep it private but simple, in
**Firestore → Rules**, replace the rules with a shared secret:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /shared/data {
      allow read, write: if true;   // shared workout data
    }
    match /presence/{profile} {
      allow read, write: if true;   // live "working out together" status
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

> This is intentionally simple for a private 2-person app. The data lives at a
> hard-to-guess project, but it isn't password-protected. If you later want real
> per-person logins, tell me and I'll add Firebase Auth.

---

### Live link ("working out together")
Once cloud sync is on, when you're both in a workout at the same time, each phone shows a live strip under the header with your partner's current exercise, last set, and rest-timer countdown. It updates in real time and disappears ~90s after they finish or close the app. No extra setup beyond the steps above.

### Notes & limitations (baseline sync)
- **What syncs:** profiles, the exercise library, templates, and finished sessions. Plus live presence while training.
- **What stays on each phone:** the light/dark theme, which profile is selected, and any in-progress workout (so you don't fight over a live session).
- **Merging:** new sessions/templates/exercises from both phones are combined. **Deleting** something on one phone may not remove it from the other in this baseline — tell me if you want full delete-sync and I'll add it.
