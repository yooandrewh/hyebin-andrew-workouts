#!/usr/bin/env node
/**
 * Headless test harness for the joint-workout sync ("Together" mode).
 *
 *   node test-sync.js [iterations]      # default 100
 *
 * Loads the real app code out of index.html into TWO independent simulated devices
 * (Hyebin's phone + Andrew's phone), each with its own localStorage, then relays
 * presence between them exactly like Firestore does. Random sequences of
 * add / remove / log-a-set / together / leave are fuzzed and invariants checked.
 *
 * No network, no browser, no tokens. Exit code 0 = all green.
 */
const fs = require("fs");
const path = require("path");

/* ---------- controllable clock (so ordering is deterministic) ---------- */
let NOW = 1_700_000_000_000;
const realNow = Date.now;
Date.now = () => NOW;
const tick = (ms = 1000) => { NOW += ms; };

/* ---------- minimal DOM stub ---------- */
function makeEl(id) {
  const el = {
    id, innerHTML: "", textContent: "", value: "", style: {}, dataset: {}, checked: false,
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    addEventListener(){}, removeEventListener(){}, appendChild(){}, removeChild(){},
    remove(){}, click(){}, focus(){}, blur(){}, setAttribute(){}, getAttribute(){ return null; },
    insertAdjacentHTML(){}, querySelector(){ return null; }, querySelectorAll(){ return []; },
    scrollIntoView(){},
  };
  return el;
}
function makeDevice(scriptSrc, label) {
  const store = new Map();
  const els = new Map();
  const document = {
    getElementById(id) { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return makeEl("tmp"); },
    addEventListener() {},
    body: makeEl("body"),
    head: makeEl("head"),
  };
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  };
  const win = {
    APP_VERSION: "test",
    FIREBASE_CONFIG: {},               // cloud "off" → no real network calls
    location: { href: "http://test/", reload(){} },
    navigator: { vibrate(){} },
    addEventListener(){}, removeEventListener(){},
    setTimeout: (fn) => { try { fn(); } catch(e){} return 0; },   // run modal focus cbs inline
    clearTimeout(){}, setInterval(){ return 0; }, clearInterval(){},
    scrollTo(){}, confirm: () => true, alert: () => {},
    AudioContext: function(){ return { state:"running", resume(){}, createOscillator(){ return {frequency:{},connect(){},start(){},stop(){}}; }, createGain(){ return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}; }, destination:{}, currentTime:0 }; },
  };
  win.window = win;

  // expose the internals the harness needs to poke at
  const exportNames = [
    "S","save","render","partners","onPresence","myPresence","pushPresence","applyPlan",
    "startEmptyWorkout","startWorkout","cancelWorkout","finishWorkout","addExistingExercise",
    "removeEntry","toggleDone","startTogether","leaveTogether","joinPartner","pickTarget",
    "seedSets","exById","entryHasData","markListChanged","safeId",
  ];
  const factory = new Function(
    "window","document","localStorage","navigator","setTimeout","clearTimeout",
    "setInterval","clearInterval","confirm","alert","AudioContext",
    `${scriptSrc}
     ;return {
        getS: () => S,
        setPickTarget: v => { pickTarget = v; },
        getPartners: () => partners,
        ${exportNames.filter(n=>!["S","partners","pickTarget"].includes(n)).map(n => `${n}: typeof ${n}!=="undefined" ? ${n} : undefined`).join(",\n        ")}
     };`
  );
  const api = factory(
    win, document, localStorage, win.navigator, win.setTimeout, win.clearTimeout,
    win.setInterval, win.clearInterval, win.confirm, win.alert, win.AudioContext
  );
  api.win = win;
  api.label = label;
  // these are assigned onto window by the app, not declared in scope
  api.onPresence = (...a) => win.onPresence(...a);
  api.onCloudData = (...a) => win.onCloudData(...a);
  return api;
}

/* ---------- load the app source ---------- */
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const m = html.match(/<script>\s*\n?"use strict";([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find the main <script> block in index.html"); process.exit(2); }
const APP_SRC = m[1];

/* ---------- helpers ---------- */
const EX = [
  { id: "bench", name: "Bench Press", equipment: "Barbell", angle: "Flat" },
  { id: "squat", name: "Squat", equipment: "Barbell", angle: "None" },
  { id: "ohp",   name: "OHP", equipment: "Barbell", angle: "None" },
  { id: "row",   name: "Row", equipment: "Dumbbell", angle: "None" },
  { id: "curl",  name: "Curl", equipment: "Dumbbell", angle: "None" },
];
function reset(dev, profileId) {
  const S = dev.getS();
  S.profiles = [
    { id: "hyebin", name: "Hyebin", color: "#ff6b9d" },
    { id: "andrew", name: "Andrew", color: "#2f7bff" },
  ];
  S.currentProfileId = profileId;
  S.profilePicked = true;
  S.exercises = EX.map(e => ({ ...e, goal: null }));
  S.workouts = []; S.sessions = []; S.active = null;
  dev.save();
}
const ids = dev => (dev.getS().active ? dev.getS().active.entries.map(e => e.exerciseId).sort() : null);
const loggedIds = dev => {
  const a = dev.getS().active; if (!a) return [];
  return a.entries.filter(en => dev.entryHasData(en)).map(en => en.exerciseId).sort();
};
// relay presence both ways until quiet (like Firestore listeners settling)
function relay(a, b, rounds = 6) {
  for (let i = 0; i < rounds; i++) {
    tick(50);
    a.onPresence([b.myPresence()]);
    tick(50);
    b.onPresence([a.myPresence()]);
  }
}
function rnd(n) { return Math.floor(Math.random() * n); }
function pick(arr) { return arr[rnd(arr.length)]; }

/* ---------- fuzz one scenario ---------- */
function runScenario(seedNote) {
  const A = makeDevice(APP_SRC, "Hyebin");
  const B = makeDevice(APP_SRC, "Andrew");
  reset(A, "hyebin"); reset(B, "andrew");
  const problems = [];

  A.startEmptyWorkout(); tick(100); B.startEmptyWorkout(); tick(100);

  // both opt in (either order, sometimes only one — the other should auto-join)
  const both = Math.random() < 0.5;
  A.startTogether();
  relay(A, B, 2);
  if (both) B.startTogether();
  relay(A, B, 3);

  const devs = [A, B];
  const ops = rnd(10) + 4;
  const everLogged = new Map();   // exerciseId -> Set(device labels) that logged data

  for (let i = 0; i < ops; i++) {
    const d = pick(devs);
    const S = d.getS();
    if (!S.active) { d.startEmptyWorkout(); d.startTogether(); relay(A, B, 2); continue; }
    const roll = rnd(100);
    try {
      if (roll < 45) {                                   // ADD
        const ex = pick(EX);
        if (!S.active.entries.some(e => e.exerciseId === ex.id)) {
          d.setPickTarget({ type: "active" });
          d.addExistingExercise(ex.id);
        }
      } else if (roll < 65) {                            // REMOVE (deliberate, by this user)
        if (S.active.entries.length) {
          const idx = rnd(S.active.entries.length);
          const goneId = S.active.entries[idx].exerciseId;
          d.removeEntry(idx);
          // the user deleting their OWN entry is legitimate — stop tracking it for them
          if (everLogged.has(goneId)) {
            everLogged.get(goneId).delete(d.label);
            if (!everLogged.get(goneId).size) everLogged.delete(goneId);
          }
        }
      } else if (roll < 90) {                            // LOG A SET
        if (S.active.entries.length) {
          const en = S.active.entries[rnd(S.active.entries.length)];
          const si = en.sets.findIndex(s => !s.warmup);
          if (si >= 0) {
            en.sets[si].weight = 100 + rnd(10) * 5;
            en.sets[si].reps = 5 + rnd(6);
            en.sets[si].done = true;
            d.save();
            if (!everLogged.has(en.exerciseId)) everLogged.set(en.exerciseId, new Set());
            everLogged.get(en.exerciseId).add(d.label);
          }
        }
      } else if (roll < 95) {                            // LEAVE then rejoin
        d.leaveTogether(); relay(A, B, 1); d.startTogether();
      } else {                                           // hostile payload injection
        d.onPresence([{ profileId: "andrew", name: "X", color: "#000\" onclick=\"alert(1)", active: true,
          workoutName: "Q", startedAt: Date.now() - 1000, updatedAt: Date.now(), joint: true,
          listAt: Date.now(), exerciseIds: ["bad');alert(1)//"],
          exercises: [{ id: "bad');alert(1)//", name: "Evil", equipment: "Barbell", angle: "None" }] }]);
      }
    } catch (e) {
      problems.push(`CRASH during op: ${e.message}`);
    }
    tick(200);
    relay(A, B, 4);

    // INV: an exercise with logged data must never vanish from that device
    for (const [exId, labels] of everLogged) {
      for (const lab of labels) {
        const dev = lab === "Hyebin" ? A : B;
        if (dev.getS().active && !dev.getS().active.entries.some(e => e.exerciseId === exId)) {
          problems.push(`LOGGED-WORK LOST: ${exId} disappeared from ${lab}`);
          everLogged.delete(exId);   // report once
        }
      }
    }
    // INV: no invalid ids ever enter state
    for (const dev of devs) {
      const s = dev.getS();
      if (s.exercises.some(e => !dev.safeId(e.id))) problems.push(`BAD ID in ${dev.label} library`);
      if (s.active && s.active.entries.some(e => !dev.safeId(e.exerciseId))) problems.push(`BAD ID in ${dev.label} session`);
    }
  }

  // let it settle, then check convergence
  relay(A, B, 10);
  const bothJoint = A.getS().active?.joint && B.getS().active?.joint;
  if (bothJoint) {
    const a = ids(A) || [], b = ids(B) || [];
    // entries kept only because they hold logged data are allowed to differ
    const protectedA = loggedIds(A), protectedB = loggedIds(B);
    const aOnly = a.filter(x => !b.includes(x) && !protectedA.includes(x));
    const bOnly = b.filter(x => !a.includes(x) && !protectedB.includes(x));
    if (aOnly.length || bOnly.length) {
      problems.push(`NO CONVERGENCE: Hyebin=[${a}] Andrew=[${b}] (unexplained A-only=[${aOnly}] B-only=[${bOnly}])`);
    }
  }
  return problems;
}

/* ---------- main ---------- */
const N = parseInt(process.argv[2] || "100", 10);
let failed = 0;
const failures = [];
for (let i = 0; i < N; i++) {
  let probs;
  try { probs = runScenario(i); }
  catch (e) { probs = [`HARNESS ERROR: ${e.stack.split("\n").slice(0,2).join(" | ")}`]; }
  if (probs.length) { failed++; if (failures.length < 8) failures.push(`  #${i}: ${probs[0]}`); }
  if ((i + 1) % 25 === 0) process.stdout.write(`  …${i + 1}/${N}\n`);
}
Date.now = realNow;
console.log(`\n${N - failed}/${N} scenarios passed`);
if (failed) {
  console.log(`\n${failed} FAILED. First few:`);
  failures.forEach(f => console.log(f));
  process.exit(1);
}
console.log("All green ✅");
