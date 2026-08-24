import { SKINS, ACH, levelInfo, skinById } from './save.js';

const $ = id => document.getElementById(id);

export class UI {
  constructor(ctx) {
    this.ctx = ctx;
    this.el = {};
    const ids = [
      'splash', 'hud', 'score', 'mult', 'combo', 'dist', 'speed', 'hull-bar', 'hull-num',
      'energy-bar', 'radar', 'reticle', 'alerts', 'popups', 'vignette', 'dmg-flash',
      'menu-main', 'menu-over', 'menu-hangar', 'menu-ach', 'menu-help', 'menu-settings',
      'pause-overlay', 'countdown', 'toast', 'btn-pause', 'btn-mute', 'btn-full',
      'touch-controls', 'btn-boost', 'btn-roll', 'btn-brake'
    ];
    for (const id of ids) this.el[id] = $(id);

    this.radarCtx = this.el['radar'].getContext('2d');
    this.overEls = {
      cause: $('over-cause'), score: $('over-score'), best: $('over-best'),
      stats: $('over-stats'), xpFill: $('xp-fill'), xpText: $('xp-text'),
      lvlBadge: $('over-lvl'), unlocks: $('over-unlocks'), newRec: $('over-record')
    };
    this.menuEls = {
      best: $('menu-best'), lvl: $('menu-level'), lvlFill: $('menu-xp-fill'), lvlText: $('menu-xp-text')
    };
    this.lastHudT = 0;
    this.dangerOn = false;
  }

  hideSplash() { this.el.splash.style.display = 'none'; }

  layer(id) {
    const all = ['hud', 'menu-main', 'menu-over', 'menu-hangar', 'menu-ach', 'menu-help', 'menu-settings', 'pause-overlay'];
    for (const k of all) {
      if (k === 'hud') continue;
      this.el[k].classList.add('hidden');
    }
    this.el.hud.classList.add('hidden');
    if (id && id !== 'none') this.el[id].classList.remove('hidden');
  }

  showHud(v) { this.el.hud.classList.toggle('hidden', !v); }

  toast(msg) {
    const t = this.el.toast;
    t.textContent = msg;
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
  }

  countdown(n) {
    const c = this.el.countdown;
    if (n === null) { c.classList.remove('show'); return; }
    c.textContent = n === 0 ? 'GO' : n;
    c.classList.remove('pop');
    void c.offsetWidth;
    c.classList.add('show', 'pop');
  }

  setDanger(on) {
    if (this.dangerOn === on) return;
    this.dangerOn = on;
    this.el.alerts.innerHTML = on ? '<div class="danger-banner">GRAVITY WELL DETECTED</div>' : '';
    document.body.classList.toggle('danger', on);
  }

  popup(text, cls, worldPos) {
    const v = worldPos.clone().project(this.ctx.camera);
    if (v.z > 1) return;
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    const d = document.createElement('div');
    d.className = 'popup ' + cls;
    d.textContent = text;
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    this.el.popups.appendChild(d);
    setTimeout(() => d.remove(), 1000);
  }

  damageFlash() {
    const f = this.el['dmg-flash'];
    f.classList.remove('hit');
    void f.offsetWidth;
    f.classList.add('hit');
  }

  updateHUD(state) {
    this.el.score.textContent = Math.floor(state.score).toLocaleString();
    this.el.mult.textContent = 'x' + state.mult.toFixed(1);
    const comboEl = this.el.combo;
    if (state.combo > 2) {
      comboEl.textContent = 'COMBO ' + state.combo + ' CHAIN';
      comboEl.classList.add('on');
    } else {
      comboEl.classList.remove('on');
    }
    this.el.dist.textContent = (state.dist / 1000).toFixed(2) + ' KM';
    this.el.speed.textContent = Math.round(state.speed * 3.6) + ' M/S';
    this.el['hull-bar'].style.width = Math.max(0, (state.hull / state.maxHull) * 100) + '%';
    this.el['hull-bar'].classList.toggle('low', state.hull < 30);
    this.el['hull-num'].textContent = Math.max(0, Math.ceil(state.hull)) + '%';
    this.el['energy-bar'].style.width = state.energy + '%';
    document.body.classList.toggle('critical', state.hull < 30);
  }

  drawRadar(data) {
    const g = this.radarCtx;
    const W = 160, H = 160, cx = W / 2, cy = H / 2, R = 72;
    g.clearRect(0, 0, W, H);
    g.strokeStyle = 'rgba(80,220,255,0.35)';
    g.lineWidth = 1.5;
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(80,220,255,0.14)';
    g.beginPath(); g.arc(cx, cy, R * 0.55, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke();
    const sweep = (performance.now() / 1000) % 2 * Math.PI;
    g.strokeStyle = 'rgba(120,255,230,0.7)';
    g.beginPath(); g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R); g.stroke();

    const shipPos = this.ctx.ship.group.position;
    for (const d of data) {
      const dx = d.x - shipPos.x;
      const dz = d.z - shipPos.z;
      const ang = Math.atan2(dx, -dz);
      const dist = Math.min(Math.sqrt(dx * dx + dz * dz), 760);
      const rr = (dist / 760) * R;
      const px = cx + Math.sin(ang) * rr;
      const py = cy - Math.cos(ang) * rr;
      let col = '#ff5a4a', sz = 2.4;
      if (d.type === 'cry') { col = '#3ae8ff'; sz = 2; }
      else if (d.type === 'gate') { col = '#57ff9a'; sz = 2.6; }
      else if (d.type === 'bh') { col = '#c07aff'; sz = 4.2; }
      else if (d.type === 'planet') { col = '#ffb45a'; sz = 3.6; }
      g.fillStyle = col;
      g.beginPath(); g.arc(px, py, sz, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#dff6ff';
    g.beginPath(); g.arc(cx, cy, 2.6, 0, Math.PI * 2); g.fill();
  }

  refreshMenu(save) {
    const li = levelInfo(save.xp);
    this.menuEls.best.textContent = Math.floor(save.best).toLocaleString();
    this.menuEls.lvl.textContent = 'LV ' + li.level;
    this.menuEls.lvlFill.style.width = (li.pct * 100).toFixed(1) + '%';
    this.menuEls.lvlText.textContent = li.into + ' / ' + li.need + ' XP';
  }

  renderHangar(save, onEquip, onPreview) {
    const grid = $('hangar-grid');
    grid.innerHTML = '';
    const li = levelInfo(save.xp);
    $('hangar-perk').textContent = 'LEVEL PERK — HULL INTEGRITY +' + Math.min(60, (li.level - 1) * 5) + ' (MAX ' + (100 + Math.min(60, (li.level - 1) * 5)) + ')';
    for (const s of SKINS) {
      const locked = li.level < s.req;
      const card = document.createElement('div');
      card.className = 'skin-card' + (locked ? ' locked' : '') + (save.equipped === s.id ? ' equipped' : '');
      card.innerHTML = `
        <div class="skin-swatch">
          <span style="background:${s.body}"></span>
          <span style="background:${s.accent}"></span>
          <span style="background:${s.glow}"></span>
        </div>
        <div class="skin-name">${s.name}</div>
        <div class="skin-status">${locked ? 'LOCKED — LV ' + s.req : (save.equipped === s.id ? 'EQUIPPED' : 'TAP TO EQUIP')}</div>`;
      if (!locked) {
        card.addEventListener('mouseenter', () => onPreview(s));
        card.addEventListener('mouseleave', () => onPreview(null));
        card.addEventListener('click', () => { onEquip(s); });
      }
      grid.appendChild(card);
    }
  }

  renderAch(save) {
    const list = $('ach-list');
    list.innerHTML = '';
    for (const a of ACH) {
      const done = !!save.ach[a.id];
      const row = document.createElement('div');
      row.className = 'ach-row' + (done ? ' done' : '');
      row.innerHTML = `
        <div class="ach-check">${done ? '&#10003;' : ''}</div>
        <div><div class="ach-name">${a.name}</div><div class="ach-desc">${a.desc}</div></div>`;
      list.appendChild(row);
    }
  }

  showOver(data) {
    this.overEls.cause.textContent = data.cause;
    this.overEls.best.textContent = 'BEST ' + Math.floor(data.best).toLocaleString();
    this.overEls.newRec.classList.toggle('hidden', !data.newBest);
    this.overEls.stats.innerHTML = `
      <div><span>DISTANCE</span><b>${(data.dist / 1000).toFixed(2)} KM</b></div>
      <div><span>CRYSTALS</span><b>${data.crystals}</b></div>
      <div><span>GATES</span><b>${data.gates}</b></div>
      <div><span>NEAR MISSES</span><b>${data.nearMisses}</b></div>
      <div><span>MAX COMBO</span><b>x${data.maxCombo}</b></div>
      <div><span>ESCAPES</span><b>${data.escapes || 0}</b></div>`;
    this.overEls.lvlBadge.textContent = 'LV ' + levelInfo(data.save.xp).level;

    const startXp = data.prevXp, endXp = data.save.xp;
    const dur = 900, t0 = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / dur);
      const cur = Math.round(startXp + (endXp - startXp) * t);
      const li = levelInfo(cur);
      this.overEls.xpFill.style.width = (li.pct * 100).toFixed(1) + '%';
      this.overEls.xpText.textContent = '+' + data.xpGained + ' XP  ·  LV ' + li.level + ' (' + li.into + '/' + li.need + ')';
      if (t < 1) requestAnimationFrame(step);
    };
    step();

    const scEl = this.overEls.score;
    const s0 = performance.now(), target = Math.floor(data.score);
    const stepS = () => {
      const t = Math.min(1, (performance.now() - s0) / 1100);
      scEl.textContent = Math.floor(target * (1 - Math.pow(1 - t, 3))).toLocaleString();
      if (t < 1) requestAnimationFrame(stepS);
    };
    stepS();

    const unl = $('over-unlocks');
    unl.innerHTML = '';
    if (data.unlocks.length) {
      unl.innerHTML = '<div class="unlock-title">NEW UNLOCKS</div>' +
        data.unlocks.map(u => `<div class="unlock-item" style="--c:${u.glow}">${u.name} SHIP SKIN</div>`).join('');
    }
    this.layer('menu-over');
  }
}
