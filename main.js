import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ============================================================
   BOOT SCREEN
   ============================================================ */
const bootScreen = document.getElementById("boot-screen");
const bootFill = document.getElementById("boot-fill");
const bootStatus = document.getElementById("boot-status");
const bootStart = document.getElementById("boot-start");
let bootDone = false;

function setBootProgress(p){
  const pct = Math.min(99, Math.round(p*100));
  bootFill.style.width = pct + "%";
  bootStatus.textContent = `LOADING WORLD… ${pct}%`;
}
function bootReady(){
  if (bootDone) return;
  bootDone = true;
  bootFill.style.width = "100%";
  bootStatus.textContent = "WORLD READY";
  bootStart.classList.remove("hidden");
}
function dismissBoot(){
  bootScreen.classList.add("done");
  document.body.style.overflow = "";
  setTimeout(()=>playEmote("Wave"), 350);
  setTimeout(()=>toast("Welcome, visitor!", "You discovered Waed's portfolio"), 1400);
}
bootStart.addEventListener("click", dismissBoot);
document.body.style.overflow = "hidden";
setTimeout(bootReady, 25000);

/* ============================================================
   3D CHARACTER
   ============================================================ */
const canvas = document.getElementById("chibi-canvas");
const stageHint = document.getElementById("stage-hint");
const emoteBar = document.getElementById("emote-bar");

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ canvas, alpha:true, antialias:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

// Character uses an unlit material (MeshBasicMaterial), so scene lights don't affect
// it — a single ambient light is kept only as a harmless fallback.
scene.add(new THREE.AmbientLight(0xffffff, 1.0));

const controls = new OrbitControls(camera, canvas);
controls.enableZoom = true;
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.autoRotate = !reduce;
controls.autoRotateSpeed = 1.0;
controls.minPolarAngle = Math.PI*0.30;
controls.maxPolarAngle = Math.PI*0.62;

let mixer=null, activeAction=null, model=null;
const actions={};
const clock = new THREE.Clock();
const IDLES = ["Idle","Idle2"];
const ONE_SHOT = new Set(["Wave","Heart","Agree","Jump","Hop"]);
let idleTimer=0;

const loader = new GLTFLoader();
loader.load("assets/chibi.glb",
  (gltf)=>{
    model = gltf.scene;
    scene.add(model);

    // This Meshy export bakes all color into the texture and wires it as an
    // EMISSIVE map (emissiveFactor [1,1,1]) on an otherwise metallic PBR material.
    // Lit PBR makes it look dark/metallic. The texture is fully pre-shaded, so the
    // correct treatment is an UNLIT material that shows the texture exactly as painted.
    model.traverse((o)=>{
      if (!o.isMesh) return;
      o.frustumCulled = false;
      const srcs = Array.isArray(o.material)?o.material:[o.material];
      const newMats = srcs.map((m)=>{
        // Prefer whichever map holds the baked color (emissive here; fall back to base).
        const tex = m.emissiveMap || m.map;
        if (tex){ tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true; }
        const basic = new THREE.MeshBasicMaterial({
          map: tex || null,
          color: 0xffffff,
          side: THREE.DoubleSide,
          transparent: false,
        });
        // carry skinning support across to the new material
        basic.skinning = true;
        return basic;
      });
      o.material = Array.isArray(o.material) ? newMats : newMats[0];
    });

    mixer = new THREE.AnimationMixer(model);
    gltf.animations.forEach((c)=>{ actions[c.name] = mixer.clipAction(c); });
    if (actions[IDLES[0]]){ activeAction = actions[IDLES[0]]; activeAction.play(); }
    mixer.addEventListener("finished", ()=> playEmote(pickIdle(), true));
    mixer.update(0); model.updateMatrixWorld(true);

    // skinned-aware bounds
    const box = new THREE.Box3();
    model.traverse((o)=>{
      if (o.isSkinnedMesh){ o.computeBoundingBox(); box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); }
      else if (o.isMesh){ box.expandByObject(o); }
    });
    if (box.isEmpty()) box.setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);

    const aspect = (canvas.clientWidth/canvas.clientHeight)||0.9;
    camera.aspect = aspect;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2*Math.atan(Math.tan(vFov/2)*aspect);
    const distH = (size.y/2)/Math.tan(vFov/2);
    const distW = (size.x/2)/Math.tan(hFov/2);
    const dist = (Math.max(distH,distW)+size.z/2)*1.3;
    camera.position.set(0, size.y*0.02, dist);
    camera.near = dist/100; camera.far = dist*100;
    camera.updateProjectionMatrix();
    controls.target.set(0,0,0);
    controls.minDistance = dist*0.55;
    controls.maxDistance = dist*1.7;
    controls.update();

    bootReady();
  },
  (xhr)=>{ if (xhr.total) setBootProgress(xhr.loaded/xhr.total); else setBootProgress(Math.min(0.95, xhr.loaded/5_000_000)); },
  (err)=>{ console.error("GLB failed:", err); bootStatus.textContent="3D COMPANION UNAVAILABLE — CONTINUING"; bootReady(); }
);

function pickIdle(){ return IDLES[Math.floor(Math.random()*IDLES.length)]; }
function playEmote(name, returningToIdle=false){
  const next = actions[name];
  if (!next || !mixer) return;
  if (next===activeAction && !returningToIdle) return;
  next.reset();
  next.setLoop(ONE_SHOT.has(name)?THREE.LoopOnce:THREE.LoopRepeat, ONE_SHOT.has(name)?1:Infinity);
  next.clampWhenFinished = ONE_SHOT.has(name);
  if (activeAction && activeAction!==next) next.crossFadeFrom(activeAction, 0.3, true);
  next.play();
  activeAction = next;
  idleTimer = 0;
  emoteBar.querySelectorAll("button").forEach((b)=> b.classList.toggle("active", b.dataset.anim===name));
}
emoteBar.addEventListener("click",(e)=>{
  const btn = e.target.closest("button[data-anim]");
  if (!btn) return;
  playEmote(btn.dataset.anim);
  stageHint.style.opacity = "0";
  unlockOnce("emote","Emote master!","You made the character perform");
});

function resizeRenderer(){
  const w=canvas.clientWidth, h=canvas.clientHeight;
  if (canvas.width!==w || canvas.height!==h){
    renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix();
  }
}
function tick(){
  requestAnimationFrame(tick);
  resizeRenderer();
  controls.update();
  const dt = clock.getDelta();
  if (mixer) mixer.update(dt);
  // occasionally swap idle pose for liveliness
  if (activeAction && IDLES.includes(activeActionName())){
    idleTimer += dt;
    if (idleTimer > 9){ idleTimer = 0; playEmote(pickIdle(), true); }
  }
  renderer.render(scene, camera);
}
function activeActionName(){ return Object.keys(actions).find(k=>actions[k]===activeAction); }
tick();

/* ============================================================
   HERO: starfield + floating icons + scroll parallax
   ============================================================ */
const starsWrap = document.getElementById("stars");
for (let i=0;i<70;i++){
  const s=document.createElement("span"); s.className="star";
  const size=Math.random()*2.2+0.6;
  s.style.cssText=`left:${Math.random()*100}%;top:${Math.random()*100}%;width:${size}px;height:${size}px;--d:${2+Math.random()*4}s;animation-delay:${Math.random()*4}s`;
  starsWrap.appendChild(s);
}

const DEVICON="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons";
const floatIcons=[
  ["python",`${DEVICON}/python/python-original.svg`],
  ["tensorflow",`${DEVICON}/tensorflow/tensorflow-original.svg`],
  ["java",`${DEVICON}/java/java-original.svg`],
  ["blender",`${DEVICON}/blender/blender-original.svg`],
  ["keras",`${DEVICON}/keras/keras-original.svg`],
  ["mysql",`${DEVICON}/mysql/mysql-original.svg`],
  ["pandas",`${DEVICON}/pandas/pandas-original.svg`],
  ["javascript",`${DEVICON}/javascript/javascript-original.svg`],
  ["numpy",`${DEVICON}/numpy/numpy-original.svg`],
  ["git",`${DEVICON}/git/git-original.svg`],
];
const slots=[[6,16],[14,70],[4,44],[22,26],[88,18],[93,50],[82,74],[70,12],[10,88],[90,86]];
const floatWrap=document.getElementById("float-icons");
const parallaxEls=[];
floatIcons.forEach(([n,u],i)=>{
  const d=document.createElement("div"); d.className="f-icon";
  const [x,y]=slots[i%slots.length];
  d.style.left=x+"%"; d.style.top=y+"%";
  d.style.setProperty("--fd",7+Math.random()*6+"s");
  d.style.setProperty("--fdel",-Math.random()*8+"s");
  d.innerHTML=`<img src="${u}" alt="${n} logo" loading="lazy">`;
  floatWrap.appendChild(d);
  parallaxEls.push({el:d, depth:0.4+Math.random()*0.9, sp:0.05+Math.random()*0.12});
});
if (!reduce){
  window.addEventListener("pointermove",(e)=>{
    const cx=(e.clientX/innerWidth-0.5)*2, cy=(e.clientY/innerHeight-0.5)*2;
    parallaxEls.forEach(({el,depth})=>{
      el.style.setProperty("--tx",`${cx*depth*-18}px`);
      el.style.marginTop=`${cy*depth*-12}px`;
    });
  },{passive:true});
}

/* ============================================================
   SKILL TREE — Blender/3D added
   ============================================================ */
const skills=[
  { title:"AI / Machine Learning", xp:92, lvl:"LV. 92", icons:[
    ["TensorFlow",`${DEVICON}/tensorflow/tensorflow-original.svg`],["Keras",`${DEVICON}/keras/keras-original.svg`],
    ["NumPy",`${DEVICON}/numpy/numpy-original.svg`],["Pandas",`${DEVICON}/pandas/pandas-original.svg`],
    ["scikit-learn",`${DEVICON}/scikitlearn/scikitlearn-original.svg`]] },
  { title:"Programming", xp:90, lvl:"LV. 90", icons:[
    ["Python",`${DEVICON}/python/python-original.svg`],["Java",`${DEVICON}/java/java-original.svg`],
    ["C",`${DEVICON}/c/c-original.svg`],["PHP",`${DEVICON}/php/php-original.svg`],
    ["JavaScript",`${DEVICON}/javascript/javascript-original.svg`]] },
  { title:"Web Development", xp:85, lvl:"LV. 85", icons:[
    ["HTML5",`${DEVICON}/html5/html5-original.svg`],["CSS3",`${DEVICON}/css3/css3-original.svg`],
    ["JavaScript",`${DEVICON}/javascript/javascript-original.svg`],["Bootstrap",`${DEVICON}/bootstrap/bootstrap-original.svg`],
    ["PHP",`${DEVICON}/php/php-original.svg`]] },
  { title:"3D & Design", xp:80, lvl:"LV. 80", icons:[
    ["Blender",`${DEVICON}/blender/blender-original.svg`],["Three.js",`${DEVICON}/threejs/threejs-original.svg`]],
    tags:["3D modeling","Animation","glTF / GLB","WebGL"] },
  { title:"Databases", xp:86, lvl:"LV. 86", icons:[
    ["MySQL",`${DEVICON}/mysql/mysql-original.svg`],["MongoDB",`${DEVICON}/mongodb/mongodb-original.svg`]],
    tags:["Relational design","SQL","NoSQL"] },
  { title:"Data Analytics", xp:88, lvl:"LV. 88", icons:[
    ["Jupyter",`${DEVICON}/jupyter/jupyter-original.svg`],["Plotly",`${DEVICON}/plotly/plotly-original.svg`],
    ["Matplotlib",`${DEVICON}/matplotlib/matplotlib-original.svg`]],
    tags:["Excel","Power BI","Google Cloud Data Analytics"] },
  { title:"Tools & Workflow", xp:84, lvl:"LV. 84", icons:[
    ["Git",`${DEVICON}/git/git-original.svg`],["VS Code",`${DEVICON}/vscode/vscode-original.svg`],
    ["Jupyter",`${DEVICON}/jupyter/jupyter-original.svg`]],
    tags:["NetBeans","XAMPP","Microsoft Office"] },
];
const skillGrid=document.getElementById("skill-grid");
skills.forEach((sk)=>{
  const card=document.createElement("div"); card.className="skill-card reveal";
  card.innerHTML=`
    <h3><span class="dot"></span>${sk.title}</h3>
    <div class="skill-icons">
      ${sk.icons.map(([n,u])=>`<span class="si" data-name="${n}"><img src="${u}" alt="${n}" loading="lazy"></span>`).join("")}
    </div>
    ${sk.tags?`<div class="chip-row" style="margin-bottom:1rem">${sk.tags.map(t=>`<span class="chip">${t}</span>`).join("")}</div>`:""}
    <div class="skill-xp"><div class="bar"><div class="bar-fill" data-w="${sk.xp}"></div></div><span class="xp-label">${sk.lvl}</span></div>`;
  skillGrid.appendChild(card);
});

/* ============================================================
   SCROLL REVEALS — staggered, alternating directions
   ============================================================ */
function tagReveals(){
  document.querySelectorAll(".skill-grid .reveal").forEach((el,i)=> el.style.transitionDelay=`${(i%3)*0.08}s`);
  document.querySelectorAll(".quest-grid .reveal").forEach((el,i)=> el.style.transitionDelay=`${i*0.1}s`);
  document.querySelectorAll(".ach-grid .reveal").forEach((el,i)=> el.style.transitionDelay=`${i*0.08}s`);
  document.querySelectorAll(".tl-item.reveal").forEach((el,i)=> el.classList.add(i%2?"from-right":"from-left"));
}
tagReveals();

const io=new IntersectionObserver((entries)=>{
  entries.forEach((en)=>{
    if (!en.isIntersecting) return;
    en.target.classList.add("in");
    en.target.querySelectorAll(".bar-fill").forEach((b)=> b.style.width=b.dataset.w+"%");
    if (en.target.classList.contains("glitch")) en.target.classList.add("go");
    io.unobserve(en.target);
  });
},{threshold:0.16});
document.querySelectorAll(".reveal").forEach((el)=> io.observe(el));

// hero stat counters
const counterIO=new IntersectionObserver((entries)=>{
  entries.forEach((en)=>{
    if (!en.isIntersecting) return;
    const el=en.target, target=+el.dataset.count; let cur=0;
    const step=()=>{ cur=Math.min(target, cur+Math.max(1, target/30)); el.textContent=Math.round(cur); if (cur<target) requestAnimationFrame(step); };
    step(); counterIO.unobserve(el);
  });
},{threshold:0.6});
document.querySelectorAll(".hstat-num").forEach((el)=> counterIO.observe(el));

/* ============================================================
   SCROLL-LINKED EFFECTS (rAF-throttled)
   ============================================================ */
const xpFill=document.getElementById("xp-fill");
const tlLine=document.getElementById("tl-line");
const timeline=document.querySelector(".timeline");
const heroStage=document.querySelector(".hero-stage");
const heroCopy=document.querySelector(".hero-copy");
const gridFloor=document.getElementById("grid-floor");
const levelPill=document.getElementById("level-pill");
const levelText=document.getElementById("level-text");

const sections=[...document.querySelectorAll("main > section")];
const sectionNames={hero:"Start",about:"Profile",skills:"Skill Tree",quests:"Quests",demo:"Live AI",log:"Adventure Log",achievements:"Achievements",contact:"Recruit"};

// build dots
const dotsWrap=document.getElementById("dots");
sections.forEach((s)=>{
  const a=document.createElement("a");
  a.href=`#${s.id}`;
  a.dataset.label=sectionNames[s.id]||s.id;
  dotsWrap.appendChild(a);
});
const dots=[...dotsWrap.children];

let ticking=false;
function onScroll(){
  if (ticking) return; ticking=true;
  requestAnimationFrame(()=>{
    const h=document.documentElement;
    const top=h.scrollTop;
    const p=top/(h.scrollHeight-h.clientHeight);
    xpFill.style.width=p*100+"%";
    if (p>0.985) unlockOnce("scroll","Completionist!","You explored the whole world");

    // hero parallax (only while hero in view)
    if (top < innerHeight){
      if (heroStage) heroStage.style.transform=`translateY(${top*0.18}px)`;
      if (heroCopy) heroCopy.style.transform=`translateY(${top*0.06}px)`;
      const op=Math.max(0, 1-top/(innerHeight*0.8));
      if (heroCopy) heroCopy.style.opacity=op;
      if (heroStage) heroStage.style.opacity=op;
      if (gridFloor) gridFloor.style.opacity=0.5*op;
    }

    // growing timeline line
    if (timeline){
      const r=timeline.getBoundingClientRect();
      const vis=Math.min(Math.max((innerHeight*0.6 - r.top)/(r.height),0),1);
      tlLine.style.height=vis*100+"%";
    }

    // scroll-spy dots + level pill
    let idx=0;
    sections.forEach((s,i)=>{ if (s.getBoundingClientRect().top <= innerHeight*0.4) idx=i; });
    dots.forEach((d,i)=> d.classList.toggle("active", i===idx));
    levelText.textContent=`ZONE ${idx+1} / ${sections.length}`;
    levelPill.classList.toggle("show", top>innerHeight*0.5);

    ticking=false;
  });
}
window.addEventListener("scroll", onScroll, {passive:true});
onScroll();

/* ============================================================
   TILT on cards (pointer)
   ============================================================ */
if (!reduce && window.matchMedia("(pointer:fine)").matches){
  document.querySelectorAll("[data-tilt]").forEach((el)=>{
    el.addEventListener("pointermove",(e)=>{
      const r=el.getBoundingClientRect();
      const px=(e.clientX-r.left)/r.width-0.5;
      const py=(e.clientY-r.top)/r.height-0.5;
      el.style.transform=`perspective(800px) rotateY(${px*8}deg) rotateX(${-py*8}deg) translateY(-4px)`;
    });
    el.addEventListener("pointerleave",()=>{ el.style.transform=""; });
  });
}

/* ============================================================
   TYPED CLASS TITLES
   ============================================================ */
const roles=["Software Engineer","AI / ML Developer","Data Analyst","Full-Stack Developer","3D Enthusiast"];
const typedEl=document.getElementById("typed");
if (!reduce){
  let ri=0, ci=roles[0].length, deleting=true;
  setTimeout(function loop(){
    const word=roles[ri];
    ci += deleting?-1:1;
    typedEl.textContent=word.slice(0,ci);
    if (!deleting && ci===word.length){ deleting=true; setTimeout(loop,2200); return; }
    if (deleting && ci===0){ deleting=false; ri=(ri+1)%roles.length; }
    setTimeout(loop, deleting?45:85);
  },2400);
}

/* ============================================================
   NAV / TOAST / EASTER EGG
   ============================================================ */
const nav=document.getElementById("hud-nav");
const burger=document.getElementById("hud-burger");
burger.addEventListener("click",()=> nav.classList.toggle("open"));
nav.querySelectorAll("a").forEach((a)=> a.addEventListener("click",()=> nav.classList.remove("open")));
document.getElementById("year").textContent=new Date().getFullYear();

const toastEl=document.getElementById("toast");
const toastTitle=document.getElementById("toast-title");
const toastText=document.getElementById("toast-text");
let toastTimer;
function toast(title,text){
  toastTitle.textContent=title; toastText.textContent=text;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=> toastEl.classList.remove("show"),3800);
}
const unlocked=new Set();
function unlockOnce(key,title,text){ if (unlocked.has(key)) return; unlocked.add(key); toast(title,text); }

const KONAMI=["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
let kPos=0;
window.addEventListener("keydown",(e)=>{
  kPos = e.key===KONAMI[kPos] ? kPos+1 : (e.key===KONAMI[0]?1:0);
  if (kPos===KONAMI.length){
    kPos=0; playEmote("Dance");
    document.querySelector(".hero-stage")?.scrollIntoView({behavior:"smooth",block:"center"});
    unlockOnce("konami","Secret found!","↑↑↓↓←→←→BA — dance party activated");
  }
});

// ============================================================
// LIVE AI DEMO — append this to main.js
// 1) Set API_URL below to your deployed backend URL.
// ============================================================
const API_URL = "https://YOUR-APP-NAME.onrender.com"; // <-- paste your Render/Railway URL here

(function initDemo(){
  const form = document.getElementById("demo-form");
  if (!form) return;

  // inject gauge gradient def once
  const svg = document.querySelector(".gauge");
  if (svg && !document.getElementById("gg")){
    const ns="http://www.w3.org/2000/svg";
    const defs=document.createElementNS(ns,"defs");
    defs.innerHTML=`<linearGradient id="gg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#5EE6FF"/><stop offset="1" stop-color="#FF7BAC"/></linearGradient>`;
    svg.prepend(defs);
  }

  // live slider value labels
  const bind=(name,el,fmt=(v)=>v)=>{
    const i=form.querySelector(`[name="${name}"]`); const o=document.getElementById(el);
    if(!i||!o) return; const up=()=>o.textContent=fmt(i.value); i.addEventListener("input",up); up();
  };
  bind("age","u-age"); bind("resting_bp_s","u-bp"); bind("cholesterol","u-chol");
  bind("max_heart_rate","u-hr"); bind("oldpeak","u-op",(v)=>Number(v).toFixed(1));

  // presets
  const PRESETS={
    healthy:{age:42,sex:0,chest_pain_type:3,resting_bp_s:118,cholesterol:198,fasting_blood_sugar:0,resting_ecg:0,max_heart_rate:172,exercise_angina:0,oldpeak:0.0,st_slope:1},
    risky:{age:63,sex:1,chest_pain_type:4,resting_bp_s:160,cholesterol:320,fasting_blood_sugar:1,resting_ecg:2,max_heart_rate:104,exercise_angina:1,oldpeak:3.2,st_slope:3},
  };
  form.querySelectorAll(".preset").forEach((b)=>{
    b.addEventListener("click",()=>{
      const p=PRESETS[b.dataset.preset]; if(!p) return;
      Object.entries(p).forEach(([k,v])=>{
        const el=form.querySelector(`[name="${k}"]`); if(!el) return;
        el.value=v; el.dispatchEvent(new Event("input"));
      });
    });
  });

  const result=document.getElementById("demo-result");
  const fillEl=document.getElementById("gauge-fill");
  const needle=document.getElementById("gauge-needle");
  const pctEl=document.getElementById("gauge-pct");
  const labelEl=document.getElementById("gauge-label");
  const statusEl=document.getElementById("result-status");
  const metaEl=document.getElementById("result-meta");
  const submit=document.getElementById("demo-submit");

  function setGauge(pct){
    const frac=Math.max(0,Math.min(100,pct))/100;
    fillEl.style.strokeDashoffset=String(283-283*frac);
    needle.style.transform=`rotate(${-90+frac*180}deg)`;
    pctEl.textContent=pct.toFixed(1)+"%";
  }

  async function callAPI(payload, attempt=0){
    const ctrl=new AbortController();
    const t=setTimeout(()=>ctrl.abort(), 60000); // free tier cold start can be slow
    try{
      const res=await fetch(`${API_URL}/predict`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload),signal:ctrl.signal,
      });
      clearTimeout(t);
      if(!res.ok) throw new Error("HTTP "+res.status);
      return await res.json();
    }catch(err){
      clearTimeout(t);
      // one retry for the "sleeping server is waking up" case
      if(attempt===0){
        statusEl.textContent="Waking the AI server… (free hosting sleeps when idle, ~30s)";
        statusEl.className="result-status warming";
        await new Promise(r=>setTimeout(r,3000));
        return callAPI(payload,1);
      }
      throw err;
    }
  }

  form.addEventListener("submit",async(e)=>{
    e.preventDefault();
    if(API_URL.includes("YOUR-APP-NAME")){
      statusEl.textContent="Demo not connected yet — set API_URL in main.js to your deployed backend.";
      statusEl.className="result-status error"; return;
    }
    const fd=new FormData(form);
    const payload={
      age:+fd.get("age"), sex:+fd.get("sex"), chest_pain_type:+fd.get("chest_pain_type"),
      resting_bp_s:+fd.get("resting_bp_s"), cholesterol:+fd.get("cholesterol"),
      fasting_blood_sugar:+fd.get("fasting_blood_sugar"), resting_ecg:+fd.get("resting_ecg"),
      max_heart_rate:+fd.get("max_heart_rate"), exercise_angina:+fd.get("exercise_angina"),
      oldpeak:+fd.get("oldpeak"), st_slope:+fd.get("st_slope"),
    };
    submit.disabled=true; submit.textContent="⏳ Running…";
    statusEl.textContent="Sending readings to the neural network…";
    statusEl.className="result-status";
    labelEl.textContent="Analyzing";
    try{
      const data=await callAPI(payload);
      setGauge(data.percent);
      const high=data.prediction.toLowerCase().includes("high");
      result.classList.toggle("high",high);
      result.classList.toggle("low",!high);
      labelEl.textContent=data.prediction;
      statusEl.textContent=high
        ? "The model predicts elevated heart-disease risk for these inputs."
        : "The model predicts lower heart-disease risk for these inputs.";
      statusEl.className="result-status";
      metaEl.textContent=`MLP · sigmoid output ${data.probability} · threshold ${data.threshold}`;
      if(typeof unlockOnce==="function") unlockOnce("aidemo","Boss defeated!","You ran Waed's live AI model");
    }catch(err){
      statusEl.textContent="Couldn't reach the AI server. It may be starting up — try again in a moment.";
      statusEl.className="result-status error";
      labelEl.textContent="Connection error";
      metaEl.textContent="";
    }finally{
      submit.disabled=false; submit.textContent="⚡ Run Prediction";
    }
  });
})();
