import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { load as loadSave, persist as persistSave, SKINS, ACH, levelInfo, skinById } from './save.js';
import { AudioSys } from './audio.js';
import { Stars, Dust, Nebula } from './fx.js';
import { Explosions, Shocks, Trails } from './fx2.js';
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

const state = {
  speed: 0, dist: 0, score: 0, combo: 0, mult: 1, crystals: 0, gates: 0,
  nearMisses: 0, maxCombo: 0, escapes: 0, hull: 100, maxHull: 100, energy: 100,
  boost: false, brake: false, boostEff: false,
  steer: { x: 0, y: 0, tx: 0, ty: 0 },
  rollT: 0, rollDir: 1, rollCd: 0, invuln: 0, calm: 0, edgeT: 0,
  trauma: 0, timeScale: 1, slowT: 0, bhDanger: null, damageTaken: 0, consuming: false
};

const ctx = {};
const input = { mx: 0, my: 0, touchId: null, sx0: 0, sy0: 0, tx: 0, ty: 0 };

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
    shocks: new Shocks(scene, 8)
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

function applyQuality(q) {
  const pr = q === 'low' ? 1 : Math.min(devicePixelRatio, q === 'medium' ? 1.5 : 2);
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight);
  composer.setPixelRatio(pr);
  composer.setSize(innerWidth, innerHeight);
  bloomPass.enabled = q !== 'low';
  bloomPass.strength = q === 'high' ? 0.85 : 0.65;
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
}

function bindCallbacks() {
  ctx.cb = {
    onCrystal: e => {
      state.combo++;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      state.mult = multOf();
      state.crystals++;
      state.score += 150 * state.mult;
      ctx.ui.popup('+150', 'cyan', e.mesh.position);
      ctx.fx.expl.spawn(e.mesh.position, 0x46e8ff, 0.5);
      ctx.audio.pickup(state.combo);
    },
    onGate: e => {
      state.combo += 2;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      state.mult = multOf();
      state.gates++;
      state.score += 350 * state.mult;
      state.energy = Math.min(100, state.energy + 16);
      ctx.ui.popup('GATE +350', 'gold', e.mesh.position.clone().add(new THREE.Vector3(0, 4, 0)));
      ctx.fx.shocks.spawn(e.mesh.position, 0x57ff9a, 34);
      ctx.audio.gate();
    },
    onNearMiss: (pos, type) => {
      state.nearMisses++;
      state.combo++;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      state.mult = multOf();
      state.score += 75 * state.mult;
      ctx.ui.popup('NEAR MISS +' + Math.floor(75 * state.mult), 'white', pos);
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
    onBHDeath: pos => startConsumption(pos),
    onEscape: () => {
      state.escapes++;
      ctx.save.stats.escapes++;
      state.score += 400 * state.mult;
      ctx.ui.popup('WELL ESCAPED +' + Math.floor(400 * state.mult), 'gold', ctx.ship.group.position);
      ctx.ui.toast('GRAVITY WELL ESCAPED');
      checkLiveAchievements();
    }
  };
}

function multOf() {
  return 1 + Math.min(4, state.combo * 0.12);
}

function damage(amount, label) {
  if (state.invuln > 0 || mode !== 'play') return;
  state.hull -= amount;
  state.damageTaken += amount;
  state.calm = 0;
  state.combo = 0;
  state.mult = multOf();
  ctx.ui.damageFlash();
  ctx.audio.explosion(false);
  ctx.ui.popup('-' + amount + ' HULL', 'red', ctx.ship.group.position);
  if (label) ctx.ui.alertBanner(label);
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
  ctx.fx.expl.spawn(deathPos, 0xffc27d, 1.8);
  ctx.fx.shocks.spawn(deathPos, 0xffd9a0, 46);
  state.trauma = 1;
  state.slowT = 0.9;
  state.timeScale = 0.25;
  ctx.ui.setDanger(false);
  ctx.audio.alarm(false);
  ctx.audio.engineOff();
  ctx.audio.explosion(true);
  document.body.classList.remove('playing', 'critical');
  setTouchControls(false);

  setTimeout(() => {
    if (mode === 'over' && runSeq === thisRun) finalizeRun(causeText);
  }, 1400);
}

function finalizeRun(causeText) {
  const save = ctx.save;
  const prevLevel = levelInfo(save.xp).level;
  const score = Math.floor(state.score);
  const xpGained = Math.floor(score / 60) + state.crystals * 2 + state.gates * 6 + state.nearMisses;
  const prevXp = save.xp;
  save.xp += xpGained;

  const newBest = score > save.best;
  if (newBest) save.best = score;
  save.bestDist = Math.max(save.bestDist, Math.floor(state.dist));
  save.bestCrystals = Math.max(save.bestCrystals, state.crystals);
  if (state.damageTaken === 0) save.flawless = Math.max(save.flawless, score);

  save.stats.runs++;
  save.stats.crystals += state.crystals;
  save.stats.gates += state.gates;
  save.stats.dist += Math.floor(state.dist);
  save.stats.nearMisses += state.nearMisses;
  save.stats.escapes += state.escapes;

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

function resetRunStats() {
  const lvl = levelInfo(ctx.save.xp).level;
  Object.assign(state, {
    speed: 0, dist: 0, score: 0, combo: 0, mult: 1, crystals: 0, gates: 0,
    nearMisses: 0, maxCombo: 0, escapes: 0, energy: 100,
    rollT: 0, rollCd: 0, invuln: 0, calm: 0, edgeT: 0,
    trauma: 0, timeScale: 1, slowT: 0, bhDanger: null, damageTaken: 0, consuming: false
  });
  state.maxHull = 100 + Math.min(60, (lvl - 1) * 5);
  state.hull = state.maxHull;
  state.steer.tx = state.steer.ty = 0;
  state.steer.x = state.steer.y = 0;
  input.tx = input.ty = 0;
  consume = null;
}

function toMenu() {
  mode = 'attract';
  ctx.view = 'chase';
  ctx.world.reset();
  ctx.ship.reset();
  ctx.fx.trails.clear();
  ctx.fx.trails.setVisible(true);
  ctx.ui.setDanger(false);
  ctx.audio.alarm(false);
  ctx.audio.engineOff();
  ctx.ui.showHud(false);
  ctx.ui.layer('menu-main');
  ctx.ui.refreshMenu(ctx.save);
  document.body.classList.remove('playing', 'critical', 'danger');
  setTouchControls(false);
}

function openHangar() {
  mode = 'attract';
  ctx.view = 'orbit';
  ctx.world.reset();
  ctx.ui.renderHangar(ctx.save, actEquip, actPreview);
  ctx.ui.layer('menu-hangar');
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
}

function pauseGame() {
  if (mode !== 'play' && mode !== 'count') return;
  prevPauseMode = mode;
  mode = 'pause';
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
  toMenu();
}

const actions = {
  play: () => { ctx.audio.init(); ctx.audio.click(); startRun(); },
  hangar: () => { ctx.audio.click(); openHangar(); },
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
  overRestart: () => { ctx.audio.click(); startRun(); },
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
  on('btn-hangar', actions.hangar);
  on('btn-ach', actions.ach);
  on('btn-help', actions.help);
  on('btn-settings', actions.settings);
  on('btn-full', actions.fullscreen);
  on('hangar-back', actions.back);
  on('ach-back', actions.back);
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
  on('btn-full-menu', actions.fullscreen);

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
}

function reflectSettings() {
  const s = ctx.save.settings;
  const snd = document.getElementById('set-sound');
  const qual = document.getElementById('set-quality');
  const sens = document.getElementById('set-sens');
  const inv = document.getElementById('set-invert');
  const sensVal = document.getElementById('sens-val');
  if (snd) snd.checked = s.sound;
  if (qual) qual.value = s.quality;
  if (sens) sens.value = s.sens;
  if (inv) inv.checked = s.invertY;
  if (sensVal) sensVal.textContent = parseFloat(s.sens).toFixed(1);
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
    input.mx = (e.clientX / innerWidth) * 2 - 1;
    input.my = (e.clientY / innerHeight) * 2 - 1;
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

  addEventListener('contextmenu', e => e.preventDefault());
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

function doRoll() {
  if (mode !== 'play' || state.rollCd > 0) return;
  state.rollT = 0.55;
  state.rollCd = 1.7;
  state.rollDir = state.steer.x !== 0 ? Math.sign(state.steer.x) : (Math.random() < 0.5 ? -1 : 1);
  ctx.ship.vel.x += state.rollDir * 40;
  state.invuln = Math.max(state.invuln, 0.65);
  ctx.audio.whoosh();
}

function readSteerTargets() {
  const sens = ctx.save.settings.sens;
  const inv = ctx.save.settings.invertY ? -1 : 1;
  let kx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  let ky = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
  if (mode === 'attract') {
    state.steer.tx = Math.sin(elapsed * 0.5) * 0.45;
    state.steer.ty = Math.sin(elapsed * 0.37) * 0.26;
    return;
  }
  if (input.touchId !== null) {
    state.steer.tx = input.tx * sens;
    state.steer.ty = input.ty * inv * sens;
  } else if (kx !== 0 || ky !== 0) {
    state.steer.tx = kx * 0.85;
    state.steer.ty = ky * 0.85 * inv;
  } else if (!isTouch) {
    const dz = 0.06;
    let nx = Math.abs(input.mx) < dz ? 0 : input.mx - Math.sign(input.mx) * dz;
    let ny = Math.abs(input.my) < dz ? 0 : input.my - Math.sign(input.my) * dz;
    nx /= (1 - dz); ny /= (1 - dz);
    state.steer.tx = THREE.MathUtils.clamp(nx * 1.35 * sens, -1, 1);
    state.steer.ty = THREE.MathUtils.clamp(ny * 1.15 * inv * sens, -1, 1);
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
  ctx.ship.setVisible(!(state.invuln > 0 && Math.floor(elapsed * 14) % 2 === 0 && mode === 'play'));
}

function playSim(dt) {
  state.dist += state.speed * dt;
  const base = 46 + Math.min(92, state.dist * 0.0042);
  state.boostEff = state.boost && state.energy > 0.5 && !state.brake;
  if (state.boostEff) state.energy = Math.max(0, state.energy - 26 * dt);
  else state.energy = Math.min(100, state.energy + 11 * dt);
  const target = base * (state.boostEff ? 1.8 : state.brake ? 0.42 : 1);
  state.speed += (target - state.speed) * Math.min(1, dt * 2.1);
  state.score += state.speed * dt * 0.55 * state.mult;

  readSteerTargets();
  state.steer.x += (state.steer.tx - state.steer.x) * Math.min(1, dt * 7);
  state.steer.y += (state.steer.ty - state.steer.y) * Math.min(1, dt * 7);
  flightPhysics(dt);
  ctx.world.update(dt, false);

  const danger = state.bhDanger;
  const inDanger = !!danger && danger.d < danger.influence * 0.72;
  ctx.ui.setDanger(inDanger);
  ctx.audio.alarm(inDanger);
  if (danger && danger.d < danger.horizon * 4.5) state.trauma = Math.min(0.5, state.trauma + dt * 0.9);

  ctx.ship.engineFlicker(
    THREE.MathUtils.clamp((state.speed - 40) / 100, 0.15, 1),
    state.boostEff, elapsed
  );
  ctx.fx.trails.push();
  ctx.audio.setThrottle(THREE.MathUtils.clamp((state.speed - 40) / 100, 0, 1), state.boostEff);
}

function attractSim(dt) {
  const targetSpeed = ctx.view === 'orbit' ? 12 : 30;
  state.speed += (targetSpeed - state.speed) * Math.min(1, dt * 2);
  readSteerTargets();
  state.steer.x += (state.steer.tx - state.steer.x) * Math.min(1, dt * 5);
  state.steer.y += (state.steer.ty - state.steer.y) * Math.min(1, dt * 5);
  flightPhysics(dt);
  ctx.world.update(dt, true);
  ctx.ship.engineFlicker(0.35, false, elapsed);
  ctx.fx.trails.push();
}

function countSim(dt, rawDt) {
  state.speed += (24 - state.speed) * Math.min(1, dt * 2);
  readSteerTargets();
  state.steer.x += (0 - state.steer.x) * Math.min(1, dt * 5);
  state.steer.y += (0 - state.steer.y) * Math.min(1, dt * 5);
  flightPhysics(dt);
  ctx.world.update(dt, true);
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
  ctx.world.update(dt, true);
}

function cameraUpdate(rawDt) {
  const pos = ctx.ship.group.position;
  const vel = ctx.ship.vel;
  let targetPos, lookAt;

  if (ctx.view === 'orbit' && mode === 'attract') {
    const a = elapsed * 0.42;
    targetPos = new THREE.Vector3(pos.x + Math.sin(a) * 9.5, pos.y + 2.6, pos.z + Math.cos(a) * 9.5);
    lookAt = pos.clone().add(new THREE.Vector3(0, 0.4, 0));
    camera.position.lerp(targetPos, 1 - Math.exp(-3 * rawDt));
    camera.lookAt(lookAt);
    return;
  }

  if (mode === 'over') {
    const a = elapsed * 0.25;
    targetPos = new THREE.Vector3(deathPos.x + Math.sin(a) * 16, deathPos.y + 4, deathPos.z + Math.cos(a) * 16 + 6);
    camera.position.lerp(targetPos, 1 - Math.exp(-1.6 * rawDt));
    camera.lookAt(deathPos);
  } else {
    targetPos = new THREE.Vector3(
      pos.x + vel.x * 0.055,
      pos.y + 4.3 + vel.y * 0.05,
      pos.z + 13.6
    );
    camera.position.lerp(targetPos, 1 - Math.exp(-5.5 * rawDt));
    lookAt = new THREE.Vector3(pos.x + vel.x * 0.28, pos.y + vel.y * 0.22 + 0.6, pos.z - 42);
    camera.lookAt(lookAt);
    camera.rotateZ(ctx.ship.inner.rotation.z * 0.08);
  }

  const fovT = mode === 'play' && state.boostEff ? 78 : 68;
  camera.fov += (fovT - camera.fov) * Math.min(1, rawDt * 4);
  camera.updateProjectionMatrix();

  if (state.trauma > 0) {
    state.trauma = Math.max(0, state.trauma - rawDt * 1.7);
    const s = state.trauma * state.trauma * 1.5;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
    camera.rotateZ((Math.random() - 0.5) * s * 0.04);
  }
}

function loop() {
  const rawDt = Math.min(clock.getDelta(), 0.05);
  elapsed += rawDt;

  if (mode === 'pause') {
    composer.render();
    return;
  }
  if (state.slowT > 0) {
    state.slowT -= rawDt;
    if (state.slowT <= 0) state.timeScale = 1;
  }
  const dt = rawDt * state.timeScale;

  if (mode === 'attract') attractSim(dt);
  else if (mode === 'count') countSim(dt, rawDt);
  else if (mode === 'play') playSim(dt);
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
  ctx.fx.neb.update(camera.position, elapsed);
  ctx.fx.dust.update(camera.position, THREE.MathUtils.clamp((state.speed - 30) / 110, 0, 1), state.boostEff);
  ctx.fx.expl.update(rawDt);
  ctx.fx.shocks.update(rawDt, camera);

  cameraUpdate(rawDt);

  if (mode === 'play' || mode === 'count') {
    ctx.ui.updateHUD(state);
    ctx.ui.drawRadar(ctx.world.radarData);
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
  fpsTarget: !!renderer
});

init();
