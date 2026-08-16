#!/usr/bin/env node
/* Headless check of assisted-lift progression, volume and PR ranking.
   Loads the real app source out of index.html (same trick as test-sync.js). */
const fs = require("fs");
const path = require("path");

let NOW = 1_700_000_000_000;
Date.now = () => NOW;

function makeEl(id) {
  return { id, innerHTML:"", textContent:"", value:"", style:{}, dataset:{}, checked:false,
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},
    addEventListener(){}, removeEventListener(){}, appendChild(){}, removeChild(){},
    remove(){}, click(){}, focus(){}, blur(){}, setAttribute(){}, getAttribute(){return null;},
    insertAdjacentHTML(){}, querySelector(){return null;}, querySelectorAll(){return [];}, scrollIntoView(){} };
}
const REPO = __dirname;
const html = fs.readFileSync(path.join(REPO, "index.html"), "utf8");
const m = html.match(/<script>\s*\n?"use strict";([\s\S]*?)<\/script>/);
if (!m) { console.error("no main script block"); process.exit(2); }
const APP_SRC = m[1];

const store = new Map(), els = new Map();
const document = {
  getElementById(id){ if(!els.has(id)) els.set(id, makeEl(id)); return els.get(id); },
  querySelector(){ return null; }, querySelectorAll(){ return []; },
  createElement(){ return makeEl("tmp"); }, addEventListener(){}, body:makeEl("body"), head:makeEl("head"),
};
const localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k,v) => store.set(k, String(v)), removeItem: k => store.delete(k),
};
const win = { APP_VERSION:"test", FIREBASE_CONFIG:{}, location:{href:"http://test/",reload(){}},
  navigator:{vibrate(){}}, addEventListener(){}, removeEventListener(){},
  setTimeout:(fn)=>{ try{fn();}catch(e){} return 0; }, clearTimeout(){}, setInterval(){return 0;}, clearInterval(){},
  scrollTo(){}, confirm:()=>true, alert:()=>{},
  AudioContext: function(){ return {state:"running",resume(){},createOscillator(){return {frequency:{},connect(){},start(){},stop(){}};},createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};},destination:{},currentTime:0}; } };
win.window = win;

const names = ["S","save","recommend","isAssisted","looksAssisted","assistDecrement","sessionVolume",
  "bestSetIn","prFor","setLabel","workingWeightOf","seedSets","exById","myPresence"];
const factory = new Function("window","document","localStorage","navigator","setTimeout","clearTimeout",
  "setInterval","clearInterval","confirm","alert","AudioContext",
  `${APP_SRC}\n;return { getS:()=>S, ${names.filter(n=>n!=="S").map(n=>`${n}: typeof ${n}!=="undefined"?${n}:undefined`).join(", ")} };`);
const app = factory(win, document, localStorage, win.navigator, win.setTimeout, win.clearTimeout,
  win.setInterval, win.clearInterval, win.confirm, win.alert, win.AudioContext);

/* ---------- fixtures ---------- */
const S = app.getS();
S.profiles = [{id:"hyebin",name:"Hyebin",color:"#ff6b9d"},{id:"andrew",name:"Andrew",color:"#2f7bff"}];
S.currentProfileId = "hyebin";
S.exercises = [
  {id:"apu",  name:"Assisted Pull Up", equipment:"Machine", angle:"None", goal:{sets:3,repsLow:6,repsHigh:10}},
  {id:"bench",name:"Bench Press",      equipment:"Barbell", angle:"Flat", goal:{sets:3,repsLow:6,repsHigh:10}},
  {id:"band", name:"Pull Up",          equipment:"Bodyweight", angle:"None", goal:{sets:3,repsLow:6,repsHigh:10}, assisted:true},
];
S.workouts = []; S.sessions = []; S.active = null;

let fails = 0, n = 0;
function chk(label, got, want) {
  n++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails++; console.log(`FAIL ${label}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
  else console.log(`ok   ${label} → ${JSON.stringify(got)}`);
}
function chkT(label, cond, extra) { n++; if (!cond) { fails++; console.log(`FAIL ${label} ${extra??""}`); } else console.log(`ok   ${label}`); }
function logSession(exId, sets, pid="hyebin") {
  NOW += 86400000;
  S.sessions.push({ id:"s"+S.sessions.length, workoutId:null, workoutName:"W", profileId:pid,
    startedAt:NOW-3600000, endedAt:NOW, durationSec:3600,
    entries:[{ exerciseId:exId, sets:sets.map(s=>({weight:s[0],reps:s[1],rpe:s[2]??null})) }] });
  app.save();
}

/* ---------- detection ---------- */
chk("looksAssisted('Assisted Pull Up')", app.looksAssisted("Assisted Pull Up"), true);
chk("looksAssisted('Band Assisted Dip')", app.looksAssisted("Band Assisted Dip"), true);
chk("looksAssisted('Bench Press')", app.looksAssisted("Bench Press"), false);
chk("explicit flag beats name", app.isAssisted({name:"Pull Up", assisted:true}), true);
chk("explicit false beats name", app.isAssisted({name:"Assisted Pull Up", assisted:false}), false);

/* ---------- progression: assistance comes OFF ---------- */
logSession("apu", [[60,10],[60,10],[60,10]]);
let r = app.recommend("hyebin", "apu");
chk("all sets hit top → less help", r.working.map(s=>s.w), [55,55,55]);
chk("…and reps reset to bottom", r.working.map(s=>s.r), [6,6,6]);
chk("no warmups on assisted", r.warmups, []);
chkT("note says cut assistance", /Cut assistance/.test(r.note), r.note);

/* control: the same shape on a normal lift still goes UP */
logSession("bench", [[135,10],[135,10],[135,10]]);
chk("normal lift still adds weight", app.recommend("hyebin","bench").working.map(s=>s.w), [140,140,140]);

/* short of the top → hold the help, add a rep */
logSession("apu", [[55,8],[55,7],[55,6]]);
r = app.recommend("hyebin","apu");
chk("missed top → hold help", r.working.map(s=>s.w), [55,55,55]);
chk("…add ~1 rep per set", r.working.map(s=>s.r), [9,8,7]);
chkT("note says cut once you reach top", /Cut assistance once/.test(r.note), r.note);

/* big assistance drops in bigger bites (10%, min 5, rounded to 5) */
chk("decrement at 60", app.assistDecrement(60), 5);
chk("decrement at 100", app.assistDecrement(100), 10);
chk("decrement at 145", app.assistDecrement(145), 15);
chk("decrement at 20", app.assistDecrement(20), 5);

/* floors at zero, then keeps earning reps */
logSession("apu", [[5,10],[5,10],[5,10]]);
r = app.recommend("hyebin","apu");
chk("last 5 lb of help comes off", r.working.map(s=>s.w), [0,0,0]);
chkT("note names bodyweight", /bodyweight/i.test(r.note), r.note);

logSession("apu", [[0,10],[0,10],[0,10]]);
r = app.recommend("hyebin","apu");
chk("unassisted top-of-range doesn't go negative", r.working.map(s=>s.w), [0,0,0]);
chkT("note says nothing left to strip", /Nothing left to strip/.test(r.note), r.note);

/* a 0-assist session must not read as "no data" and send you back to the machine */
chk("workingWeightOf counts 0 when assisted", app.workingWeightOf([{weight:0,reps:10}], true), 0);
chk("workingWeightOf ignores 0 otherwise", app.workingWeightOf([{weight:0,reps:10}], false), 0);

/* ---------- volume ---------- */
S.sessions = [];
logSession("apu", [[60,10],[60,10]]);
chk("assisted work adds no volume", app.sessionVolume(S.sessions[0]), 0);
S.sessions = [];
logSession("bench", [[135,10],[135,10]]);
chk("normal work still counts", app.sessionVolume(S.sessions[0]), 2700);

/* ---------- PRs ---------- */
S.sessions = [];
logSession("apu", [[60,8]]);
logSession("apu", [[40,8]]);
let pr = app.prFor("hyebin","apu");
chk("less help ranks as the PR", [pr.weight, pr.reps], [40,8]);
logSession("apu", [[40,12]]);
pr = app.prFor("hyebin","apu");
chk("same help, more reps wins", [pr.weight, pr.reps], [40,12]);
logSession("apu", [[80,20]]);
pr = app.prFor("hyebin","apu");
chk("piling on help is not a PR", [pr.weight, pr.reps], [40,12]);
chk("PR reads in plain words", app.setLabel(pr), "12 reps @ 40 help");
chk("unassisted PR reads right", app.setLabel({weight:0,reps:5,assisted:true}), "5 reps unassisted");
chk("normal PR unchanged", app.setLabel({weight:225,reps:5,assisted:false}), "225 × 5");

/* explicit-flag exercise gets the same treatment under a normal name */
S.sessions = [];
logSession("band", [[30,10],[30,10],[30,10]]);
chk("flagged 'Pull Up' also sheds help", app.recommend("hyebin","band").working.map(s=>s.w), [25,25,25]);

/* ---------- seeding a live session ---------- */
S.sessions = [];
logSession("apu", [[60,10],[60,10],[60,10]]);
S.active = { workoutId:null, profileId:"hyebin", startedAt:NOW, entries:[] };
const seeded = app.seedSets("apu");
chk("seeded sets carry the lower help", seeded.map(s=>s.recW), [55,55,55]);
chkT("no warmup rows seeded", seeded.every(s=>!s.warmup));

/* ---------- presence carries the flag ---------- */
S.active.entries = [{exerciseId:"apu", sets:seeded, addedAt:NOW}];
const pres = app.myPresence();
chk("presence publishes assisted", pres.exercises.map(d=>[d.id,d.assisted]), [["apu",true]]);

console.log(`\n${n-fails}/${n} checks passed`);
process.exit(fails ? 1 : 0);
