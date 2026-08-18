#!/usr/bin/env node
/* Focused checks for the superset feature. Loads the real app code from index.html
   into a stubbed device, same trick as test-sync.js. */
const fs = require("fs");
let NOW = 1_700_000_000_000;
Date.now = () => NOW;
const tick = (ms = 1000) => { NOW += ms; };

function makeEl(id) {
  return { id, innerHTML:"", textContent:"", value:"", style:{}, dataset:{}, checked:false,
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},
    addEventListener(){}, removeEventListener(){}, appendChild(){}, removeChild(){},
    remove(){}, click(){}, focus(){}, blur(){}, setAttribute(){}, getAttribute(){return null;},
    insertAdjacentHTML(){}, querySelector(){return null;}, querySelectorAll(){return [];},
    scrollIntoView(){}, play(){ return Promise.resolve(); }, pause(){}, load(){} };
}
function makeDevice(src, label) {
  const store = new Map(), els = new Map();
  const document = {
    getElementById(id){ if(!els.has(id)) els.set(id, makeEl(id)); return els.get(id); },
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    createElement(){ return makeEl("tmp"); }, addEventListener(){},
    body: makeEl("body"), head: makeEl("head"),
  };
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k,v) => store.set(k,String(v)), removeItem: k => store.delete(k),
  };
  const win = {
    APP_VERSION:"test", FIREBASE_CONFIG:{}, location:{href:"http://test/",reload(){}},
    navigator:{vibrate(){}}, addEventListener(){}, removeEventListener(){},
    setTimeout:(fn)=>{ try{fn();}catch(e){} return 0; }, clearTimeout(){},
    setInterval(){return 0;}, clearInterval(){}, scrollTo(){}, confirm:()=>true, alert:()=>{},
    AudioContext: function(){ return { state:"running", resume(){},
      createOscillator(){ return {frequency:{},connect(){},start(){},stop(){}}; },
      createGain(){ return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}; },
      destination:{}, currentTime:0 }; },
  };
  win.window = win;
  const names = ["save","render","onPresence","myPresence","applyPlan","startEmptyWorkout",
    "startWorkout","finishWorkout","addExistingExercise","removeEntry","toggleDone","startTogether",
    "seedSets","exById","markListChanged","ssRuns","activeRuns","tplRuns","ssNormalizeActive",
    "ssNormalizeTpl","ssLink","ssUnlink","ssLinkTpl","ssUnlinkTpl","ssRest","workoutById",
    "maybeOfferTemplate","tplUpdate","tplSaveNew","setRestSuperset","sanitizeCloud"];
  const factory = new Function(
    "window","document","localStorage","navigator","setTimeout","clearTimeout",
    "setInterval","clearInterval","confirm","alert","AudioContext",
    `${src}
     ;return { getS:()=>S, getRest:()=>rest, getRestLabel:()=>restLabel, getPartners:()=>partners,
       setPickTarget:v=>{pickTarget=v;},
       ${names.map(n=>`${n}: typeof ${n}!=="undefined" ? ${n} : undefined`).join(",")} };`
  );
  const api = factory(win, document, localStorage, win.navigator, win.setTimeout, win.clearTimeout,
    win.setInterval, win.clearInterval, win.confirm, win.alert, win.AudioContext);
  api.win = win; api.label = label;
  api.onPresenceW = (...a) => win.onPresence(...a);
  api.onCloudData = (...a) => win.onCloudData(...a);
  return api;
}

const html = fs.readFileSync("/Users/andrew/workout-tracker/index.html", "utf8");
const m = html.match(/<script>\s*\n?"use strict";([\s\S]*?)<\/script>/);
const SRC = m[1];

const EX = [
  {id:"bench",name:"Bench Press",equipment:"Barbell",angle:"Flat"},
  {id:"row",  name:"Cable Row",  equipment:"Cables", angle:"None"},
  {id:"squat",name:"Squat",      equipment:"Barbell",angle:"None"},
  {id:"curl", name:"Curl",       equipment:"Dumbbell",angle:"None"},
];
function reset(dev, pid){
  const S=dev.getS();
  S.profiles=[{id:"hyebin",name:"Hyebin",color:"#ff6b9d"},{id:"andrew",name:"Andrew",color:"#2f7bff"}];
  S.currentProfileId=pid; S.profilePicked=true;
  S.exercises=EX.map(e=>({...e,goal:null}));
  S.workouts=[]; S.sessions=[]; S.active=null; dev.save();
}
function add(dev, exId){ dev.setPickTarget({type:"active"}); dev.addExistingExercise(exId); }
// an added exercise lands on TOP of the list now, so seed in reverse when a case
// wants to reason about a known top-to-bottom order
const addAll=(dev, ids)=>ids.slice().reverse().forEach(id=>add(dev,id));
const order = dev => dev.getS().active.entries.map(e=>e.exerciseId);
const groups = dev => dev.getS().active.entries.map(e=>e.ss||null);

let fails=0;
function ok(cond, msg){ console.log((cond?"  ✓ ":"  ✗ ")+msg); if(!cond) fails++; }

/* ---- 1. ssRuns: only adjacent members form a group ---- */
console.log("ssRuns");
{
  const D=makeDevice(SRC,"A");
  const r=D.ssRuns(["g1","g1","g2",null,"g2"]);
  ok(r[0].letter==="A" && r[0].first && r[0].size===2, "adjacent pair → group A of 2");
  ok(r[1].last && r[1].pos===1, "second member is the last of the run");
  ok(r[2]===null && r[4]===null, "same id split apart is NOT a group");
  const r2=D.ssRuns(["g","g","g"]);
  ok(r2[1].size===3 && r2[2].last, "triset reads as one run of 3");
}

/* ---- 2. link / unlink in an active workout ---- */
console.log("link & unlink (active)");
{
  const D=makeDevice(SRC,"A"); reset(D,"andrew");
  D.startEmptyWorkout();
  addAll(D,["bench","squat","row"]);
  D.ssLink(0,2);                                   // bench + row (row is 2 slots away)
  ok(order(D).join()==="bench,row,squat", "linked exercise is pulled adjacent");
  ok(groups(D)[0] && groups(D)[0]===groups(D)[1] && !groups(D)[2], "both carry one group id");
  ok(D.activeRuns()[0].letter==="A" && D.activeRuns()[1].size===2, "renders as superset A of 2");

  add(D,"curl"); D.ssLink(1,0);                    // grow to a triset (bench pulls curl in)
  ok(order(D).join()==="curl,bench,row,squat", "third member joins the group where it sits");
  ok(D.activeRuns()[2].size===3, "now a triset");

  D.ssUnlink(1);                                   // pull the middle one out
  ok(order(D).join()==="curl,row,bench,squat", "unlinked exercise parks after the group");
  ok(D.activeRuns()[0].size===2 && !groups(D)[2], "remaining two stay a superset");

  D.ssUnlink(0);
  ok(groups(D).every(g=>!g), "dropping to one member dissolves the group");
  ok(D.activeRuns().every(r=>r===null), "no superset chrome left");
}

/* ---- 3. removing an exercise dissolves a pair ---- */
console.log("removeEntry");
{
  const D=makeDevice(SRC,"A"); reset(D,"andrew");
  D.startEmptyWorkout(); addAll(D,["bench","row"]);
  D.ssLink(0,1); D.removeEntry(1);
  ok(groups(D).every(g=>!g), "partner removed → the leftover exercise is ungrouped");
}

/* ---- 4. rest timer: short hop inside the group, full rest after the last ---- */
console.log("rest behaviour");
{
  const D=makeDevice(SRC,"A"); reset(D,"andrew");
  D.getS().restDefault=120; D.getS().restSuperset=15;
  D.startEmptyWorkout(); addAll(D,["bench","row"]);
  D.ssLink(0,1);
  const secs = () => Math.round((D.getRest().endAt - NOW)/1000);

  D.getS().active.entries[0].sets.forEach(s=>{ s.weight=100; s.reps=8; });
  D.toggleDone(0, D.getS().active.entries[0].sets.length-1);
  ok(secs()===15, `A1 ✓ → ${secs()}s hop, not the full 120`);
  ok(/next: Cable Row/.test(D.getRestLabel()), "rest bar names the next exercise");

  D.getS().active.entries[1].sets.forEach(s=>{ s.weight=100; s.reps=8; });
  D.toggleDone(1, D.getS().active.entries[1].sets.length-1);
  ok(secs()===120, `A2 ✓ → full ${secs()}s rest`);
  ok(D.getRestLabel()==="", "label cleared for a normal rest");

  D.setRestSuperset(0);
  D.toggleDone(0,0);
  ok(D.getRest().running===false, "superset rest 'None' → no timer at all between exercises");
}

/* ---- 5. templates round-trip ---- */
console.log("templates");
{
  const D=makeDevice(SRC,"A"); reset(D,"andrew");
  const S=D.getS();
  S.workouts.push({id:"w1",name:"Pull",exerciseIds:["bench","squat","row"]}); D.save();
  D.ssLinkTpl("w1","bench","row");
  const w=D.workoutById("w1");
  ok(w.exerciseIds.join()==="bench,row,squat", "template members made adjacent");
  ok(D.tplRuns(w)[0].letter==="A", "template shows superset A");

  D.startWorkout("w1");
  ok(order(D).join()==="bench,row,squat", "started workout keeps the template order");
  ok(D.activeRuns()[0] && D.activeRuns()[0].size===2, "grouping came along from the template");

  // log something in each, finish, and check history + template update
  S.active.entries.forEach(en=>{ en.sets[en.sets.length-1].weight=100; en.sets[en.sets.length-1].reps=8; en.sets[en.sets.length-1].done=true; });
  D.finishWorkout();
  const sess=S.sessions[S.sessions.length-1];
  const sRuns=D.ssRuns(sess.entries.map(e=>e.ss||null));
  ok(sRuns[0] && sRuns[0].size===2, "history session keeps the superset");

  D.ssUnlinkTpl("w1","bench");
  ok(!D.workoutById("w1").ss, "unlinking the pair clears the template map");
}

/* ---- 6. cloud sanitization ---- */
console.log("cloud sanitization");
{
  const D=makeDevice(SRC,"A");
  const clean=D.sanitizeCloud({
    workouts:[{id:"w1",exerciseIds:["a","b"],ss:{"a":"g1","b":"<img src=x>","c<":"g1"}}],
    sessions:[{id:"s1",entries:[{exerciseId:"a",ss:"onerror=alert(1)"}]}],
    restSuperset: 999,
  });
  ok(JSON.stringify(clean.workouts[0].ss)==='{"a":"g1"}', "bad group ids are dropped from the map");
  ok(clean.sessions[0].entries[0].ss===null, "unsafe session group id becomes null");
  ok(clean.restSuperset===null, "out-of-range superset rest is rejected");
  ok(D.sanitizeCloud({restSuperset:0}).restSuperset===0, "0s superset rest is allowed");
}

/* ---- 7. joint workout: grouping syncs to the partner ---- */
console.log("Together sync");
{
  const A=makeDevice(SRC,"Hyebin"), B=makeDevice(SRC,"Andrew");
  reset(A,"hyebin"); reset(B,"andrew");
  A.startEmptyWorkout(); addAll(A,["bench","squat","row"]);
  B.startEmptyWorkout(); addAll(B,["bench","squat","row"]);
  A.startTogether(); B.startTogether();
  const relay=(x,y,n=6)=>{ for(let i=0;i<n;i++){ tick(50); x.onPresenceW([y.myPresence()]); tick(50); y.onPresenceW([x.myPresence()]); } };
  relay(A,B);
  tick(1000);
  A.ssLink(0,2);                    // Hyebin supersets bench + row
  relay(A,B);
  ok(order(B).join()===order(A).join(), "partner's order matches");
  ok(B.activeRuns()[0] && B.activeRuns()[0].size===2, "partner sees the superset");
  ok(groups(B)[0]===groups(A)[0], "same group id on both phones");

  tick(1000);
  B.ssUnlink(0);                    // Andrew breaks it
  relay(A,B);
  ok(A.activeRuns().every(r=>r===null) && B.activeRuns().every(r=>r===null), "unlink propagates back");
  relay(A,B); relay(A,B);
  ok(JSON.stringify(groups(A))===JSON.stringify(groups(B)), "converged, no ping-pong");
}

console.log(fails ? `\n${fails} check(s) FAILED` : "\nAll superset checks passed ✅");
process.exit(fails?1:0);
