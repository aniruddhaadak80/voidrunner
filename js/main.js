import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { load as loadSave, persist as persistSave, SKINS, ACH, SECTOR_NAMES, levelInfo, skinById } from './save.js';
import { AudioSys } from './audio.js';
import { Stars, Dust, Nebula, NEBULA_PALETTES } from './fx.js';
import { Explosions, Shocks, Debris, Flash, Trails } from './fx2.js';
import { Ship } from './ship.js';
import { World } from './world.js';
import { UI } from './ui.js';

const W = 150, H = 95;
const isTouch = window.matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;

let renderer, scene, camera, composer, bloomPass;
let clock, elapsed = 0;
let mode = 'boot', prevPauseMode = 'play', panelReturn = 'menu-main';
let cd = 0, cdLast = 99;
let runSeq = 0;
let consume = null;
let deathPos = new THREE.Vector3();
const keys = {};
const gp = { on: false, index: -1, prev: {} };
const input = { mx: 0, my: 0, touchId: null, sx0: 0, sy0: 0, tx: 0, ty: 0, stickX: 0, stickY: 0, locked: false };
const bolts = [];
const activeBolts = [];
const boltPool = [];
const tmpV1 = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpV3 = new THREE.Vector3();

const state = {
  speed: 0, dist: 0, score: 0, combo: 0, mult: 1, crystals: 0, gates: 0,
  nearMisses: 0, maxCombo: 0, escapes: 0, hull: 100, maxHull: 100, energy: 100,
  boost: false, brake: false, boostEff: false,
  steer: { x: 0, y: 0, tx: 0, ty: 0 },
  rollT: 0, rollDir: 1, rollCd: 0, invuln: 0, calm: 0, edgeT: 0,
  trauma: 0, timeScale: 1, slowT: 0, bhDanger: null, damageTaken: 0, consuming: false,
  heat: 0, overheat: 0, fireCd: 0, targetLock: false,
  shield: 0, mult2T: 0, overdriveT: 0,
  sector: 0, sectorName: '', kills: 0, powerups: 0, runTime: 0, bonusXp: 0,
  objectives: [], tutorial: false
};

const ctx = {};
let frameEMA = 16, drsTimer = 0, drsScale = 1, basePr = 2;
let radarT = 0;
let ghostShip = null;
const tut = { on: false, step: -1, boostTime: 0, rolled: false, spawnT: 0, doneT: 0 };
const TUT_TOTAL = 6;
const TUT_STEPS = [
  {
    id: 'move',
    text: 'Welcome, pilot! STEER with your mouse. On phone, drag your finger. Grab 5 blue crystals!',
    keys: 'MOUSE / DRAG'
  },
  {
    id: 'boost',
    text: 'Nice flying! Now speed up: HOLD LEFT CLICK. Phone: hold BOOST. Gamepad: hold RT.',
    keys: 'HOLD LMB / BOOST / RT'
  },
  {
    id: 'shoot',
    text: 'See the grey rocks? Just AIM at them — your ship fires by itself. Destroy 3!',
    keys: 'AIM WITH MOUSE'
  },
  {
    id: 'roll',
    text: 'Time to dodge like a pro! Do a BARREL ROLL: press SPACE. Phone: tap ROLL. Gamepad: X.',
    keys: 'SPACE / ROLL / X'
  },
  {
    id: 'gate',
    text: 'See the big green RING? Fly through the middle of it for big points!',
    keys: 'FLY THROUGH'
  },
  {
    id: 'done',
    text: 'PERFECT! You know everything now. Grab crystals, shoot rocks, dodge red things. Good luck out there, pilot!',
    keys: ''
  }
];

function init() {
  const splashMsg = document.querySelector('#splash .msg');
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: 'high-performance' });
  } catch (e) {
    if (splashMsg) splashMsg.textContent = 'WEBGL NOT SUPPORTED ON THIS DEVICE.';
    return;
  }
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 12000);
  camera.position.set(0, 4.5, 14);
  clock = new THREE.Clock();

  ctx.renderer = renderer;
  ctx.scene = scene;
  ctx.camera = camera;
  ctx.state = state;

  const save = loadSave();
  ctx.save = save;
  ctx.audio = new AudioSys(save.settings.sound);

  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  document.getElementById('app').prepend(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    if (mode === 'play') pauseGame();
    ctx.ui.toast('GPU CONTEXT INTERRUPTED — RUN PAUSED');
  });

  scene.add(new THREE.HemisphereLight(0x8899ff, 0x0b0e1a, 0.55));
  const dir = new THREE.DirectionalLight(0xfff4e0, 1.5);
  dir.position.set(60, 80, 40);
  scene.add(dir);

  buildComposer();

  ctx.fx = {
    stars: new Stars(scene, isTouch ? 1400 : 2600),
    dust: new Dust(scene, isTouch ? 260 : 480),
    neb: new Nebula(scene),
    expl: new Explosions(scene, 10),
    shocks: new Shocks(scene, 8),
    debris: new Debris(scene, 16),
    flash: new Flash(scene, 3)
  };

  ctx.ship = new Ship(scene);
  const eq = skinById(save.equipped);
  ctx.ship.setSkin(eq);
  ctx.fx.trails = new Trails(scene, ctx.ship, eq.glow);

  ctx.world = new World(ctx);
  ctx.ui = new UI(ctx);
  bindCallbacks();
  bindActions();
  bindInput();
  reflectSettings();
  applyQuality(save.settings.quality === 'auto' ? qualityClass() : save.settings.quality);
  if (isTouch) document.body.classList.add('touch');
  document.body.classList.toggle('lefty', save.settings.lefty);

  for (let i = 0; i < 24; i++) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.22, 3.4),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.6, 3.2), toneMapped: false })
    );
    mesh.visible = false;
    scene.add(mesh);
    const b = { mesh, pos: mesh.position, dir: new THREE.Vector3(0, 0, -1), life: 0, alive: false, dmg: 1 };
    boltPool.push(b);
  }

  addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'play') pauseGame();
  });

  toMenu();
  ctx.ui.hideSplash();
  window.__vr = true;
  renderer.setAnimationLoop(loop);
}

function qualityClass() {
  if (ctx.save && ctx.save.settings.quality !== 'auto') return ctx.save.settings.quality;
  return isTouch ? 'medium' : 'high';
}

function buildComposer(samples) {
  const pr = renderer.getPixelRatio();
  const rt = new THREE.WebGLRenderTarget(innerWidth * pr, innerHeight * pr, {
    type: THREE.HalfFloatType,
    samples: samples !== undefined ? samples : (isTouch ? 0 : 4)
  });
  composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.85, 0.55, 0.62);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
}

function basePixelRatio(q) {
  if (q === 'low') return 1;
  if (q === 'medium') return Math.min(devicePixelRatio, 1.5);
  return Math.min(devicePixelRatio, 2);
}

function applyPixelRatio() {
  const pr = basePr * drsScale;
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight);
  composer.setPixelRatio(pr);
  composer.setSize(innerWidth, innerHeight);
}

function applyQuality(q) {
  basePr = basePixelRatio(q);
  drsScale = 1;
  applyPixelRatio();
  bloomPass.enabled = q !== 'low';
  bloomPass.strength = q === 'high' ? 0.85 : 0.65;
}

function updateDRS(rawDt) {
  frameEMA += (rawDt * 1000 - frameEMA) * 0.04;
  drsTimer += rawDt;
  if (drsTimer < 2) return;
  drsTimer = 0;
  if (ctx.save.settings.quality !== 'auto') return;
  let changed = false;
  if (frameEMA > 21 && drsScale > 0.6) { drsScale = Math.max(0.6, drsScale * 0.85); changed = true; }
  else if (frameEMA < 13 && drsScale < 1) { drsScale = Math.min(1, drsScale * 1.1); changed = true; }
  if (changed) applyPixelRatio();
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  applyPixelRatio();
}

function bindCallbacks() {
  ctx.cb = {
    onCrystal: e => {
      state.combo++;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      state.mult = multOf();
      state.crystals++;
      state.score += 150 * state.mult * (state.mult2T > 0 ? 2 : 1);
      tmpV1.set(e.x, e.y, e.z);
      ctx.ui.popup('+' + Math.floor(150 * state.mult * (state.mult2T > 0 ? 2 : 1)), 'cyan', tmpV1);
      ctx.fx.expl.spawn(tmpV1, 0x46e8ff, 0.5);
      ctx.audio.pickup(state.combo);
    },
    onGate: e => {
      state.combo += 2;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      state.mult = multOf();
      state.gates++;
      state.score += 350 * state.mult * (state.mult2T > 0 ? 2 : 1);
      state.energy = Math.min(100, state.energy + 16);
      ctx.ui.popup('GATE +' + Math.floor(350 * state.mult), 'gold', e.mesh.position);
      ctx.fx.shocks.spawn(e.mesh.position, 0x57ff9a, 34);
      ctx.audio.gate();
    },
    onNearMiss: (pos, type) => {
      state.nearMisses++;
      state.combo++;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      state.mult = multOf();
      const val = Math.floor((type === 'comet' ? 150 : 75) * state.mult);
      state.score += val;
      ctx.ui.popup('NEAR MISS +' + val, 'white', pos);
      if (type === 'bh') ctx.ui.toast('CLOSE ONE — THAT WAS A BLACK HOLE');
    },
    onHitPlanet: n => {
      ctx.ship.vel.addScaledVector(n, 58);
      damage(38, 'PLANET IMPACT');
      state.invuln = Math.max(state.invuln, 1.2);
      state.trauma = Math.min(1, state.trauma + 0.7);
      ctx.fx.expl.spawn(ctx.ship.group.position, 0xffa050, 1.1);
      ctx.fx.shocks.spawn(ctx.ship.group.position, 0xffb060, 22);
    },
    onDestroy: (e, cause) => {
      tmpV1.set(e.x, e.y, e.z);
      const power = Math.min(1.6, 0.5 + e.s * 0.18);
      ctx.fx.expl.spawn(tmpV1, 0xffb060, power * 0.8);
      ctx.fx.debris.spawn(tmpV1, Math.min(7, 3 + (e.s | 0)), power);
      ctx.fx.flash.trigger(tmpV1, 0xffc890, power * 0.5);
      ctx.fx.shocks.spawn(tmpV1, 0xffd0a0, e.s * 4);
      ctx.audio.blip(110 + e.s * 22, 0.12, 'sawtooth', 0.16);
      if (cause === 'bolt') {
        state.kills++;
        const val = Math.floor(30 * state.mult * (state.mult2T > 0 ? 2 : 1));
        state.score += val;
        ctx.ui.popup('+' + val, 'orange', tmpV1);
        ctx.world.spawnDrop(tmpV1);
      } else {
        tmpV2.set(ctx.ship.group.position).sub(tmpV1).normalize();
        ctx.ship.vel.addScaledVector(tmpV2, 42);
        damage(14 + e.s * 3.5, 'ASTEROID IMPACT');
        state.invuln = Math.max(state.invuln, 1.0);
        state.trauma = Math.min(1, state.trauma + 0.55);
      }
    },
    onBoltHit: e => {
      if (e.kind === 'comet') ctx.fx.flash.trigger(e.mesh.position, 0x9fe8ff, 0.3);
      else ctx.fx.flash.trigger(tmpV1.set(e.x, e.y, e.z), 0x9fe8ff, 0.3);
      ctx.audio.blip(320, 0.05, 'square', 0.1);
    },
    onHitComet: e => {
      ctx.fx.expl.spawn(e.mesh.position, 0xaef1ff, 1.2);
      ctx.fx.shocks.spawn(e.mesh.position, 0xcfeaff, 26);
      ctx.fx.flash.trigger(e.mesh.position, 0xbfe8ff, 0.8);
      tmpV2.set(ctx.ship.group.position).sub(e.mesh.position).normalize();
      ctx.ship.vel.addScaledVector(tmpV2, 50);
      damage(30, 'COMET STRIKE');
      state.trauma = Math.min(1, state.trauma + 0.6);
    },
    onCometKilled: e => {
      state.kills++;
      state.score += 120 * state.mult;
      ctx.ui.popup('+' + Math.floor(120 * state.mult), 'cyan', e.mesh.position);
      ctx.fx.expl.spawn(e.mesh.position, 0xaef1ff, 1.1);
      ctx.fx.debris.spawn(e.mesh.position, 5, 1);
      ctx.world.spawnDrop(e.mesh.position);
    },
    onPowerup: (kind, pos) => {
      state.powerups++;
      ctx.audio.powerup();
      ctx.fx.shocks.spawn(pos, kind === 'shield' ? 0x4ab8ff : kind === 'repair' ? 0x57ff9a : kind === 'surge' ? 0xffd76b : 0xc07aff, 24);
      if (kind === 'shield') { state.shield = Math.min(2, state.shield + 1); ctx.ui.popup('SHIELD +1', 'cyan', pos); }
      else if (kind === 'repair') { state.hull = Math.min(state.maxHull, state.hull + 35); ctx.ui.popup('HULL +35', 'green', pos); }
      else if (kind === 'surge') { state.energy = 100; state.overdriveT = 8; ctx.ui.popup('OVERDRIVE', 'gold', pos); }
      else { state.mult2T = 12; ctx.ui.popup('SCORE x2', 'purple', pos); }
    },
    onBHDeath: pos => startConsumption(pos),
    onEscape: () => {
      state.escapes++;
      state.score += 400 * state.mult;
      ctx.ui.popup('WELL ESCAPED +' + Math.floor(400 * state.mult), 'gold', ctx.ship.group.position);
      ctx.ui.toast('GRAVITY WELL ESCAPED');
      checkLiveAchievements();
    },
    onTankDestroyed: e => {
      const p = e.mesh.position;
      state.kills++;
      const val = Math.floor(60 * state.mult);
      state.score += val;
      ctx.ui.popup('+' + val + ' FUEL TANK', 'orange', p);
      ctx.fx.expl.spawn(p, 0xffa050, 1.7);
      ctx.fx.shocks.spawn(p, 0xffc090, 34);
      ctx.fx.debris.spawn(p, 7, 1.3);
      ctx.fx.flash.trigger(p, 0xffc890, 1.2);
      ctx.audio.explosion(false);
      ctx.world.spawnDrop(p);
      ctx.world.spawnCrystal(p.x + 3, p.y + 2, p.z);
      if (!state.tutorial) state.trauma = Math.min(0.5, state.trauma + 0.25);
    },
    onTankCrash: e => {
      const p = e.mesh.position;
      ctx.fx.expl.spawn(p, 0xffa050, 1.5);
      ctx.fx.shocks.spawn(p, 0xffc090, 30);
      ctx.fx.flash.trigger(p, 0xffc890, 1.1);
      ctx.audio.explosion(false);
      tmpV2.set(ctx.ship.group.position).sub(p).normalize();
      ctx.ship.vel.addScaledVector(tmpV2, 46);
      state.trauma = Math.min(1, state.trauma + 0.55);
      damage(25, 'FUEL TANK EXPLOSION');
      state.invuln = Math.max(state.invuln, 1.0);
    },
    onSatKilled: e => {
      state.kills++;
      const val = Math.floor(50 * state.mult);
      state.score += val;
      ctx.ui.popup('+' + val + ' SATELLITE', 'white', e.mesh.position);
      ctx.fx.expl.spawn(e.mesh.position, 0xbfd4ff, 1.0);
      ctx.fx.debris.spawn(e.mesh.position, 6, 1);
      ctx.audio.blip(150, 0.14, 'sawtooth', 0.16);
      ctx.world.spawnDrop(e.mesh.position);
    },
    onSatCrash: e => {
      ctx.fx.expl.spawn(e.mesh.position, 0xbfd4ff, 1.1);
      ctx.audio.explosion(false);
      damage(20, 'SATELLITE COLLISION');
      state.invuln = Math.max(state.invuln, 1.0);
    },
    onMineDetonate: pos => {
      ctx.fx.expl.spawn(pos, 0xff6a5a, 1.4);
      ctx.fx.shocks.spawn(pos, 0xff8a7a, 30);
      ctx.fx.flash.trigger(pos, 0xffa090, 1.0);
      ctx.audio.explosion(false);
      state.trauma = Math.min(1, state.trauma + 0.5);
      damage(20, 'MINE DETONATION');
      state.invuln = Math.max(state.invuln, 0.9);
    },
    onMineShot: pos => {
      ctx.fx.expl.spawn(pos, 0xff6a5a, 0.9);
      ctx.fx.shocks.spawn(pos, 0xff8a7a, 22);
      state.score += 40;
      ctx.ui.popup('+40 MINE CLEARED', 'orange', pos);
      ctx.audio.blip(180, 0.1, 'square', 0.14);
    },
    onArtifactScanned: pos => {
      state.score += 250;
      ctx.ui.popup('ARTIFACT +250', 'purple', pos);
      ctx.ui.toast('ALIEN ARTIFACT SCANNED');
      ctx.fx.shocks.spawn(pos, 0xc07aff, 26);
      ctx.audio.objective();
    }
  };
}

function multOf() {
  return 1 + Math.min(4, state.combo * 0.12);
}

function damage(amount, label) {
  if (state.invuln > 0 || mode !== 'play') return;
  if (state.tutorial) {
    ctx.fx.shocks.spawn(ctx.ship.group.position, 0xffc090, 16);
    return;
  }
  if (state.shield > 0) {
    state.shield--;
    state.invuln = Math.max(state.invuln, 0.9);
    ctx.ui.damageFlash();
    ctx.audio.blip(520, 0.2, 'sine', 0.2);
    ctx.fx.shocks.spawn(ctx.ship.group.position, 0x4ab8ff, 20);
    ctx.ui.popup('SHIELD ABSORB', 'cyan', ctx.ship.group.position);
    return;
  }
  state.hull -= amount;
  state.damageTaken += amount;
  state.calm = 0;
  state.combo = 0;
  state.mult = multOf();
  ctx.ui.damageFlash();
  ctx.audio.explosion(false);
  ctx.ui.popup('-' + amount + ' HULL', 'red', ctx.ship.group.position);
  if (label) ctx.ui.banner(label);
  if (state.hull <= 0) {
    state.hull = 0;
    die('HULL INTEGRITY LOST');
  }
}

function startConsumption(pos) {
  if (mode !== 'play' || state.consuming) return;
  state.consuming = true;
  consume = { target: pos.clone(), t: 0 };
  state.trauma = 1;
  ctx.audio.alarm(false);
}

function die(causeText) {
  if (mode === 'over' || state.consuming) return;
  mode = 'over';
  const thisRun = runSeq;
  deathPos.copy(ctx.ship.group.position);
  ctx.ship.setVisible(false);
  ctx.fx.trails.clear();
  ctx.fx.trails.setVisible(false);
  if (ghostShip) ghostShip.setVisible(false);
  ctx.fx.expl.spawn(deathPos, 0xffc27d, 1.8);
  ctx.fx.shocks.spawn(deathPos, 0xffd9a0, 46);
  ctx.fx.debris.spawn(deathPos, 8, 1.6);
  ctx.fx.flash.trigger(deathPos, 0xffe0b0, 1.6);
  state.trauma = 1;
  state.slowT = 0.9;
  state.timeScale = 0.25;
  ctx.ui.setDanger(false);
  ctx.ui.setLock(false);
  ctx.audio.alarm(false);
  ctx.audio.engineOff();
  ctx.audio.explosion(true);
  document.body.classList.remove('playing', 'critical');
  setTouchControls(false);
  if (document.pointerLockElement) document.exitPointerLock();

  setTimeout(() => {
    if (mode === 'over' && runSeq === thisRun) finalizeRun(causeText);
  }, 1400);
}

function finalizeRun(causeText) {
  const save = ctx.save;
  const prevLevel = levelInfo(save.xp).level;
  const score = Math.floor(state.score);
  const xpGained = Math.floor(score / 60) + state.crystals * 2 + state.gates * 6 + state.nearMisses + state.bonusXp;
  const prevXp = save.xp;
  save.xp += xpGained;

  const newBest = score > save.best;
  if (newBest) save.best = score;
  save.bestDist = Math.max(save.bestDist, Math.floor(state.dist));
  save.bestCrystals = Math.max(save.bestCrystals, state.crystals);
  if (state.damageTaken === 0) save.flawless = Math.max(save.flawless, score);
  if (state.objectives.length && state.objectives.every(o => o.done)) save.perfectObjectives++;

  save.stats.runs++;
  save.stats.crystals += state.crystals;
  save.stats.gates += state.gates;
  save.stats.dist += Math.floor(state.dist);
  save.stats.nearMisses += state.nearMisses;
  save.stats.escapes += state.escapes;
  save.stats.kills += state.kills;
  save.stats.powerups += state.powerups;
  save.stats.playtime += Math.floor(state.runTime);

  const d = new Date();
  const dateStr = d.getMonth() + 1 + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  save.runs.push({ score, dist: Math.floor(state.dist), date: dateStr });
  save.runs.sort((a, b) => b.score - a.score);
  save.runs = save.runs.slice(0, 10);

  if (newBest && state.ghostRec && state.ghostRec.length > 4) {
    save.ghost = { step: 10, pts: state.ghostRec.map(v => Math.round(v * 10) / 10) };
  }

  const unlockedAch = evalAchievements();
  const newLevel = levelInfo(save.xp).level;
  const unlocks = SKINS.filter(s => s.req > prevLevel && s.req <= newLevel);
  persistSave(save);

  ctx.audio.blip(newBest ? 880 : 520, 0.3, 'triangle', 0.2);
  if (newLevel > prevLevel) setTimeout(() => ctx.ui.toast('LEVEL UP — WELCOME TO LEVEL ' + newLevel), 900);
  unlockedAch.forEach((a, i) => setTimeout(() => ctx.ui.toast('ACHIEVEMENT — ' + a.name), 1400 + i * 700));

  ctx.ui.showOver({
    cause: causeText,
    score, best: save.best, newBest,
    dist: state.dist, crystals: state.crystals, gates: state.gates,
    nearMisses: state.nearMisses, maxCombo: state.maxCombo, escapes: state.escapes,
    kills: state.kills, objectives: state.objectives,
    xpGained, prevXp, save, unlocks
  });
}

function evalAchievements() {
  const save = ctx.save;
  const got = [];
  for (const a of ACH) {
    if (!save.ach[a.id] && a.test(save)) {
      save.ach[a.id] = true;
      got.push(a);
    }
  }
  return got;
}

function checkLiveAchievements() {
  const save = ctx.save;
  for (const a of ACH) {
    if (!save.ach[a.id] && a.test(save)) {
      save.ach[a.id] = true;
      ctx.ui.toast('ACHIEVEMENT — ' + a.name);
      ctx.audio.blip(1040, 0.25, 'triangle', 0.2);
      persistSave(save);
    }
  }
}

function pickObjectives() {
  const pool = [
    { id: 'cry25', label: 'Collect 25 crystals', test: () => state.crystals >= 25 },
    { id: 'gate4', label: 'Clear 4 gates', test: () => state.gates >= 4 },
    { id: 'kill15', label: 'Destroy 15 asteroids', test: () => state.kills >= 15 },
    { id: 'near6', label: 'Score 6 near misses', test: () => state.nearMisses >= 6 },
    { id: 'dist4k', label: 'Fly 4.0 km', test: () => state.dist >= 4000 },
    { id: 'flaw4k', label: 'Reach 4 km undamaged', test: () => state.dist >= 4000 && state.damageTaken === 0 },
    { id: 'score15k', label: 'Score 15,000 points', test: () => state.score >= 15000 },
    { id: 'escape', label: 'Escape a gravity well', test: () => state.escapes >= 1 }
  ];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
  }
  return pool.slice(0, 3).map(o => ({ id: o.id, label: o.label, test: o.test, done: false }));
}

function checkObjectives() {
  for (const o of state.objectives) {
    if (!o.done && o.test()) {
      o.done = true;
      state.bonusXp += 400;
      ctx.ui.toast('OBJECTIVE COMPLETE — ' + o.label.toUpperCase() + ' (+400 XP)');
      ctx.audio.objective();
    }
  }
}

function tutorialStart() {
  state.tutorial = true;
  tut.on = true;
  tut.step = 0;
  tut.boostTime = 0;
  tut.rolled = false;
  tut.spawnT = 0;
  tut.doneT = 0;
  startRun();
  ctx.world.tutorialKinds = ['cry', 'ast', 'gate'];
  showTutCard();
  ctx.ui.toast('TRAINING STARTED — FOLLOW THE CARDS');
}

function showTutCard() {
  const s = TUT_STEPS[tut.step];
  ctx.ui.tutorialCard(s.text, s.keys, tut.step, TUT_TOTAL);
}

function tutorialUpdate(dt) {
  if (!tut.on || mode !== 'play') return;
  const step = TUT_STEPS[tut.step];
  if (!step) return;
  const shipPos = ctx.ship.group.position;
  tut.spawnT -= dt;

  if (step.id === 'move') {
    if (tut.spawnT <= 0) {
      tut.spawnT = 1.4;
      let alive = 0;
      for (const c of ctx.world.crys) if (c.alive) alive++;
      if (alive < 6) {
        for (let i = 0; i < 4; i++) {
          const x = THREE.MathUtils.clamp(shipPos.x + (Math.random() - 0.5) * 90, -120, 120);
          const y = THREE.MathUtils.clamp(shipPos.y + (Math.random() - 0.5) * 60, -75, 75);
          ctx.world.spawnCrystal(x, y, -780 - i * 45);
        }
      }
    }
    if (state.crystals >= 5) tutorialAdvance();
  } else if (step.id === 'boost') {
    if (state.boostEff) tut.boostTime += dt;
    if (tut.boostTime >= 1.5) tutorialAdvance();
  } else if (step.id === 'shoot') {
    if (tut.spawnT <= 0) {
      tut.spawnT = 1.5;
      let alive = 0;
      for (const a of ctx.world.asts) if (a.alive) alive++;
      if (alive < 2) {
        ctx.world.spawnAsteroid(
          THREE.MathUtils.clamp(shipPos.x + (Math.random() - 0.5) * 100, -110, 110),
          THREE.MathUtils.clamp(shipPos.y + (Math.random() - 0.5) * 70, -70, 70),
          -750, 2.6 + Math.random() * 1.6, 0, 0, 0.4
        );
      }
    }
    if (state.kills >= 3) tutorialAdvance();
  } else if (step.id === 'roll') {
    if (tut.rolled) tutorialAdvance();
  } else if (step.id === 'gate') {
    if (tut.spawnT <= 0) {
      tut.spawnT = 2.4;
      let alive = 0;
      for (const g of ctx.world.gates) if (g.alive) alive++;
      if (alive === 0) ctx.world.spawnGateAt(shipPos.x, shipPos.y, -820);
    }
    if (state.gates >= 1) tutorialAdvance();
  } else if (step.id === 'done') {
    tut.doneT += dt;
    if (tut.doneT >= 3.5) tutorialFinish(false);
  }
}

function tutorialAdvance() {
  ctx.audio.objective();
  tut.step++;
  if (tut.step >= TUT_TOTAL) { tutorialFinish(false); return; }
  showTutCard();
}

function tutorialFinish(skipped) {
  tut.on = false;
  state.tutorial = false;
  ctx.world.tutorialKinds = null;
  ctx.ui.tutorialHide();
  if (!ctx.save.tutorialDone) {
    ctx.save.tutorialDone = true;
    state.bonusXp += 500;
    persistSave(ctx.save);
  }
  if (!skipped) {
    ctx.ui.toast('TRAINING COMPLETE — +500 XP');
    ctx.audio.gate();
  } else {
    ctx.ui.toast('TRAINING SKIPPED');
  }
}

function resetRunStats() {
  const lvl = levelInfo(ctx.save.xp).level;
  Object.assign(state, {
    speed: 0, dist: 0, score: 0, combo: 0, mult: 1, crystals: 0, gates: 0,
    nearMisses: 0, maxCombo: 0, escapes: 0, energy: 100,
    rollT: 0, rollCd: 0, invuln: 0, calm: 0, edgeT: 0,
    trauma: 0, timeScale: 1, slowT: 0, bhDanger: null, damageTaken: 0, consuming: false,
    heat: 0, overheat: 0, fireCd: 0, targetLock: false,
    shield: 0, mult2T: 0, overdriveT: 0,
    sector: 0, kills: 0, powerups: 0, runTime: 0, bonusXp: 0
  });
  state.maxHull = 100 + Math.min(60, (lvl - 1) * 5);
  state.hull = state.maxHull;
  state.sectorName = 'SECTOR 1 — ' + SECTOR_NAMES[0];
  state.objectives = pickObjectives();
  state.ghostRec = [];
  state.steer.tx = state.steer.ty = 0;
  state.steer.x = state.steer.y = 0;
  input.tx = input.ty = 0;
  input.stickX = 0; input.stickY = 0;
  consume = null;
  for (const b of boltPool) { b.alive = false; b.mesh.visible = false; }
  if (ghostShip) ghostShip.setVisible(false);
  ctx.fx.neb.setPalette(NEBULA_PALETTES[0]);
  ctx.ui.setDanger(false);
  ctx.ui.setLock(false);
  ctx.ui.lastChipStr = '';
}

function toMenu() {
  mode = 'attract';
  ctx.view = 'chase';
  ctx.world.reset();
  ctx.world.tutorialKinds = null;
  tut.on = false;
  state.tutorial = false;
  ctx.ui.tutorialHide();
  ctx.ship.reset();
  ctx.fx.trails.clear();
  ctx.fx.trails.setVisible(true);
  ctx.ui.setDanger(false);
  ctx.ui.setLock(false);
  ctx.audio.alarm(false);
  ctx.audio.engineOff();
  ctx.ui.showHud(false);
  ctx.ui.layer('menu-main');
  ctx.ui.refreshMenu(ctx.save);
  const playBtn = document.getElementById('btn-play');
  if (playBtn) playBtn.textContent = ctx.save.tutorialDone ? 'LAUNCH MISSION' : 'START TRAINING';
  document.body.classList.remove('playing', 'critical', 'danger');
  setTouchControls(false);
  if (ghostShip) ghostShip.setVisible(false);
}

function openHangar() {
  mode = 'attract';
  ctx.view = 'orbit';
  ctx.world.reset();
  ctx.ui.renderHangar(ctx.save, actEquip, actPreview);
  ctx.ui.layer('menu-hangar');
}

function openProfile() {
  ctx.ui.renderProfile(ctx.save);
  ctx.ui.layer('menu-profile');
}

function actEquip(s) {
  ctx.save.equipped = s.id;
  persistSave(ctx.save);
  ctx.ship.setSkin(s);
  ctx.fx.trails.setGlow(s.glow);
  ctx.ui.renderHangar(ctx.save, actEquip, actPreview);
  ctx.ui.toast(s.name.toUpperCase() + ' EQUIPPED');
  ctx.audio.click();
}

function actPreview(s) {
  ctx.ship.setSkin(s || skinById(ctx.save.equipped));
}

function startRun() {
  runSeq++;
  resetRunStats();
  ctx.world.reset();
  ctx.ship.reset();
  ctx.ship.inner.scale.setScalar(1);
  ctx.fx.trails.clear();
  ctx.fx.trails.setVisible(true);
  ctx.view = 'chase';
  mode = 'count';
  cd = 3.999;
  cdLast = 99;
  input.mx = 0; input.my = 0;
  ctx.ui.layer('none');
  ctx.ui.showHud(true);
  document.body.classList.add('playing');
  setTouchControls(true);
  ctx.audio.init();
  ctx.audio.engineOn();
  camera.position.set(0, 4.5, 14);
  if (!state.tutorial) {
    const padHint = gp.on ? ' · STICK steer · RT boost · X roll' : '';
    const hint = isTouch
      ? 'DRAG anywhere to steer · hold BOOST · tap ROLL'
      : 'MOVE MOUSE to steer · HOLD LMB boost · RMB brake · SPACE roll · guns aim with you' + padHint;
    ctx.ui.hintBar(hint, 16);
  }
}

function pauseGame() {
  if (mode !== 'play' && mode !== 'count') return;
  prevPauseMode = mode;
  mode = 'pause';
  ctx.ui.renderObjectives(document.getElementById('pause-objectives'), state.objectives);
  ctx.ui.layer('pause-overlay');
  ctx.audio.alarm(false);
  ctx.ui.setDanger(false);
}

function resumeGame() {
  if (mode !== 'pause') return;
  mode = prevPauseMode;
  ctx.ui.layer('none');
  ctx.audio.engineOn();
}

function quitToMenu() {
  ctx.audio.alarm(false);
  ctx.ui.setDanger(false);
  if (document.pointerLockElement) document.exitPointerLock();
  toMenu();
}

const actions = {
  play: () => { ctx.audio.init(); ctx.audio.click(); if (ctx.save.tutorialDone) startRun(); else tutorialStart(); },
  training: () => { ctx.audio.init(); ctx.audio.click(); tutorialStart(); },
  hangar: () => { ctx.audio.click(); openHangar(); },
  profile: () => { ctx.audio.click(); openProfile(); },
  ach: () => { ctx.audio.click(); ctx.ui.renderAch(ctx.save); ctx.ui.layer('menu-ach'); },
  help: () => { ctx.audio.click(); ctx.ui.layer('menu-help'); },
  settings: () => { ctx.audio.click(); ctx.ui.layer('menu-settings'); },
  back: () => {
    ctx.audio.click();
    actPreview(null);
    if (panelReturn === 'pause') { ctx.ui.layer('pause-overlay'); }
    else { ctx.ui.refreshMenu(ctx.save); ctx.ui.layer('menu-main'); }
  },
  resume: () => { ctx.audio.click(); resumeGame(); },
  restart: () => { ctx.audio.click(); startRun(); },
  quit: () => { ctx.audio.click(); quitToMenu(); },
  overRestart: () => { ctx.audio.click(); if (ctx.save.tutorialDone) startRun(); else tutorialStart(); },
  overHangar: () => { ctx.audio.click(); openHangar(); },
  overMenu: () => { ctx.audio.click(); quitToMenu(); },
  fullscreen: () => {
    try {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    } catch (e) {}
  },
  muteToggle: () => {
    ctx.save.settings.sound = !ctx.save.settings.sound;
    persistSave(ctx.save);
    ctx.audio.setEnabled(ctx.save.settings.sound);
    reflectSettings();
  },
  equipSkin: actEquip,
  previewSkin: actPreview
};

function bindActions() {
  ctx.actions = actions;
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
  on('btn-play', actions.play);
  on('btn-training', actions.training);
  on('btn-hangar', actions.hangar);
  on('btn-profile', actions.profile);
  on('btn-ach', actions.ach);
  on('btn-help', actions.help);
  on('btn-settings', actions.settings);
  on('btn-full', actions.fullscreen);
  on('btn-full-menu', actions.fullscreen);
  on('hangar-back', actions.back);
  on('ach-back', actions.back);
  on('profile-back', actions.back);
  on('help-back', actions.back);
  on('settings-back', actions.back);
  on('btn-resume', actions.resume);
  on('btn-restart', actions.restart);
  on('btn-pause-settings', () => { panelReturn = 'pause'; actions.settings(); });
  on('btn-pause-help', () => { panelReturn = 'pause'; actions.help(); });
  on('btn-quit', actions.quit);
  on('over-retry', actions.overRestart);
  on('over-hangar', actions.overHangar);
  on('over-menu', actions.overMenu);
  on('btn-pause', pauseToggleBtn);
  on('btn-mute', actions.muteToggle);
  on('tut-skip', () => { ctx.audio.click(); tutorialFinish(true); });

  const hold = (id, setter) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); setter(true); });
    const up = () => setter(false);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };
  hold('btn-boost', v => { state.boost = v; });
  hold('btn-brake', v => { state.brake = v; });
  on('btn-roll', () => doRoll());

  const $s = id => document.getElementById(id);
  $s('set-sound').addEventListener('change', e => {
    ctx.save.settings.sound = e.target.checked;
    persistSave(ctx.save);
    ctx.audio.setEnabled(e.target.checked);
    reflectSettings();
  });
  $s('set-quality').addEventListener('change', e => {
    ctx.save.settings.quality = e.target.value;
    persistSave(ctx.save);
    applyQuality(e.target.value === 'auto' ? qualityClass() : e.target.value);
  });
  $s('set-sens').addEventListener('input', e => {
    ctx.save.settings.sens = parseFloat(e.target.value);
    persistSave(ctx.save);
    const sv = document.getElementById('sens-val');
    if (sv) sv.textContent = parseFloat(e.target.value).toFixed(1);
  });
  $s('set-invert').addEventListener('change', e => {
    ctx.save.settings.invertY = e.target.checked;
    persistSave(ctx.save);
  });
  $s('set-invertx').addEventListener('change', e => {
    ctx.save.settings.invertX = e.target.checked;
    persistSave(ctx.save);
  });
  $s('set-shake').addEventListener('input', e => {
    ctx.save.settings.shake = parseFloat(e.target.value);
    persistSave(ctx.save);
    const sv = document.getElementById('shake-val');
    if (sv) sv.textContent = Math.round(parseFloat(e.target.value) * 100) + '%';
  });
  $s('set-autofire').addEventListener('change', e => {
    ctx.save.settings.autofire = e.target.checked;
    persistSave(ctx.save);
  });
  $s('set-lefty').addEventListener('change', e => {
    ctx.save.settings.lefty = e.target.checked;
    persistSave(ctx.save);
    document.body.classList.toggle('lefty', e.target.checked);
  });
  $s('set-ghost').addEventListener('change', e => {
    ctx.save.settings.ghost = e.target.checked;
    persistSave(ctx.save);
    if (!e.target.checked && ghostShip) ghostShip.setVisible(false);
  });
  for (const r of document.querySelectorAll('input[name="ctlmode"]')) {
    r.addEventListener('change', e => {
      if (!e.target.checked) return;
      ctx.save.settings.controlMode = e.target.value;
      persistSave(ctx.save);
      if (e.target.value !== 'lock' && document.pointerLockElement) document.exitPointerLock();
    });
  }
}

function reflectSettings() {
  const s = ctx.save.settings;
  const set = (id, prop) => { const el = document.getElementById(id); if (el) el.checked = prop; };
  set('set-sound', s.sound);
  set('set-invert', s.invertY);
  set('set-invertx', s.invertX);
  set('set-autofire', s.autofire);
  set('set-lefty', s.lefty);
  set('set-ghost', s.ghost);
  const qual = document.getElementById('set-quality');
  if (qual) qual.value = s.quality;
  const sens = document.getElementById('set-sens');
  if (sens) sens.value = s.sens;
  const sensVal = document.getElementById('sens-val');
  if (sensVal) sensVal.textContent = parseFloat(s.sens).toFixed(1);
  const shake = document.getElementById('set-shake');
  if (shake) shake.value = s.shake;
  const shakeVal = document.getElementById('shake-val');
  if (shakeVal) shakeVal.textContent = Math.round(s.shake * 100) + '%';
  for (const r of document.querySelectorAll('input[name="ctlmode"]')) r.checked = r.value === s.controlMode;
  const muteBtn = document.getElementById('btn-mute');
  if (muteBtn) muteBtn.textContent = s.sound ? 'AUDIO ON' : 'AUDIO OFF';
}

function pauseToggleBtn() {
  if (mode === 'play' || mode === 'count') pauseGame();
  else if (mode === 'pause') resumeGame();
}

function bindInput() {
  const reticle = document.getElementById('reticle');

  addEventListener('mousemove', e => {
    if (input.locked) {
      input.stickX = THREE.MathUtils.clamp(input.stickX + e.movementX * 0.0045, -1, 1);
      input.stickY = THREE.MathUtils.clamp(input.stickY + e.movementY * 0.0045, -1, 1);
      if (reticle) reticle.style.transform = 'translate(' + (innerWidth / 2) + 'px,' + (innerHeight / 2) + 'px)';
      return;
    }
    input.mx = (e.clientX / innerWidth) * 2 - 1;
    input.my = (e.clientY / innerHeight) * 2 - 1;
    const cm = ctx.save ? ctx.save.settings.controlMode : 'aim';
    if (cm === 'stick' && !isTouch) {
      input.stickX = THREE.MathUtils.clamp(input.stickX + (e.movementX || 0) * 0.008, -1, 1);
      input.stickY = THREE.MathUtils.clamp(input.stickY + (e.movementY || 0) * 0.008, -1, 1);
      return;
    }
    if (reticle) reticle.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)';
  });

  const cv = renderer.domElement;
  cv.addEventListener('pointerdown', e => {
    ctx.audio.init();
    if (e.pointerType === 'touch') {
      if (input.touchId === null) {
        input.touchId = e.pointerId;
        input.sx0 = e.clientX;
        input.sy0 = e.clientY;
        input.tx = 0; input.ty = 0;
      }
      return;
    }
    e.preventDefault();
    const cm = ctx.save.settings.controlMode;
    if (cm === 'lock' && mode === 'play' && !input.locked) {
      cv.requestPointerLock();
      return;
    }
    if (mode !== 'play') return;
    if (e.button === 0) state.boost = true;
    else if (e.button === 2) state.brake = true;
    else if (e.button === 1) doRoll();
  });

  addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' && e.pointerId === input.touchId) {
      input.tx = THREE.MathUtils.clamp((e.clientX - input.sx0) / 105, -1, 1);
      input.ty = THREE.MathUtils.clamp((e.clientY - input.sy0) / 105, -1, 1);
    }
  });

  const clearPointer = e => {
    if (e.pointerType === 'touch' && e.pointerId === input.touchId) {
      input.touchId = null;
      input.tx = 0; input.ty = 0;
    } else if (e.pointerType !== 'touch') {
      if (e.button === 0 || e.button === undefined) state.boost = false;
      if (e.button === 2 || e.button === undefined) state.brake = false;
    }
  };
  addEventListener('pointerup', clearPointer);
  addEventListener('pointercancel', clearPointer);

  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === cv;
    document.body.classList.toggle('locked', input.locked);
    if (!input.locked && mode === 'play') pauseGame();
  });

  addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('gamepadconnected', e => {
    gp.on = true;
    gp.index = e.gamepad.index;
    ctx.ui.setGamepad(true);
    ctx.ui.toast('GAMEPAD CONNECTED — ' + e.gamepad.id.slice(0, 28));
  });
  addEventListener('gamepaddisconnected', e => {
    if (e.gamepad.index === gp.index) {
      gp.on = false;
      ctx.ui.setGamepad(false);
      state.boost = false;
      state.brake = false;
    }
  });
  addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space' && !e.repeat && mode === 'play') doRoll();
    if ((e.code === 'KeyP' || e.code === 'Escape')) {
      if (mode === 'play' || mode === 'count') pauseGame();
      else if (mode === 'pause') resumeGame();
    }
    if (e.code === 'KeyM') actions.muteToggle();
    if (e.code === 'Enter' && mode === 'over') startRun();
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
}

function pollGamepad() {
  if (!gp.on || !navigator.getGamepads) return null;
  const pads = navigator.getGamepads();
  const pad = pads && pads[gp.index];
  if (!pad) return null;
  const dz = v => Math.abs(v) < 0.14 ? 0 : (v - Math.sign(v) * 0.14) / 0.86;
  const btn = i => !!(pad.buttons[i] && pad.buttons[i].pressed);
  const out = {
    x: dz(pad.axes[0] || 0),
    y: dz(pad.axes[1] || 0),
    boost: btn(7) || btn(0),
    brake: btn(6) || btn(1),
    roll: btn(2) || btn(5),
    start: btn(9),
    active: false
  };
  out.active = out.x !== 0 || out.y !== 0 || out.boost || out.brake || out.roll || out.start;
  if (out.roll && !gp.prev.roll) doRoll();
  if (out.start && !gp.prev.start) {
    if (mode === 'play' || mode === 'count') pauseGame();
    else if (mode === 'pause') resumeGame();
  }
  if (out.boost) state.boost = true;
  else if (gp.prev.boost) state.boost = false;
  if (out.brake) state.brake = true;
  else if (gp.prev.brake) state.brake = false;
  gp.prev = { roll: out.roll, start: out.start, boost: out.boost, brake: out.brake };
  return out;
}

function doRoll() {
  if (mode !== 'play' || state.rollCd > 0) return;
  state.rollT = 0.55;
  state.rollCd = 1.7;
  state.rollDir = state.steer.x !== 0 ? Math.sign(state.steer.x) : (Math.random() < 0.5 ? -1 : 1);
  ctx.ship.vel.x += state.rollDir * 40;
  state.invuln = Math.max(state.invuln, 0.65);
  ctx.audio.whoosh();
  if (tut.on && TUT_STEPS[tut.step] && TUT_STEPS[tut.step].id === 'roll') tut.rolled = true;
}

function readSteerTargets() {
  const sens = ctx.save.settings.sens;
  const inv = ctx.save.settings.invertY ? -1 : 1;
  const invX = ctx.save.settings.invertX ? -1 : 1;
  const cm = ctx.save.settings.controlMode;
  const pad = pollGamepad();

  if (mode === 'attract') {
    state.steer.tx = Math.sin(elapsed * 0.5) * 0.45;
    state.steer.ty = Math.sin(elapsed * 0.37) * 0.26;
    return;
  }

  if (pad && pad.active) {
    state.steer.tx = THREE.MathUtils.clamp(pad.x * sens, -1, 1) * invX;
    state.steer.ty = THREE.MathUtils.clamp(pad.y * inv * sens, -1, 1);
    return;
  }
  if (input.touchId !== null) {
    state.steer.tx = input.tx * sens * invX;
    state.steer.ty = input.ty * inv * sens;
    return;
  }
  const kx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  const ky = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
  if (kx !== 0 || ky !== 0) {
    state.steer.tx = kx * 0.85 * invX;
    state.steer.ty = ky * 0.85 * inv;
    return;
  }
  if (cm === 'lock' || cm === 'stick') {
    state.steer.tx = THREE.MathUtils.clamp(input.stickX * 1.6 * sens, -1, 1) * invX;
    state.steer.ty = THREE.MathUtils.clamp(input.stickY * 1.4 * inv * sens, -1, 1);
    const decay = Math.exp(-(cm === 'lock' ? 1.4 : 2.6) * lastDt);
    input.stickX *= decay;
    input.stickY *= decay;
    return;
  }
  if (!isTouch) {
    const dz = 0.06;
    let nx = Math.abs(input.mx) < dz ? 0 : input.mx - Math.sign(input.mx) * dz;
    let ny = Math.abs(input.my) < dz ? 0 : input.my - Math.sign(input.my) * dz;
    nx /= (1 - dz); ny /= (1 - dz);
    state.steer.tx = THREE.MathUtils.clamp(nx * 1.35 * sens, -1, 1) * invX;
    state.steer.ty = THREE.MathUtils.clamp(ny * 1.15 * inv * sens, -1, 1);
  }
}

function updateWeapons(dt) {
  state.fireCd = Math.max(0, state.fireCd - dt);
  state.heat = Math.max(0, state.heat - dt * 0.3);
  if (state.overheat > 0) {
    state.overheat -= dt;
    ctx.ui.setLock(false);
    state.targetLock = false;
    return;
  }
  if (mode !== 'play' || !ctx.save.settings.autofire) {
    ctx.ui.setLock(false);
    state.targetLock = false;
    return;
  }

  camera.getWorldDirection(tmpV3);
  let best = null, bestCos = 0.994;
  const shipPos = ctx.ship.group.position;
  const consider = (x, y, z) => {
    tmpV1.set(x - shipPos.x, y - shipPos.y, z - shipPos.z);
    const d = tmpV1.length();
    if (d < 12 || d > 760) return;
    const c = tmpV1.dot(tmpV3) / d;
    if (c > bestCos) { bestCos = c; best = tmpV2.set(x, y, z).clone(); }
  };
  for (const e of ctx.world.asts) {
    if (e.alive && e.z < shipPos.z) consider(e.x, e.y, e.z);
  }
  for (const e of ctx.world.comets) {
    if (e.alive && e.mesh.position.z < shipPos.z) consider(e.mesh.position.x, e.mesh.position.y, e.mesh.position.z);
  }

  if (!best) {
    ctx.ui.setLock(false);
    state.targetLock = false;
    return;
  }
  state.targetLock = true;
  ctx.ui.setLock(true);
  if (state.fireCd > 0) return;

  const b = boltPool.find(x => !x.alive);
  if (!b) return;
  tmpV1.set(0, 0.15, -2.6).applyMatrix4(ctx.ship.group.matrixWorld);
  b.pos.copy(tmpV1);
  b.dir.copy(best).sub(tmpV1).normalize();
  b.life = 1.1;
  b.alive = true;
  b.mesh.visible = true;
  b.mesh.quaternion.setFromUnitVectors(tmpV2.set(0, 0, -1), b.dir);
  state.fireCd = 0.18;
  state.heat = Math.min(1, state.heat + 0.085);
  if (state.heat >= 1) {
    state.overheat = 1.7;
    ctx.audio.overheat();
  } else {
    ctx.audio.laser();
  }
  ctx.fx.flash.trigger(tmpV1, 0x6ae8ff, 0.35);
}

function updateBolts(dt) {
  for (const b of boltPool) {
    if (!b.alive) { b.mesh.visible = false; continue; }
    b.pos.addScaledVector(b.dir, 900 * dt);
    b.life -= dt;
    if (b.life <= 0 || b.pos.z < ctx.ship.group.position.z - 1700) b.alive = false;
  }
}

function flightPhysics(dt) {
  const acc = 175, accY = 125, damp = Math.exp(-2.7 * dt);
  const vel = ctx.ship.vel;
  vel.x += state.steer.x * acc * dt;
  vel.y += state.steer.y * accY * dt;
  vel.x *= damp;
  vel.y *= damp;
  vel.x = THREE.MathUtils.clamp(vel.x, -54, 54);
  vel.y = THREE.MathUtils.clamp(vel.y, -44, 44);
  if (state.boostEff) vel.z = Math.min(vel.z + 30 * dt, 6); else vel.z *= Math.exp(-4 * dt);

  const pos = ctx.ship.group.position;
  pos.x += vel.x * dt;
  pos.y += vel.y * dt;
  pos.z += vel.z * dt;
  pos.z *= Math.exp(-6 * dt);

  if (Math.abs(pos.x) > W) vel.x -= Math.sign(pos.x) * (Math.abs(pos.x) - W) * 14 * dt;
  if (Math.abs(pos.y) > H) vel.y -= Math.sign(pos.y) * (Math.abs(pos.y) - H) * 14 * dt;
  pos.x = THREE.MathUtils.clamp(pos.x, -(W + 24), W + 24);
  pos.y = THREE.MathUtils.clamp(pos.y, -(H + 24), H + 24);

  if (Math.abs(pos.x) > W + 12 || Math.abs(pos.y) > H + 12) {
    state.edgeT += dt;
    if (state.edgeT > 0.5) {
      state.edgeT = 0;
      damage(7, 'EDGE FIELD COLLISION');
    }
    if (!state._edgeWarn || elapsed - state._edgeWarn > 2) {
      state._edgeWarn = elapsed;
      ctx.ui.toast('WARNING — LEAVING NAVIGATION CORRIDOR');
    }
  }

  state.rollCd = Math.max(0, state.rollCd - dt);
  state.invuln = Math.max(0, state.invuln - dt);
  state.calm += dt;
  if (state.calm > 4.5 && state.hull < state.maxHull && state.hull > 0) {
    state.hull = Math.min(state.maxHull, state.hull + 3.5 * dt);
  }

  const inner = ctx.ship.inner;
  const bankT = -state.steer.x * 0.85;
  const pitchT = state.steer.y * 0.42;
  inner.rotation.z += (bankT - inner.rotation.z) * Math.min(1, dt * 6);
  inner.rotation.x += (pitchT - inner.rotation.x) * Math.min(1, dt * 6);
  inner.rotation.y += (-state.steer.x * 0.2 - inner.rotation.y) * Math.min(1, dt * 6);
  inner.position.z = Math.sin(elapsed * 2.2) * 0.12;
  if (state.rollT > 0) {
    state.rollT -= dt;
    const p = 1 - Math.max(state.rollT, 0) / 0.55;
    inner.rotation.z = bankT + state.rollDir * p * Math.PI * 2;
    if (state.rollT <= 0) inner.rotation.z = bankT;
  }
  ctx.ship.blinkNav(elapsed);
  ctx.ship.setShield(state.shield > 0, elapsed);
  ctx.ship.setVisible(!(state.invuln > 0 && Math.floor(elapsed * 14) % 2 === 0 && mode === 'play'));
}

function updateSectors() {
  const sector = Math.floor(state.dist / 4000);
  if (sector !== state.sector) {
    state.sector = sector;
    state.sectorName = 'SECTOR ' + (sector + 1) + ' — ' + SECTOR_NAMES[sector % SECTOR_NAMES.length];
    ctx.fx.neb.setPalette(NEBULA_PALETTES[sector % NEBULA_PALETTES.length]);
    ctx.ui.banner('ENTERING ' + state.sectorName);
    ctx.audio.sectorSfx();
  }
}

function updateGhost(dt) {
  if (!ctx.save.settings.ghost) return;
  if (ctx.save.ghost && ghostShip && mode === 'play') {
    const pts = ctx.save.ghost.pts;
    const idx = state.dist / 10;
    if (idx < pts.length / 2 - 1) {
      const i = idx | 0;
      const f = idx - i;
      const x = pts[i * 2] + (pts[(i + 1) * 2] - pts[i * 2]) * f;
      const y = pts[i * 2 + 1] + (pts[(i + 1) * 2 + 1] - pts[i * 2 + 1]) * f;
      ghostShip.group.position.set(x, y, 0);
      ghostShip.inner.rotation.y += dt * 0.5;
      ghostShip.setVisible(true);
    } else {
      ghostShip.setVisible(false);
    }
  }
  if (mode === 'play') {
    const want = Math.floor(state.dist / 10) + 1;
    while (state.ghostRec.length < want * 2 && state.ghostRec.length < 8000) {
      const p = ctx.ship.group.position;
      state.ghostRec.push(Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10);
    }
  }
}

function playSim(dt, rawDt) {
  state.dist += state.speed * dt;
  state.runTime += rawDt;
  const base = 46 + Math.min(92, state.dist * 0.0042);
  state.boostEff = state.boost && (state.energy > 0.5 || state.overdriveT > 0) && !state.brake;
  if (state.boostEff && state.overdriveT <= 0) state.energy = Math.max(0, state.energy - 26 * dt);
  else if (!state.boostEff) state.energy = Math.min(100, state.energy + 11 * dt);
  state.overdriveT = Math.max(0, state.overdriveT - dt);
  state.mult2T = Math.max(0, state.mult2T - dt);
  const target = base * (state.boostEff ? 1.8 : state.brake ? 0.42 : 1);
  state.speed += (target - state.speed) * Math.min(1, dt * 2.1);
  state.score += state.speed * dt * 0.55 * state.mult * (state.mult2T > 0 ? 2 : 1);

  readSteerTargets();
  state.steer.x += (state.steer.tx - state.steer.x) * Math.min(1, dt * 7);
  state.steer.y += (state.steer.ty - state.steer.y) * Math.min(1, dt * 7);
  flightPhysics(dt);
  tutorialUpdate(dt);
  updateWeapons(dt);
  updateBolts(dt);
  activeBolts.length = 0;
  for (const b of boltPool) if (b.alive) activeBolts.push(b);
  ctx.world.update(dt, false, activeBolts);
  ctx.ui.setBoostFx(state.boostEff);
  for (const b of boltPool) if (!b.alive) b.mesh.visible = false;
  updateSectors();
  updateGhost(dt);
  objTimer -= rawDt;
  if (objTimer <= 0) { objTimer = 0.4; checkObjectives(); }

  const danger = state.bhDanger;
  const inDanger = !!danger && danger.d < danger.influence * 0.72;
  ctx.ui.setDanger(inDanger);
  ctx.audio.alarm(inDanger);
  if (danger && danger.d < danger.horizon * 4.5) state.trauma = Math.min(0.5, state.trauma + dt * 0.9);

  const throttle = THREE.MathUtils.clamp((state.speed - 40) / 100, 0.15, 1);
  ctx.ship.engineFlicker(throttle, state.boostEff, elapsed);
  ctx.fx.trails.push();
  ctx.audio.setThrottle(THREE.MathUtils.clamp((state.speed - 40) / 100, 0, 1), state.boostEff);
}

let objTimer = 0;
let lastDt = 0.016;

function attractSim(dt) {
  const targetSpeed = ctx.view === 'orbit' ? 12 : 30;
  state.speed += (targetSpeed - state.speed) * Math.min(1, dt * 2);
  readSteerTargets();
  state.steer.x += (state.steer.tx - state.steer.x) * Math.min(1, dt * 5);
  state.steer.y += (state.steer.ty - state.steer.y) * Math.min(1, dt * 5);
  flightPhysics(dt);
  ctx.world.update(dt, true, null);
  ctx.ship.engineFlicker(0.35, false, elapsed);
  ctx.fx.trails.push();
}

function countSim(dt, rawDt) {
  state.speed += (24 - state.speed) * Math.min(1, dt * 2);
  readSteerTargets();
  state.steer.x += (0 - state.steer.x) * Math.min(1, dt * 5);
  state.steer.y += (0 - state.steer.y) * Math.min(1, dt * 5);
  flightPhysics(dt);
  ctx.world.update(dt, true, null);
  ctx.ship.engineFlicker(0.3, false, elapsed);
  ctx.fx.trails.push();
  cd -= rawDt;
  const n = Math.ceil(cd);
  if (n !== cdLast) {
    cdLast = n;
    if (n >= 0) {
      ctx.ui.countdown(n);
      ctx.audio.countBeep(n === 0);
    }
  }
  if (cd <= 0) {
    ctx.ui.countdown(null);
    mode = 'play';
  }
}

function overSim(dt) {
  state.speed += (10 - state.speed) * Math.min(1, dt * 1.5);
  ctx.world.update(dt, true, null);
}

function cameraUpdate(rawDt) {
  const pos = ctx.ship.group.position;
  const vel = ctx.ship.vel;
  let targetPos, lookAt;

  if (ctx.view === 'orbit' && mode === 'attract') {
    const a = elapsed * 0.42;
    targetPos = tmpV1.set(pos.x + Math.sin(a) * 9.5, pos.y + 2.6, pos.z + Math.cos(a) * 9.5);
    camera.position.lerp(targetPos, 1 - Math.exp(-3 * rawDt));
    camera.lookAt(tmpV2.set(pos.x, pos.y + 0.4, pos.z));
    return;
  }

  if (mode === 'over') {
    const a = elapsed * 0.25;
    targetPos = tmpV1.set(deathPos.x + Math.sin(a) * 16, deathPos.y + 4, deathPos.z + Math.cos(a) * 16 + 6);
    camera.position.lerp(targetPos, 1 - Math.exp(-1.6 * rawDt));
    camera.lookAt(deathPos);
  } else {
    targetPos = tmpV1.set(
      pos.x + vel.x * 0.055,
      pos.y + 4.3 + vel.y * 0.05,
      pos.z + 13.6
    );
    camera.position.lerp(targetPos, 1 - Math.exp(-5.5 * rawDt));
    lookAt = tmpV2.set(pos.x + vel.x * 0.28, pos.y + vel.y * 0.22 + 0.6, pos.z - 42);
    camera.lookAt(lookAt);
    camera.rotateZ(ctx.ship.inner.rotation.z * 0.08);
  }

  const fovT = mode === 'play' && state.boostEff ? 78 : 68;
  camera.fov += (fovT - camera.fov) * Math.min(1, rawDt * 4);
  camera.updateProjectionMatrix();

  if (state.trauma > 0) {
    state.trauma = Math.max(0, state.trauma - rawDt * 1.7);
    const s = state.trauma * state.trauma * 1.5 * ctx.save.settings.shake;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
    camera.rotateZ((Math.random() - 0.5) * s * 0.04);
  }
}

function loop() {
  const rawDt = Math.min(clock.getDelta(), 0.05);
  lastDt = rawDt;
  elapsed += rawDt;

  if (mode === 'pause') {
    composer.render();
    return;
  }
  updateDRS(rawDt);

  if (state.slowT > 0) {
    state.slowT -= rawDt;
    if (state.slowT <= 0) state.timeScale = 1;
  }
  const dt = rawDt * state.timeScale;

  if (mode === 'attract') attractSim(dt);
  else if (mode === 'count') countSim(dt, rawDt);
  else if (mode === 'play') playSim(dt, rawDt);
  else if (mode === 'over') overSim(dt);

  if (state.consuming && consume) {
    consume.t += rawDt;
    const ship = ctx.ship;
    ship.group.position.lerp(consume.target, Math.min(1, rawDt * 2.6));
    ship.inner.scale.setScalar(Math.max(0.02, 1 - consume.t * 1.05));
    ship.inner.rotation.y += rawDt * 9;
    state.trauma = Math.max(state.trauma, 0.4);
    if (consume.t > 1.05) {
      state.consuming = false;
      ctx.fx.expl.spawn(consume.target, 0xb07aff, 2.2, true);
      ctx.fx.shocks.spawn(consume.target, 0xc9a0ff, 40);
      ship.inner.scale.setScalar(1);
      ship.setVisible(false);
      die('CONSUMED BY THE BLACK HOLE');
    }
  }

  ctx.fx.stars.update(camera.position, elapsed);
  ctx.fx.neb.update(camera.position, elapsed, rawDt);
  ctx.fx.dust.update(camera.position, THREE.MathUtils.clamp((state.speed - 30) / 110, 0, 1), state.boostEff);
  ctx.fx.expl.update(rawDt);
  ctx.fx.shocks.update(rawDt, camera);
  ctx.fx.debris.update(rawDt);
  ctx.fx.flash.update(rawDt);

  cameraUpdate(rawDt);

  if (mode === 'play' || mode === 'count') {
    ctx.ui.updateHUD(state, performance.now());
    radarT -= rawDt;
    if (radarT <= 0) {
      radarT = 0.05;
      ctx.ui.drawRadar(ctx.world.radarData);
    }
  }

  composer.render();
}

function setTouchControls(v) {
  const tc = document.getElementById('touch-controls');
  if (tc) tc.classList.toggle('hidden', !(v && isTouch));
}

window.__vrDebug = () => ({
  mode,
  speed: Math.round(state.speed),
  dist: Math.floor(state.dist),
  cd: Math.round(cd * 10) / 10,
  heat: Math.round(state.heat * 100),
  sector: state.sector,
  shield: state.shield,
  kills: state.kills,
  crystals: state.crystals,
  gates: state.gates,
  tutOn: tut.on,
  tutStep: tut.step,
  objectives: state.objectives.map(o => o.done).join(','),
  bolts: boltPool.filter(b => b.alive).length
});

{
  const chip = document.getElementById('device-chip');
  if (chip) {
    chip.textContent = isTouch ? 'TOUCH CONTROLS READY' : 'MOUSE + KEYBOARD READY';
    addEventListener('gamepadconnected', () => { chip.textContent += ' · GAMEPAD FOUND'; });
  }
}

init();
