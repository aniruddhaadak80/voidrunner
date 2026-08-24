import * as THREE from 'three';
import { NOISE_GLSL } from './fx.js';

export const SPAWN_Z = -1550;
export const DESPAWN_Z = 70;

const PLANET_PALETTES = [
  ['#7a5c3a', '#a5793f', '#5d4426'],
  ['#3a6ea5', '#5b93c9', '#274b73'],
  ['#8a4b3a', '#c47a4e', '#5e3328'],
  ['#4b7a52', '#79a884', '#2f5638'],
  ['#7a6a8a', '#a894bd', '#514361'],
  ['#b09060', '#d9bc85', '#7d6438']
];

function planetTexture(seed) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const pal = PLANET_PALETTES[seed % PLANET_PALETTES.length];
  const bands = 9 + (seed % 5);
  for (let i = 0; i < bands; i++) {
    const y0 = (i / bands) * 128;
    const h = 128 / bands + Math.random() * 10;
    g.fillStyle = pal[i % pal.length];
    g.globalAlpha = 0.55 + Math.random() * 0.45;
    g.fillRect(0, y0, 256, h + 2);
  }
  g.globalAlpha = 0.16;
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 128;
    const r = 2 + Math.random() * 16;
    g.fillStyle = Math.random() < 0.5 ? pal[(Math.random() * 3) | 0] : '#ffffff';
    g.beginPath();
    g.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2);
    g.fill();
  }
  if (seed % 3 === 0) {
    g.globalAlpha = 0.75;
    g.fillStyle = '#eef4ff';
    g.fillRect(0, 0, 256, 12);
    g.fillRect(0, 116, 256, 12);
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function haloTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 40, 128, 128, 128);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.42, 'rgba(255,190,120,0.05)');
  grad.addColorStop(0.58, 'rgba(255,170,90,0.28)');
  grad.addColorStop(0.72, 'rgba(180,110,220,0.12)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function glowSprite(colorHex, scale) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, colorHex);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const sp = new THREE.Sprite(mat);
  sp.scale.setScalar(scale);
  return sp;
}

function displacedRock() {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const kx = Math.round(x * 8) / 8, ky = Math.round(y * 8) / 8, kz = Math.round(z * 8) / 8;
    let h = Math.sin(kx * 12.9898 + ky * 78.233 + kz * 37.719) * 43758.5453;
    h = h - Math.floor(h);
    const s = 0.72 + h * 0.62;
    pos.setXYZ(i, x * s, y * s, z * s);
  }
  geo.computeVertexNormals();
  return geo;
}

const DISK_FRAG = NOISE_GLSL + `
uniform float uTime; uniform float uInner; uniform float uOuter;
varying vec2 vPos;
void main(){
  float r = length(vPos);
  float t = clamp((r-uInner)/(uOuter-uInner), 0.0, 1.0);
  float ang = atan(vPos.y, vPos.x);
  float streak = fbm(vec2(ang*3.0 + uTime*(1.9-t*1.2), t*7.0 - uTime*0.55));
  float bright = mix(2.4, 0.12, pow(t, 0.65));
  bright *= 0.55 + 0.75*streak;
  float alpha = mix(0.85, 0.0, pow(t, 0.8)) * (0.35+0.65*streak);
  vec3 col = mix(vec3(1.0,0.92,0.72), vec3(0.85,0.32,0.08), pow(t,0.5));
  col = mix(col, vec3(0.35,0.12,0.30), t*t*0.8);
  gl_FragColor = vec4(col*bright, alpha);
}`;

const DISK_VERT = `
varying vec2 vPos;
void main(){
  vPos = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

function makeBH(horizon) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(horizon, 32, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  group.add(core);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(horizon * 1.06, horizon * 0.05, 10, 64),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.9, 1.15), toneMapped: false })
  );
  group.add(ring);

  const diskMat = new THREE.ShaderMaterial({
    vertexShader: DISK_VERT,
    fragmentShader: DISK_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uInner: { value: horizon * 1.25 },
      uOuter: { value: horizon * 3.6 }
    }
  });
  const disk = new THREE.Mesh(new THREE.RingGeometry(horizon * 1.25, horizon * 3.6, 96, 1), diskMat);
  disk.rotation.x = -Math.PI / 2 + 0.22;
  group.add(disk);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: haloTexture(), transparent: true, opacity: 0.85,
    depthWrite: false, blending: THREE.AdditiveBlending
  }));
  halo.scale.setScalar(horizon * 8.5);
  group.add(halo);

  return { group, diskMat };
}

function makePlanet(radius, seed) {
  const group = new THREE.Group();
  const tex = planetTexture(seed);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.92,
    metalness: 0.02,
    emissive: new THREE.Color(PLANET_PALETTES[seed % PLANET_PALETTES.length][1]),
    emissiveIntensity: seed % 4 === 0 ? 0.22 : 0.06
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 40, 28), mat);
  group.add(body);

  const atmoCol = new THREE.Color().setHSL(0.5 + ((seed % 7) / 14), 0.7, 0.6);
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.06, 32, 20),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: atmoCol } },
      vertexShader: `
        varying vec3 vN; varying vec3 vW;
        void main(){
          vN = normalize(normalMatrix * normal);
          vec4 wp = modelMatrix * vec4(position,1.0);
          vW = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        uniform vec3 uColor; varying vec3 vN; varying vec3 vW;
        void main(){
          vec3 v = normalize(cameraPosition - vW);
          float f = pow(1.0 - abs(dot(normalize(vN), v)), 3.0);
          gl_FragColor = vec4(uColor * f * 1.5, f * 0.9);
        }`
    })
  );
  group.add(atmo);

  let rings = null;
  if (seed % 3 === 1 && radius > 30) {
    const ringGeo = new THREE.RingGeometry(radius * 1.45, radius * 2.3, 80, 1);
    const ringMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uIn: { value: radius * 1.45 }, uOut: { value: radius * 2.3 } },
      vertexShader: `
        varying vec2 vPos;
        void main(){ vPos = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform float uIn; uniform float uOut; varying vec2 vPos;
        void main(){
          float r = length(vPos);
          float t = (r-uIn)/(uOut-uIn);
          float stripes = 0.5 + 0.5*sin(t*46.0) * sin(t*17.0+1.7);
          float a = smoothstep(0.0,0.12,t)*smoothstep(1.0,0.82,t)*(0.16+stripes*0.34);
          gl_FragColor = vec4(vec3(0.75,0.68,0.58), a);
        }`
    });
    rings = new THREE.Mesh(ringGeo, ringMat);
    rings.rotation.x = Math.PI / 2 - 0.3;
    group.add(rings);
  }

  let moon = null;
  if (seed % 4 === 2) {
    moon = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(1.6, radius * 0.09), 14, 10),
      new THREE.MeshStandardMaterial({ color: 0x9a9aa5, roughness: 1 })
    );
    group.add(moon);
  }
  return { group, body, rings, moon, moonR: radius * 1.9 };
}

export class World {
  constructor(ctx) {
    this.ctx = ctx;
    this.scene = ctx.scene;
    this.entities = [];
    this.pools = {};
    this.frontier = -420;
    this.spawnedCount = 0;
    this.radarData = [];
    this.elapsed = 0;

    this.rocks = [displacedRock(), displacedRock(), displacedRock()];
    this.rockMat = new THREE.MeshStandardMaterial({ color: 0x8a7f72, roughness: 0.95, metalness: 0.05, flatShading: true });
    this.crystalGeo = new THREE.OctahedronGeometry(1.15, 0);
    this.crystalMat = new THREE.MeshStandardMaterial({
      color: 0x18e0ff, emissive: 0x2ae8ff, emissiveIntensity: 2.6,
      roughness: 0.15, metalness: 0.1
    });
    this.gateGeo = new THREE.TorusGeometry(16, 1.05, 10, 48);
    this.gateMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 2.2, 0.9), toneMapped: false });
    this.planetSeed = 1;
  }

  acquire(type) {
    const pool = this.pools[type] || (this.pools[type] = []);
    let e = pool.find(p => !p.alive);
    if (!e) {
      e = this.factories[type]();
      this.scene.add(e.mesh);
      pool.push(e);
    }
    e.alive = true;
    e.mesh.visible = true;
    e.prevRel = null;
    e.passed = false;
    e.pulling = false;
    this.entities.push(e);
    return e;
  }

  release(e) {
    e.alive = false;
    e.mesh.visible = false;
  }

  factories = {
    ast: () => {
      const mesh = new THREE.Mesh(this.rocks[(Math.random() * 3) | 0], this.rockMat);
      return { type: 'ast', mesh, r: 3, scale: 1, vx: 0, vy: 0, rv: 0 };
    },
    cry: () => {
      const mesh = new THREE.Mesh(this.crystalGeo, this.crystalMat);
      const glow = glowSprite('rgba(70,230,255,0.55)', 7);
      mesh.add(glow);
      return { type: 'cry', mesh, r: 2.4, baseY: 0, phase: 0 };
    },
    gate: () => ({ type: 'gate', mesh: new THREE.Mesh(this.gateGeo, this.gateMat), r: 16 }),
    planet: () => {
      const built = makePlanet(30, 1);
      return { type: 'planet', mesh: built.group, body: built.body, rings: built.rings, moon: built.moon, moonR: built.moonR, r: 30 };
    },
    bh: () => {
      const built = makeBH(13);
      return { type: 'bh', mesh: built.group, diskMat: built.diskMat, r: 13, horizon: 13, influence: 230 };
    }
  };

  reset() {
    for (const e of this.entities) this.release(e);
    this.entities.length = 0;
    this.frontier = -420;
    this.spawnedCount = 0;
    this.radarData.length = 0;
  }

  tier(dist) {
    return Math.min(4, Math.floor(dist / 1400));
  }

  pick(tier) {
    const w = [
      [0.45, 0.35, 0.12, 0.08, 0.00],
      [0.40, 0.28, 0.14, 0.12, 0.06],
      [0.36, 0.24, 0.14, 0.14, 0.12],
      [0.34, 0.22, 0.14, 0.14, 0.16],
      [0.32, 0.20, 0.14, 0.14, 0.20]
    ][tier];
    if (this.spawnedCount < 3) return Math.random() < 0.6 ? 'cry' : 'ast';
    let roll = Math.random();
    const names = ['ast', 'cry', 'gate', 'planet', 'bh'];
    for (let i = 0; i < names.length; i++) {
      roll -= w[i];
      if (roll <= 0) return names[i];
    }
    return 'ast';
  }

  spawnPattern(z, tier) {
    const kind = this.pick(tier);
    this.spawnedCount++;
    switch (kind) {
      case 'ast': {
        if (Math.random() < 0.25 && tier > 0) { this.spawnWall(z); return 10; }
        const n = 5 + tier * 2 + ((Math.random() * 4) | 0);
        for (let i = 0; i < n; i++) {
          const e = this.acquire('ast');
          const s = 2.2 + Math.random() * 4.6;
          e.scale = s;
          e.r = s * 1.12;
          e.mesh.scale.setScalar(s);
          e.mesh.position.set((Math.random() - 0.5) * 280, (Math.random() - 0.5) * 175, z - Math.random() * 80);
          e.vx = (Math.random() - 0.5) * 4;
          e.vy = (Math.random() - 0.5) * 4;
          e.rv = (Math.random() - 0.5) * 1.6;
          e.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        }
        return 85;
      }
      case 'cry': {
        if (Math.random() < 0.3) { this.spawnCrystalRing(z); return 30; }
        const n = 8 + ((Math.random() * 6) | 0);
        const x0 = (Math.random() - 0.5) * 170;
        const y0 = (Math.random() - 0.5) * 110;
        const ampX = 15 + Math.random() * 40;
        const ampY = 10 + Math.random() * 26;
        const ph = Math.random() * 6.28;
        for (let i = 0; i < n; i++) {
          const e = this.acquire('cry');
          const x = THREE.MathUtils.clamp(x0 + Math.sin(i * 0.55 + ph) * ampX, -138, 138);
          const y = THREE.MathUtils.clamp(y0 + Math.cos(i * 0.42 + ph) * ampY, -86, 86);
          e.mesh.position.set(x, y, z - i * 13);
          e.baseY = y;
          e.phase = ph + i;
        }
        return n * 13 + 20;
      }
      case 'gate': {
        const e = this.acquire('gate');
        e.r = 16;
        e.mesh.position.set((Math.random() - 0.5) * 150, (Math.random() - 0.5) * 95, z);
        return 10;
      }
      case 'planet': {
        const e = this.acquire('planet');
        this.planetSeed++;
        const dwarf = Math.random() < 0.28;
        const radius = dwarf ? 11 + Math.random() * 7 : 26 + Math.random() * 38;
        const side = Math.random() < 0.5 ? -1 : 1;
        const px = dwarf ? side * (46 + Math.random() * 60) : side * (165 + Math.random() * 90);
        const py = dwarf ? (Math.random() - 0.5) * 100 : (Math.random() - 0.5) * 160;
        e.mesh.position.set(px, py, z);
        e.r = radius;
        e.body.scale.setScalar(radius / 30);
        e.moonR = radius * 1.9;
        if (e.moon) e.moon.scale.setScalar(Math.max(0.5, radius / 30));
        e.spin = 0.04 + Math.random() * 0.08;
        e.moonAng = Math.random() * 6.28;
        return radius * 2 + 24;
      }
      case 'bh': {
        const e = this.acquire('bh');
        const hz = 11 + Math.random() * 6;
        e.horizon = hz;
        e.r = hz;
        e.influence = 235;
        e.diskMat.uniforms.uInner.value = hz * 1.25;
        e.diskMat.uniforms.uOuter.value = hz * 3.6;
        e.mesh.scale.setScalar(hz / 13);
        e.mesh.position.set((Math.random() - 0.5) * 165, (Math.random() - 0.5) * 105, z);
        return 65;
      }
    }
    return 60;
  }

  spawnWall(z) {
    const tier = this.tier(this.ctx.state.dist);
    const gapX = (Math.random() - 0.5) * 180;
    const gapY = (Math.random() - 0.5) * 110;
    const gapR = Math.max(34, 50 - tier * 3);
    for (let x = -144; x <= 144; x += 29) {
      for (let y = -91; y <= 91; y += 30) {
        if (Math.hypot(x - gapX, y - gapY) < gapR) continue;
        if (Math.random() < 0.12) continue;
        const e = this.acquire('ast');
        const s = 4.6 + Math.random() * 2.6;
        e.scale = s;
        e.r = s * 1.1;
        e.mesh.scale.setScalar(s);
        e.mesh.position.set(x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8, z);
        e.vx = 0; e.vy = 0;
        e.rv = (Math.random() - 0.5) * 0.7;
        e.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      }
    }
  }

  spawnCrystalRing(z) {
    const cx = (Math.random() - 0.5) * 120;
    const cy = (Math.random() - 0.5) * 80;
    const rr = 15 + Math.random() * 11;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const e = this.acquire('cry');
      e.mesh.position.set(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, z);
      e.baseY = cy + Math.sin(a) * rr;
      e.phase = i * 0.7;
    }
  }

  update(dt, godmode) {
    const st = this.ctx.state;
    const shipPos = this.ctx.ship.group.position;
    const shipR = this.ctx.ship.r;
    const sp = st.speed;
    this.elapsed += dt;
    this.frontier += sp * dt;
    while (this.frontier > SPAWN_Z) {
      const depth = this.spawnPattern(this.frontier, this.tier(st.dist));
      this.frontier -= depth + Math.max(58, 132 - this.tier(st.dist) * 14);
    }

    this.radarData.length = 0;
    let nearestBH = null;

    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      const p = e.mesh.position;
      p.z += sp * dt;
      let remove = false;

      switch (e.type) {
        case 'ast':
          p.x += e.vx * dt;
          p.y += e.vy * dt;
          e.mesh.rotation.x += e.rv * dt * 0.4;
          e.mesh.rotation.y += e.rv * dt * 0.6;
          if (!godmode) {
            const relA = p.z - shipPos.z;
            if (e.prevRel !== null && e.prevRel < 0 && relA >= 0) {
              const dl = Math.hypot(p.x - shipPos.x, p.y - shipPos.y);
              const hr = e.r + shipR;
              if (dl > hr && dl < hr + 10) this.ctx.cb.onNearMiss(p, 'ast');
            }
            e.prevRel = relA;
          }
          break;

        case 'cry': {
          e.mesh.rotation.y += dt * 2.4;
          p.y = e.baseY + Math.sin(this.elapsed * 2 + e.phase) * 1.4;
          if (!godmode) {
            const d = p.distanceTo(shipPos);
            if (d < 19) p.lerp(shipPos, Math.min(1, dt * 9));
            if (d < shipR + 2.8) { this.ctx.cb.onCrystal(e); remove = true; }
          }
          break;
        }

        case 'gate': {
          e.mesh.rotation.z += dt * 0.8;
          if (!godmode) {
            const rel = p.z - shipPos.z;
            if (e.prevRel !== null && !e.passed && e.prevRel < 0 && rel >= 0) {
              e.passed = true;
              const dl = Math.hypot(p.x - shipPos.x, p.y - shipPos.y);
              if (dl < 13) this.ctx.cb.onGate(e);
            }
            e.prevRel = rel;
          }
          break;
        }

        case 'planet': {
          e.body.rotation.y += e.spin * dt;
          if (e.moon) {
            e.moonAng += dt * 0.5;
            e.moon.position.set(Math.cos(e.moonAng) * e.moonR, Math.sin(e.moonAng * 0.9) * 4, Math.sin(e.moonAng) * e.moonR);
          }
          if (!godmode) {
            const d = p.distanceTo(shipPos);
            const hitR = e.r * 0.96 + shipR;
            if (d < hitR) {
              const n = new THREE.Vector3().subVectors(shipPos, p).normalize();
              shipPos.addScaledVector(n, hitR - d + 0.5);
              this.ctx.cb.onHitPlanet(n);
            } else {
              const rel = p.z - shipPos.z;
              if (e.prevRel !== null && e.prevRel < 0 && rel >= 0) {
                const dl = Math.hypot(p.x - shipPos.x, p.y - shipPos.y);
                if (dl > hitR && dl < hitR + e.r * 0.5 + 12) this.ctx.cb.onNearMiss(e.mesh.position, 'planet');
              }
              e.prevRel = rel;
            }
          }
          break;
        }

        case 'bh': {
          e.diskMat.uniforms.uTime.value = this.elapsed;
          e.mesh.rotation.y += dt * 0.05;
          if (!godmode) {
            const dx = shipPos.x - p.x;
            const dy = shipPos.y - p.y;
            const dz = shipPos.z - p.z;
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (d < e.horizon + shipR * 0.4) {
              this.ctx.cb.onBHDeath(p);
              return;
            }
            if (d < e.influence) {
              const pull = Math.min(240, 800000 / (d * d + 400));
              this.ctx.ship.vel.x -= (dx / d) * pull * dt;
              this.ctx.ship.vel.y -= (dy / d) * pull * dt;
              if (d < e.influence * 0.7) e.pulling = true;
              if (nearestBH === null || d < nearestBH.d) nearestBH = { d, horizon: e.horizon, influence: e.influence };
            } else if (e.pulling && d >= e.influence) {
              e.pulling = false;
              this.ctx.cb.onEscape();
            }
            const rel = p.z - shipPos.z;
            if (e.prevRel !== null && e.prevRel < 0 && rel >= 0) {
              const dl = Math.hypot(dx, dy);
              const hr = e.horizon + shipR;
              if (dl > hr && dl < hr + 16) this.ctx.cb.onNearMiss(p, 'bh');
            }
            e.prevRel = rel;
          }
          break;
        }
      }

      if (p.z > DESPAWN_Z) remove = true;
      if (remove) {
        this.release(e);
        const last = this.entities.pop();
        if (last !== e && i < this.entities.length) this.entities[i] = last;
        continue;
      }

      if (!godmode && Math.abs(p.z - shipPos.z) < 900 && p.z < 40) {
        if (Math.abs(p.x) < 420) {
          this.radarData.push({ x: p.x, z: p.z, type: e.type, r: e.r });
        }
      }
    }

    st.bhDanger = nearestBH;
  }
}
