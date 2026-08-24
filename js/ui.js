import { SKINS, ACH, levelInfo, skinById } from './save.js';

const $ = id => document.getElementById(id);

export class UI {
  constructor(ctx) {
    this.ctx = ctx;
    this.el = {};
    const ids = [
      'splash', 'hud', 'score', 'mult', 'combo', 'dist', 'speed', 'sector',
      'hull-bar', 'hull-num', 'energy-bar', 'heat-wrap', 'heat-bar', 'heat-num',
      'status-chips', 'gp-chip', 'radar', 'reticle', 'alerts', 'popups', 'vignette',
      'dmg-flash', 'menu-main', 'menu-over', 'menu-hangar', 'menu-ach', 'menu-profile',
      'menu-help', 'menu-settings', 'pause-overlay', 'countdown', 'toast', 'banner',
      'tut-card', 'tut-text', 'tut-keys', 'tut-dots', 'tut-skip', 'hint-bar',
      'boost-fx', 'device-chip',
      'btn-pause', 'btn-mute', 'btn-full', 'touch-controls', 'btn-boost', 'btn-roll', 'btn-brake'
    ];
    for (const id of ids) this.el[id] = $(id);

    this.radarCtx = this.el['radar'].getContext('2d');
    this.overEls = {
      cause: $('over-cause'), score: $('over-score'), best: $('over-best'),
      stats: $('over-stats'), xpFill: $('xp-fill'), xpText: $('xp-text'),
      lvlBadge: $('over-lvl'), unlocks: $('over-unlocks'), newRec: $('over-record'),
      objectives: $('over-objectives')
    };
    this.menuEls = {
      best: $('menu-best'), lvl: $('menu-level'), lvlFill: $('menu-xp-fill'), lvlText: $('menu-xp-text')
    };
    this.lastTextT = 0;
    this.dangerOn = false;
    this.lockOn = false;
    this.lastChipStr = '';
  }

  hideSplash() { this.el.splash.style.display = 'none'; }

  layer(id) {
    const all = ['menu-main', 'menu-over', 'menu-hangar', 'menu-ach', 'menu-profile', 'menu-help', 'menu-settings', 'pause-overlay'];
    for (const k of all) this.el[k].classList.add('hidden');
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

  setLock(on) {
    if (this.lockOn === on) return;
    this.lockOn = on;
    this.el.reticle.classList.toggle('lock', on);
  }

  setGamepad(on) {
    this.el['gp-chip'].classList.toggle('hidden', !on);
  }

  banner(text) {
    const b = this.el.banner;
    b.textContent = text;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(this._bt);
    this._bt = setTimeout(() => b.classList.remove('show'), 2400);
  }

  tutorialCard(text, keys, step, total) {
    const c = this.el['tut-card'];
    this.el['tut-text'].textContent = text;
    this.el['tut-keys'].textContent = keys ? 'CONTROLS: ' + keys : '';
    let dots = '';
    for (let i = 0; i < total; i++) dots += '<span class="dot' + (i < step ? ' done' : i === step ? ' cur' : '') + '"></span>';
    this.el['tut-dots'].innerHTML = dots;
    c.classList.remove('hidden');
    c.classList.remove('pop');
    void c.offsetWidth;
    c.classList.add('pop');
  }

  tutorialHide() {
    this.el['tut-card'].classList.add('hidden');
  }

  hintBar(text, secs) {
    const h = this.el['hint-bar'];
    h.textContent = text;
    h.classList.add('show');
    clearTimeout(this._ht);
    this._ht = setTimeout(() => h.classList.remove('show'), (secs || 12) * 1000);
  }

  setBoostFx(on) {
    this.el['boost-fx'].classList.toggle('on', on);
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

  updateHUD(state, now) {
    const h = this.el['hull-bar'];
    h.style.transform = 'scaleX(' + Math.max(0, state.hull / state.maxHull) + ')';
    this.el['energy-bar'].style.transform = 'scaleX(' + (state.energy / 100) + ')';
    this.el['heat-bar'].style.transform = 'scaleX(' + Math.min(1, state.heat) + ')';
    this.el['heat-wrap'].classList.toggle('hot', state.overheat > 0);

    if (now - this.lastTextT < 100) return;
    this.lastTextT = now;

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
    this.el.sector.textContent = state.sectorName;
    this.el['hull-bar'].classList.toggle('low', state.hull < 30);
    this.el['hull-num'].textContent = Math.max(0, Math.ceil(state.hull)) + '%';
    this.el['heat-num'].textContent = state.overheat > 0 ? 'COOLING' : Math.round(state.heat * 100) + '%';
    document.body.classList.toggle('critical', state.hull < 30);

    let chips = '';
    if (state.shield > 0) chips += '<span class="chip-s shield">SHIELD x' + state.shield + '</span>';
    if (state.mult2T > 0) chips += '<span class="chip-s multi">x2 ' + Math.ceil(state.mult2T) + 's</span>';
    if (state.overdriveT > 0) chips += '<span class="chip-s surge">SURGE ' + Math.ceil(state.overdriveT) + 's</span>';
    if (chips !== this.lastChipStr) {
      this.lastChipStr = chips;
      this.el['status-chips'].innerHTML = chips;
    }
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
      else if (d.type === 'pup') { col = '#ffd76b'; sz = 2.6; }
      else if (d.type === 'comet') { col = '#aef1ff'; sz = 3; }
      else if (d.type === 'tank') { col = '#ff8a5a'; sz = 2.8; }
      else if (d.type === 'sat') { col = '#9ab0c8'; sz = 2.8; }
      else if (d.type === 'mine') { col = '#ff4a4a'; sz = 2.6; }
      else if (d.type === 'art') { col = '#e6d2ff'; sz = 3.2; }
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

  renderProfile(save) {
    const s = save.stats;
    const hours = (s.playtime / 3600).toFixed(1);
    $('profile-stats').innerHTML = `
      <div><span>RUNS FLOWN</span><b>${s.runs}</b></div>
      <div><span>TOTAL DISTANCE</span><b>${(s.dist / 1000).toFixed(1)} KM</b></div>
      <div><span>FLIGHT TIME</span><b>${hours} H</b></div>
      <div><span>CRYSTALS</span><b>${s.crystals}</b></div>
      <div><span>GATES</span><b>${s.gates}</b></div>
      <div><span>ASTEROIDS DESTROYED</span><b>${s.kills}</b></div>
      <div><span>NEAR MISSES</span><b>${s.nearMisses}</b></div>
      <div><span>WELLS ESCAPED</span><b>${s.escapes}</b></div>
      <div><span>POWER-UPS</span><b>${s.powerups}</b></div>
      <div><span>BEST SCORE</span><b>${Math.floor(save.best).toLocaleString()}</b></div>`;
    const runs = $('profile-runs');
    runs.innerHTML = '';
    if (!save.runs.length) {
      runs.innerHTML = '<div class="run-row empty">NO RUNS RECORDED YET — LAUNCH A MISSION</div>';
      return;
    }
    save.runs.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'run-row' + (i === 0 ? ' top' : '');
      row.innerHTML = `<span class="rk">#${i + 1}</span><span class="rs">${Math.floor(r.score).toLocaleString()}</span><span class="rd">${(r.dist / 1000).toFixed(2)} KM</span><span class="rt">${r.date}</span>`;
      runs.appendChild(row);
    });
  }

  renderObjectives(container, objectives) {
    if (!container) return;
    container.innerHTML = '<div class="obj-title">RUN OBJECTIVES</div>';
    for (const o of objectives) {
      const row = document.createElement('div');
      row.className = 'obj-row' + (o.done ? ' done' : '');
      row.innerHTML = `<span class="obj-check">${o.done ? '&#10003;' : '&#9678;'}</span> ${o.label}`;
      container.appendChild(row);
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
      <div><span>KILLS</span><b>${data.kills}</b></div>
      <div><span>NEAR MISSES</span><b>${data.nearMisses}</b></div>
      <div><span>MAX COMBO</span><b>x${data.maxCombo}</b></div>`;
    this.renderObjectives(this.overEls.objectives, data.objectives);
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

    const unl = this.overEls.unlocks;
    unl.innerHTML = '';
    if (data.unlocks.length) {
      unl.innerHTML = '<div class="unlock-title">NEW UNLOCKS</div>' +
        data.unlocks.map(u => `<div class="unlock-item" style="--c:${u.glow}">${u.name} SHIP SKIN</div>`).join('');
    }
    this.layer('menu-over');
  }
}
