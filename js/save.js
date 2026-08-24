const KEY = 'voidrunner_save_v1';

export const SKINS = [
  { id: 'cadet',   name: 'Cadet',        req: 1,  body: '#8fa3c8', accent: '#39d7ff', glow: '#57e6ff' },
  { id: 'ember',   name: 'Ember',        req: 3,  body: '#b0553a', accent: '#ffb347', glow: '#ff9d45' },
  { id: 'frost',   name: 'Frostbite',    req: 5,  body: '#dfeeff', accent: '#7fd4ff', glow: '#aef1ff' },
  { id: 'verdant', name: 'Verdant',      req: 7,  body: '#4e8f5e', accent: '#7dffa8', glow: '#66ffb0' },
  { id: 'pulse',   name: 'Pulse',        req: 9,  body: '#8e3f6e', accent: '#ff5ce1', glow: '#ff7ae8' },
  { id: 'void',    name: 'Voidwalker',   req: 12, body: '#262640', accent: '#8a5cff', glow: '#a07aff' },
  { id: 'aurum',   name: 'Aurum',        req: 15, body: '#c9a24a', accent: '#ffe98a', glow: '#ffd76b' }
];

export const ACH = [
  { id: 'first',    name: 'First Flight',        desc: 'Complete your first run',              test: s => s.stats.runs >= 1 },
  { id: 'cadet',    name: 'Space Cadet',         desc: 'Travel 1,000 m in a single run',       test: s => s.bestDist >= 1000 },
  { id: 'drifter',  name: 'Deep Drifter',        desc: 'Travel 10,000 m in a single run',      test: s => s.bestDist >= 10000 },
  { id: 'legend',   name: 'Void Legend',         desc: 'Travel 50,000 m in a single run',      test: s => s.bestDist >= 50000 },
  { id: 'gems',     name: 'Gem Collector',       desc: 'Collect 30 crystals in one run',       test: s => s.bestCrystals >= 30 },
  { id: 'hoard',    name: 'Diamond Hands',       desc: 'Collect 500 crystals in total',        test: s => s.stats.crystals >= 500 },
  { id: 'gates',    name: 'Gatecrasher',         desc: 'Clear 25 boost gates in total',        test: s => s.stats.gates >= 25 },
  { id: 'horizon',  name: 'Event Horizon',       desc: 'Escape a black hole gravity well',     test: s => s.stats.escapes >= 1 },
  { id: 'clean',    name: 'Untouchable',         desc: 'Score 25,000 with zero hull damage',   test: s => s.flawless >= 25000 },
  { id: 'cent',     name: 'Centurion',           desc: 'Reach level 10',                       test: s => levelInfo(s.xp).level >= 10 },
  { id: 'gunner',   name: 'Gunner',              desc: 'Destroy 100 asteroids with plasma',    test: s => s.stats.kills >= 100 },
  { id: 'empower',  name: 'Empowered',           desc: 'Collect 25 power-ups in total',        test: s => s.stats.powerups >= 25 },
  { id: 'triple',   name: 'Completionist',       desc: 'Complete all 3 objectives in one run', test: s => s.perfectObjectives >= 1 },
  { id: 'marathon', name: 'Marathoner',          desc: 'Fly 250 km across all runs',           test: s => s.stats.dist >= 250000 }
];

export const SECTOR_NAMES = [
  'CARINA EXPANSE', 'ORION VEIL', 'LYRA GAP', 'DRACO REACH',
  'VEGA SHALLOWS', 'CYGNUS RIFT', 'PERSEUS DRIFT', 'AQUILA FIELD',
  'CETUS DEEP', 'TUCANA SPUR', 'ARA CORRIDOR', 'BOOTES WASTE'
];

export function defaultSave() {
  return {
    v: 2,
    best: 0,
    bestDist: 0,
    bestCrystals: 0,
    flawless: 0,
    perfectObjectives: 0,
    xp: 0,
    equipped: 'cadet',
    runs: [],
    ghost: null,
    stats: { runs: 0, crystals: 0, gates: 0, dist: 0, nearMisses: 0, escapes: 0, kills: 0, playtime: 0, powerups: 0 },
    ach: {},
    settings: {
      sound: true, quality: 'auto', sens: 1.0, invertY: false, invertX: false,
      shake: 1.0, controlMode: 'aim', autofire: true, lefty: false, ghost: true
    }
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw);
    const def = defaultSave();
    const merged = {
      ...def,
      ...data,
      stats: { ...def.stats, ...(data.stats || {}) },
      settings: { ...def.settings, ...(data.settings || {}) },
      ach: { ...(data.ach || {}) },
      runs: Array.isArray(data.runs) ? data.runs.slice(0, 10) : [],
      ghost: data.ghost || null
    };
    merged.v = 2;
    return merged;
  } catch (e) {
    return defaultSave();
  }
}

export function persist(save) {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* storage unavailable */ }
}

function xpToLevel(l) {
  return Math.round(140 * Math.pow(l, 1.35));
}

export function totalXpForLevel(l) {
  let t = 0;
  for (let i = 1; i < l; i++) t += xpToLevel(i);
  return t;
}

export function levelInfo(xp) {
  let level = 1;
  while (level < 60 && xp >= totalXpForLevel(level + 1)) level++;
  const base = totalXpForLevel(level);
  const need = xpToLevel(level);
  return { level, into: xp - base, need, pct: Math.min(1, (xp - base) / need) };
}

export function skinById(id) {
  return SKINS.find(s => s.id === id) || SKINS[0];
}
