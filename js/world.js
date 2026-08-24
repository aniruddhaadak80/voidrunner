import * as THREE from 'three';
import { NOISE_GLSL } from './fx.js';

export const SPAWN_Z = -1550;
export const DESPAWN_Z = 70;
export const MAX_AST = 150;
export const MAX_CRY = 110;
const W = 150, H = 95;

const PLANET_PALETTES = [
  ['#7a5c3a', '#a5793f', '#5d4426'],
  ['#3a6ea5', '#5b93c9', '#274b73'],
  ['#8a4b3a', '#c47a4e', '#5e3328'],
  ['#4b7a52', '#79a884', '#2f5638'],
  ['#7a6a8a', '#a894bd', '#514361'],
  ['#b09060', '#d9bc85', '#7d6438']
];

const PUP_DEFS = {
  shield: { color: '#4ab8ff', label: 'SHIELD' },
  repair: { color: '#57ff9a', label: 'REPAIR' },
  surge:  { color: '#ffd76b', label: 'SURGE' },
  multi:  { color: '#c07aff', label: 'SCORE x2' }
};

function planetTexture(seed) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const pal = PLANET_PALETTES[seed % PLANET_PALETTES.length];
  const bands = 9 + (seed % 5);
  for (let i = 0; i < bands; i++) {
    const y0 = (i / bands) * 128;
    const h = 128 / bands + this.rand() * 10;
    g.fillStyle = pal[i % pal.length];
    g.globalAlpha = 0.55 + this.rand() * 0.45;
    g.fillRect(0, y0, 256, h + 2);
  }
  g.globalAlpha = 0.16;
  for (let i = 0; i < 260; i++) {
    const x = this.rand() * 256;
    const y = this.rand() * 128;
    const r = 2 + this.rand() * 16;
    g.fillStyle = this.rand() < 0.5 ? pal[(this.rand() * 3) | 0] : '#ffffff';
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

function makeLabel(text, colorHex) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = '700 30px Orbitron, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = colorHex;
  g.shadowBlur = 12;
  g.fillStyle = '#ffffff';
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(8, 2, 1);
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

const ORBIT_VERT = `
attribute float aR; attribute float aA; attribute float aY; attribute float aS;
uniform float uTime;
varying float vFade;
void main(){
  float ang = aA + uTime * aS;
  vec3 p = vec3(cos(ang)*aR, aY, sin(ang)*aR);
  vFade = 0.5 + 0.5*sin(ang*2.0 + aA*7.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = 2.2 * (300.0 / max(-mv.z, 1.0));
}`;

const ORBIT_FRAG = `
varying float vFade;
void main(){
  vec2 uv = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.1, length(uv));
  gl_FragColor = vec4(1.0, 0.62, 0.3, a * 0.55 * vFade);
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

  const orbitGeo = new THREE.BufferGeometry();
  const N = 130;
  const aR = new Float32Array(N), aA = new Float32Array(N), aY = new Float32Array(N), aS = new Float32Array(N);
  const posArr = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    aR[i] = horizon * (1.35 + this.rand() * 1.5);
    aA[i] = this.rand() * Math.PI * 2;
    aY[i] = (this.rand() - 0.5) * horizon * 0.35;
    aS[i] = (0.6 + this.rand() * 1.4) * (horizon * 1.35) / aR[i];
  }
  orbitGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  orbitGeo.setAttribute('aR', new THREE.BufferAttribute(aR, 1));
  orbitGeo.setAttribute('aA', new THREE.BufferAttribute(aA, 1));
  orbitGeo.setAttribute('aY', new THREE.BufferAttribute(aY, 1));
  orbitGeo.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
  const orbits = new THREE.Points(orbitGeo, new THREE.ShaderMaterial({
    vertexShader: ORBIT_VERT,
    fragmentShader: ORBIT_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } }
  }));
  orbits.frustumCulled = false;
  orbits.rotation.x = -Math.PI / 2 + 0.22;
  group.add(orbits);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: haloTexture(), transparent: true, opacity: 0.85,
    depthWrite: false, blending: THREE.AdditiveBlending
  }));
  halo.scale.setScalar(horizon * 8.5);
  group.add(halo);

  return { group, diskMat, orbitMat: orbits.material };
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
    this.rand = Math.random;
    this.modifier = null;
    this.magnetR = 19;
    this.ctx = ctx;
    this.scene = ctx.scene;
    this.frontier = -420;
    this.spawnedCount = 0;
    this.radarData = [];
    this.elapsed = 0;
    this.planetSeed = 1;

    this.rockGeo = displacedRock();
    this.rockMat = new THREE.MeshStandardMaterial({ color: 0x8a7f72, roughness: 0.95, metalness: 0.05, flatShading: true });
    this.astMesh = new THREE.InstancedMesh(this.rockGeo, this.rockMat, MAX_AST);
    this.astMesh.frustumCulled = false;
    this.astMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.astMesh.count = 0;
    this.scene.add(this.astMesh);

    this.crystalMat = new THREE.MeshStandardMaterial({
      color: 0x18e0ff, emissive: 0x2ae8ff, emissiveIntensity: 2.6,
      roughness: 0.15, metalness: 0.1
    });
    this.cryMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1.15, 0), this.crystalMat, MAX_CRY);
    this.cryMesh.frustumCulled = false;
    this.cryMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cryMesh.count = 0;
    this.scene.add(this.cryMesh);

    this.asts = [];
    this.crys = [];
    this.pups = [];
    this.comets = [];
    this.gates = [];
    this.planets = [];
    this.bhs = [];
    this.pools = { gate: [], planet: [], bh: [], pup: [], comet: [] };

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();

    this.gateGeo = new THREE.TorusGeometry(16, 1.05, 10, 48);
    this.gateMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 2.2, 0.9), toneMapped: false });
    this.pupGeos = {
      shield: new THREE.IcosahedronGeometry(1.5, 1),
      repair: new THREE.OctahedronGeometry(1.5, 0),
      surge: new THREE.OctahedronGeometry(1.2, 0),
      multi: new THREE.TetrahedronGeometry(1.7, 0)
    };
    this.pupMats = {};
    for (const k in PUP_DEFS) {
      this.pupMats[k] = new THREE.MeshBasicMaterial({ color: new THREE.Color(PUP_DEFS[k].color), toneMapped: false });
    }
    this.cometGeo = displacedRock();
    this.cometMat = new THREE.MeshStandardMaterial({ color: 0xbfe8ff, emissive: 0x6fc8ff, emissiveIntensity: 1.6, roughness: 0.6, flatShading: true });
    this.tailLen = 18;

    this.buoyMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 1.7, 2.2), toneMapped: false });
    this.buoyMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 3.4, 0.7), this.buoyMat, 48);
    this.buoyMesh.frustumCulled = false;
    this.buoyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.buoyMesh.count = 48;
    this.scene.add(this.buoyMesh);
    this.buoyScroll = 0;

    this.shardMat = new THREE.MeshStandardMaterial({
      color: 0x9fd8ff, emissive: 0x4a90c8, emissiveIntensity: 0.7,
      roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.75
    });
    this.shardMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), this.shardMat, 36);
    this.shardMesh.frustumCulled = false;
    this.shardMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shardMesh.count = 0;
    this.scene.add(this.shardMesh);

    this.tanks = [];
    this.sats = [];
    this.mines = [];
    this.shardEnts = [];
    this.artifacts = [];
    this.pools.tank = [];
    this.pools.sat = [];
    this.pools.mine = [];
    this.pools.art = [];
    this.tutorialKinds = null;
    this.station = null;

    this.tankMatBody = new THREE.MeshStandardMaterial({ color: 0xc04838, roughness: 0.5, metalness: 0.4 });
    this.tankMatBand = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.7 });
    this.satMatBody = new THREE.MeshStandardMaterial({ color: 0x8a92a5, roughness: 0.4, metalness: 0.8 });
    this.satMatPanel = new THREE.MeshStandardMaterial({ color: 0x1c3a66, emissive: 0x16325c, emissiveIntensity: 0.9, roughness: 0.3 });
    this.mineMatCore = new THREE.MeshStandardMaterial({ color: 0x303038, roughness: 0.6, metalness: 0.7, flatShading: true });
    this.mineMatSpike = new THREE.MeshStandardMaterial({ color: 0x585864, roughness: 0.5, metalness: 0.8, flatShading: true });
    this.artMatMono = new THREE.MeshStandardMaterial({ color: 0x14141f, roughness: 0.25, metalness: 0.85 });
  }

  acquire(list, poolKey, maker) {
    const pool = this.pools[poolKey];
    let e = pool.find(p => !p.alive);
    if (!e) {
      e = maker();
      this.scene.add(e.mesh);
      pool.push(e);
    }
    e.alive = true;
    e.mesh.visible = true;
    list.push(e);
    return e;
  }

  release(e) {
    e.alive = false;
    e.mesh.visible = false;
  }

  makeGate() {
    return { kind: 'gate', mesh: new THREE.Mesh(this.gateGeo, this.gateMat), r: 16, prevRel: null, passed: false, alive: false };
  }

  makePlanet() {
    const built = makePlanet(30, 1);
    return { kind: 'planet', mesh: built.group, body: built.body, rings: built.rings, moon: built.moon, moonR: built.moonR, r: 30, prevRel: null, alive: false };
  }

  makeBH() {
    const built = makeBH(13);
    return { kind: 'bh', mesh: built.group, diskMat: built.diskMat, orbitMat: built.orbitMat, r: 13, horizon: 13, influence: 235, prevRel: null, pulling: false, alive: false };
  }

  makePup() {
    const mesh = new THREE.Group();
    return { kind: 'pup', ptype: 'shield', mesh, core: null, label: null, spin: 0, alive: false };
  }

  makeComet() {
    const mesh = new THREE.Group();
    const head = new THREE.Mesh(this.cometGeo, this.cometMat);
    head.scale.setScalar(1.6);
    mesh.add(head);
    const glow = glowSprite('rgba(160,225,255,0.75)', 10);
    mesh.add(glow);
    const tailGeo = new THREE.BufferGeometry();
    tailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.tailLen * 3), 3));
    const tail = new THREE.Line(tailGeo, new THREE.LineBasicMaterial({
      color: 0x9fd8ff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    tail.frustumCulled = false;
    this.scene.add(tail);
    return { kind: 'comet', mesh, head, tail, ring: new Float32Array(this.tailLen * 3), tHead: 0, tCount: 0, vel: new THREE.Vector3(), hp: 2, r: 3.4, prevRel: null, alive: false };
  }

  makeTank() {
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 3.2, 14), this.tankMatBody);
    mesh.add(body);
    for (const y of [-0.9, 0.9]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(1.38, 0.12, 8, 20), this.tankMatBand);
      band.rotation.x = Math.PI / 2;
      band.position.y = y;
      mesh.add(band);
    }
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1.35, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), this.tankMatBand);
    cap.position.y = 1.6;
    mesh.add(cap);
    const glow = glowSprite('rgba(255,120,80,0.4)', 7);
    mesh.add(glow);
    return { kind: 'tank', mesh, r: 2.5, vx: 0, vy: 0, rx: 0, ry: 0, rv: 0, hp: 1, prevRel: null, alive: false };
  }

  makeSat() {
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.7, 2.3), this.satMatBody);
    mesh.add(body);
    for (const s of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.1, 1.7), this.satMatPanel);
      panel.position.x = s * 3.2;
      mesh.add(panel);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 0.12), this.satMatBody);
      arm.position.x = s * 1.35;
      mesh.add(arm);
    }
    const dish = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.6, 12, 1, true), this.satMatBody);
    dish.rotation.x = Math.PI / 2;
    dish.position.z = -1.5;
    mesh.add(dish);
    const blink = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowSprite('rgba(255,80,80,0.9)', 1).material.map,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    blink.scale.setScalar(2.2);
    blink.position.set(0, 1.2, 0);
    mesh.add(blink);
    return { kind: 'sat', mesh, blink, r: 3.6, vx: 0, vy: 0, rx: 0, ry: 0, rv: 0, hp: 2, prevRel: null, alive: false };
  }

  makeMine() {
    const mesh = new THREE.Group();
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 0), this.mineMatCore);
    mesh.add(core);
    for (let i = 0; i < 8; i++) {
      const th = (i / 8) * Math.PI * 2;
      const ph = Math.acos(2 * ((i % 4) / 3) - 1);
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1, 6), this.mineMatSpike);
      spike.position.set(Math.sin(ph) * Math.cos(th) * 1.5, Math.cos(ph) * 1.5, Math.sin(ph) * Math.sin(th) * 1.5);
      spike.rotation.set(this.rand() * 0.4 - 0.2 + ph, 0, -th + Math.PI / 2);
      spike.lookAt(0, 0, 0);
      spike.rotateX(-Math.PI / 2);
      mesh.add(spike);
    }
    const glow = glowSprite('rgba(255,70,70,0.55)', 6);
    mesh.add(glow);
    return { kind: 'mine', mesh, glow, r: 2.2, vx: 0, vy: 0, armed: false, prevRel: null, alive: false };
  }

  makeArtifact() {
    const mesh = new THREE.Group();
    const mono = new THREE.Mesh(new THREE.BoxGeometry(1.5, 7.5, 1.5), this.artMatMono);
    mesh.add(mono);
    for (const s of [-1, 1]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 7.5, 0.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.9, 2.6), toneMapped: false }));
      edge.position.set(s * 0.72, 0, s * 0.72);
      mesh.add(edge);
      const edge2 = edge.clone();
      edge2.position.set(s * 0.72, 0, -s * 0.72);
      mesh.add(edge2);
    }
    const hum = glowSprite('rgba(190,120,255,0.4)', 14);
    mesh.add(hum);
    return { kind: 'art', mesh, r: 3.5, scanned: false, alive: false };
  }

  spawnStation(side) {
    if (this.station) { this.scene.remove(this.station.group); this.station = null; }
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x5a6478, roughness: 0.5, metalness: 0.8 });
    const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.0, 2.4), toneMapped: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(55, 5, 10, 40), mat);
    group.add(ring);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(10, 14, 26, 12), mat);
    hub.rotation.x = Math.PI / 2;
    group.add(hub);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 52), mat);
      spoke.rotation.z = a;
      spoke.position.set(Math.cos(a) * 27, Math.sin(a) * 27, 0);
      spoke.rotation.z = a + Math.PI / 2;
      group.add(spoke);
      const light = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), glowMat);
      light.position.set(Math.cos(a) * 55, Math.sin(a) * 55, 5);
      group.add(light);
      group.userData['l' + i] = light;
    }
    const beacon = glowSprite(this.rgba('#57e6ff', 0.6), 40);
    group.add(beacon);
    group.position.set(side * 300, (this.rand() - 0.5) * 100, -1500);
    group.rotation.z = this.rand() * Math.PI;
    this.scene.add(group);
    this.station = { kind: 'station', group, alive: true, spin: 0.05 };
  }

  spawnAsteroid(x, y, z, s, vx, vy, rv, hp) {
    if (this.asts.length >= MAX_AST) {
      const idx = this.asts.findIndex(a => !a.alive);
      if (idx === -1) return null;
      this.asts.splice(idx, 1);
    }
    const dead = this.asts.find(a => !a.alive);
    const e = dead || { alive: false };
    e.alive = true;
    e.x = x; e.y = y; e.z = z;
    e.s = s; e.r = s * 1.12;
    e.vx = vx; e.vy = vy;
    e.rx = this.rand() * 3; e.ry = this.rand() * 3; e.rz = this.rand() * 3;
    e.rv = rv;
    e.hp = hp || 1;
    e.prevRel = null;
    if (!dead) this.asts.push(e);
    return e;
  }

  spawnCrystal(x, y, z, vx = 0, vy = 0) {
    if (this.crys.length >= MAX_CRY) {
      const idx = this.crys.findIndex(c => !c.alive);
      if (idx === -1) return null;
      this.crys.splice(idx, 1);
    }
    const dead = this.crys.find(c => !c.alive);
    const e = dead || { alive: false };
    e.alive = true;
    e.x = x; e.y = y; e.z = z;
    e.baseY = y;
    e.phase = this.rand() * 6.28;
    e.vx = vx; e.vy = vy;
    if (!dead) this.crys.push(e);
    return e;
  }

  spawnPup(x, y, z, kind) {
    const e = this.acquire(this.pups, 'pup', () => this.makePup());
    e.ptype = kind;
    while (e.mesh.children.length) e.mesh.remove(e.mesh.children[0]);
    e.core = new THREE.Mesh(this.pupGeos[kind], this.pupMats[kind]);
    e.mesh.add(e.core);
    e.glow = glowSprite(this.rgba(PUP_DEFS[kind].color, 0.5), 9);
    e.mesh.add(e.glow);
    if (e.label) e.mesh.remove(e.label);
    e.label = makeLabel(PUP_DEFS[kind].label, PUP_DEFS[kind].color);
    e.label.position.set(0, 2.6, 0);
    e.mesh.add(e.label);
    e.mesh.position.set(x, y, z);
    e.spin = 1.2 + this.rand();
    e.prevRel = null;
    return e;
  }

  rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  spawnComet(x, y, z) {
    const e = this.acquire(this.comets, 'comet', () => this.makeComet());
    e.mesh.position.set(x, y, z);
    e.vel.set((this.rand() < 0.5 ? -1 : 1) * (26 + this.rand() * 40), (this.rand() - 0.5) * 30, 30 + this.rand() * 45);
    e.hp = 2;
    e.r = 3.4;
    e.prevRel = null;
    e.tHead = 0;
    e.tCount = 0;
    const arr = e.tail.geometry.attributes.position.array;
    for (let i = 0; i < this.tailLen; i++) {
      arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
      e.ring[i * 3] = x; e.ring[i * 3 + 1] = y; e.ring[i * 3 + 2] = z;
    }
    e.tail.geometry.attributes.position.needsUpdate = true;
    return e;
  }

  setSeed(seed) {
    let a = seed >>> 0;
    this.rand = function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  setModifier(id) {
    this.modifier = id;
  }

  reset() {
    this.asts.length = 0;
    this.crys.length = 0;
    this.shardEnts.length = 0;
    for (const list of [this.pups, this.comets, this.gates, this.planets, this.bhs, this.tanks, this.sats, this.mines, this.artifacts]) {
      for (const e of list) this.release(e);
      list.length = 0;
    }
    if (this.station) { this.scene.remove(this.station.group); this.station = null; }
    this.astMesh.count = 0;
    this.cryMesh.count = 0;
    this.shardMesh.count = 0;
    this.frontier = -420;
    this.spawnedCount = 0;
    this.radarData.length = 0;
  }

  tier(dist) {
    return Math.min(4, Math.floor(dist / 1400));
  }

  pick(tier) {
    if (this.tutorialKinds) return this.tutorialKinds[(this.rand() * this.tutorialKinds.length) | 0];
    const w = [
      [34, 30, 10, 7, 6, 5, 4, 2, 2, 0, 0, 0],
      [28, 23, 10, 9, 5, 5, 5, 4, 4, 3, 3, 1],
      [24, 20, 10, 9, 5, 5, 5, 5, 4, 5, 6, 2],
      [21, 18, 10, 9, 5, 5, 5, 5, 4, 7, 9, 2],
      [18, 16, 10, 9, 5, 5, 5, 6, 4, 8, 12, 2]
    ][tier];
    let sum = 0;
    if (this.modifier === 'SWARM') { w[7] *= 3; w[9] *= 3; }
    for (const x of w) sum += x;
    let roll = this.rand() * sum;
    const names = ['ast', 'cry', 'gate', 'planet', 'shards', 'tank', 'sat', 'mine', 'pup', 'comet', 'bh', 'art'];
    for (let i = 0; i < names.length; i++) {
      roll -= w[i];
      if (roll <= 0) return names[i];
    }
    return 'ast';
  }

  spawnGateAt(x, y, z) {
    const e = this.acquire(this.gates, 'gate', () => this.makeGate());
    e.r = 16;
    e.passed = false;
    e.prevRel = null;
    e.mesh.position.set(x, y, z);
    return e;
  }

  spawnPattern(z, tier) {
    const kind = this.pick(tier);
    this.spawnedCount++;
    switch (kind) {
      case 'ast': {
        if (this.rand() < 0.25 && tier > 0) { this.spawnWall(z); return 12; }
        const n = 5 + tier * 2 + ((this.rand() * 4) | 0);
        for (let i = 0; i < n; i++) {
          const s = 2.2 + this.rand() * 4.6;
          this.spawnAsteroid(
            (this.rand() - 0.5) * 280, (this.rand() - 0.5) * 175, z - this.rand() * 80,
            s, (this.rand() - 0.5) * 4, (this.rand() - 0.5) * 4, (this.rand() - 0.5) * 1.6
          );
        }
        return 85;
      }
      case 'cry': {
        if (this.rand() < 0.3) { this.spawnCrystalRing(z); return 30; }
        const n = 8 + ((this.rand() * 6) | 0);
        const x0 = (this.rand() - 0.5) * 170;
        const y0 = (this.rand() - 0.5) * 110;
        const ampX = 15 + this.rand() * 40;
        const ampY = 10 + this.rand() * 26;
        const ph = this.rand() * 6.28;
        for (let i = 0; i < n; i++) {
          const x = THREE.MathUtils.clamp(x0 + Math.sin(i * 0.55 + ph) * ampX, -138, 138);
          const y = THREE.MathUtils.clamp(y0 + Math.cos(i * 0.42 + ph) * ampY, -86, 86);
          this.spawnCrystal(x, y, z - i * 13);
        }
        return n * 13 + 20;
      }
      case 'gate': {
        this.spawnGateAt((this.rand() - 0.5) * 150, (this.rand() - 0.5) * 95, z);
        return 10;
      }
      case 'shards': {
        const cx = (this.rand() - 0.5) * 200;
        const cy = (this.rand() - 0.5) * 130;
        const n = 8 + ((this.rand() * 7) | 0);
        for (let i = 0; i < n; i++) {
          const dead = this.shardEnts.find(s => !s.alive);
          const e = dead || { alive: false };
          e.alive = true;
          e.x = cx + (this.rand() - 0.5) * 90;
          e.y = cy + (this.rand() - 0.5) * 60;
          e.z = z - this.rand() * 130;
          e.s = 1.2 + this.rand() * 2.6;
          e.rx = this.rand() * 3; e.ry = this.rand() * 3;
          e.rv = (this.rand() - 0.5) * 0.8;
          if (!dead) this.shardEnts.push(e);
        }
        return 140;
      }
      case 'tank': {
        const e = this.acquire(this.tanks, 'tank', () => this.makeTank());
        e.mesh.position.set((this.rand() - 0.5) * 240, (this.rand() - 0.5) * 150, z);
        e.mesh.rotation.set(this.rand() * 3, this.rand() * 3, this.rand() * 3);
        e.vx = (this.rand() - 0.5) * 3;
        e.vy = (this.rand() - 0.5) * 3;
        e.rv = (this.rand() - 0.5) * 1.2;
        e.hp = 1;
        e.prevRel = null;
        return 30;
      }
      case 'sat': {
        const e = this.acquire(this.sats, 'sat', () => this.makeSat());
        e.mesh.position.set((this.rand() - 0.5) * 240, (this.rand() - 0.5) * 150, z);
        e.mesh.rotation.set(this.rand() * 3, this.rand() * 3, this.rand() * 3);
        e.vx = (this.rand() - 0.5) * 2;
        e.vy = (this.rand() - 0.5) * 2;
        e.rv = (this.rand() - 0.5) * 0.5;
        e.hp = 2;
        e.prevRel = null;
        return 30;
      }
      case 'mine': {
        const n = 2 + ((this.rand() * 3) | 0);
        const mx = (this.rand() - 0.5) * 200;
        const my = (this.rand() - 0.5) * 120;
        for (let i = 0; i < n; i++) {
          const e = this.acquire(this.mines, 'mine', () => this.makeMine());
          e.mesh.position.set(mx + (this.rand() - 0.5) * 60, my + (this.rand() - 0.5) * 50, z - i * 26);
          e.vx = (this.rand() - 0.5) * 2;
          e.vy = (this.rand() - 0.5) * 2;
          e.armed = false;
          e.prevRel = null;
        }
        return 26 * n + 20;
      }
      case 'art': {
        const e = this.acquire(this.artifacts, 'art', () => this.makeArtifact());
        e.mesh.position.set((this.rand() - 0.5) * 200, (this.rand() - 0.5) * 120, z);
        e.scanned = false;
        return 40;
      }
      case 'planet': {
        const e = this.acquire(this.planets, 'planet', () => this.makePlanet());
        this.planetSeed++;
        const dwarf = this.rand() < 0.28;
        const radius = dwarf ? 11 + this.rand() * 7 : 26 + this.rand() * 38;
        const side = this.rand() < 0.5 ? -1 : 1;
        const px = dwarf ? side * (46 + this.rand() * 60) : side * (165 + this.rand() * 90);
        const py = dwarf ? (this.rand() - 0.5) * 100 : (this.rand() - 0.5) * 160;
        e.mesh.position.set(px, py, z);
        e.r = radius;
        e.prevRel = null;
        e.body.scale.setScalar(radius / 30);
        e.moonR = radius * 1.9;
        if (e.moon) e.moon.scale.setScalar(Math.max(0.5, radius / 30));
        e.spin = 0.04 + this.rand() * 0.08;
        e.moonAng = this.rand() * 6.28;
        return radius * 2 + 24;
      }
      case 'comet': {
        const n = 1 + (this.rand() < 0.4 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          this.spawnComet((this.rand() - 0.5) * 260, (this.rand() - 0.5) * 160, z - i * 60);
        }
        return 40 + n * 40;
      }
      case 'pup': {
        const kinds = ['shield', 'repair', 'surge', 'multi'];
        const k = kinds[(this.rand() * kinds.length) | 0];
        this.spawnPup((this.rand() - 0.5) * 180, (this.rand() - 0.5) * 110, z, k);
        return 20;
      }
      case 'bh': {
        const e = this.acquire(this.bhs, 'bh', () => this.makeBH());
        const hz = 11 + this.rand() * 6;
        e.horizon = hz;
        e.r = hz;
        e.influence = 235;
        e.pulling = false;
        e.prevRel = null;
        e.diskMat.uniforms.uInner.value = hz * 1.25;
        e.diskMat.uniforms.uOuter.value = hz * 3.6;
        e.mesh.scale.setScalar(hz / 13);
        e.mesh.position.set((this.rand() - 0.5) * 165, (this.rand() - 0.5) * 105, z);
        return 65;
      }
    }
    return 60;
  }

  spawnWall(z) {
    const tier = this.tier(this.ctx.state.dist);
    const gapX = (this.rand() - 0.5) * 180;
    const gapY = (this.rand() - 0.5) * 110;
    const gapR = Math.max(34, 50 - tier * 3);
    for (let x = -144; x <= 144; x += 29) {
      for (let y = -91; y <= 91; y += 30) {
        if (Math.hypot(x - gapX, y - gapY) < gapR) continue;
        if (this.rand() < 0.12) continue;
        const s = 4.6 + this.rand() * 2.6;
        this.spawnAsteroid(
          x + (this.rand() - 0.5) * 8, y + (this.rand() - 0.5) * 8, z,
          s, 0, 0, (this.rand() - 0.5) * 0.7
        );
      }
    }
  }

  spawnCrystalRing(z) {
    const cx = (this.rand() - 0.5) * 120;
    const cy = (this.rand() - 0.5) * 80;
    const rr = 15 + this.rand() * 11;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.spawnCrystal(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, z);
    }
  }

  spawnDrop(pos) {
    const rich = this.modifier === 'RICH';
    const roll = this.rand();
    if (roll < (rich ? 0.7 : 0.55)) {
      this.spawnCrystal(pos.x, pos.y, pos.z, (this.rand() - 0.5) * 8, (this.rand() - 0.5) * 8);
    } else if (roll < (rich ? 0.95 : 0.85)) {
      const kinds = ['shield', 'repair', 'surge', 'multi'];
      this.spawnPup(pos.x, pos.y, pos.z, kinds[(this.rand() * 4) | 0]);
    }
  }

  killAst(e) {
    e.alive = false;
  }

  killComet(e) {
    e.alive = false;
    e.mesh.visible = false;
    e.tail.visible = false;
  }

  update(dt, godmode, bolts) {
    const st = this.ctx.state;
    const shipPos = this.ctx.ship.group.position;
    const shipR = this.ctx.ship.r;
    const sp = st.speed;
    this.elapsed += dt;
    this.frontier += sp * dt;
    while (this.frontier > SPAWN_Z) {
      const depth = this.spawnPattern(this.frontier, this.tier(st.dist));
      this.frontier -= (depth + Math.max(58, 132 - this.tier(st.dist) * 14)) * (this.bossMode ? 1.9 : 1);
    }

    this.radarData.length = 0;
    let nearestBH = null;
    const boltStep = sp > 0 ? 900 * dt : 0;

    for (let i = this.asts.length - 1; i >= 0; i--) {
      const e = this.asts[i];
      if (!e.alive) { this.asts.splice(i, 1); continue; }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.z += sp * dt;
      e.rx += e.rv * dt * 0.4;
      e.ry += e.rv * dt * 0.6;

      if (!godmode) {
        const dx = e.x - shipPos.x, dy = e.y - shipPos.y, dz = e.z - shipPos.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        const hitR = e.r + shipR;
        if (d2 < hitR * hitR) {
          this.killAst(e);
          this.ctx.cb.onDestroy(e, 'ship');
          continue;
        }
        const rel = e.z - shipPos.z;
        if (e.prevRel !== null && e.prevRel < 0 && rel >= 0) {
          const dl = Math.hypot(dx, dy);
          if (dl > hitR && dl < hitR + 10) this.ctx.cb.onNearMiss(e, 'ast');
        }
        e.prevRel = rel;

        if (bolts) {
          for (const b of bolts) {
            if (!b.alive) continue;
            const bx = e.x - b.pos.x, by = e.y - b.pos.y, bz = e.z - b.pos.z;
            const rr = e.r + 1.4 + boltStep * 0.5;
            if (bx * bx + by * by + bz * bz < rr * rr) {
              b.alive = false;
              e.hp -= b.dmg;
              if (e.hp <= 0) {
                this.killAst(e);
                this.ctx.cb.onDestroy(e, 'bolt');
              } else {
                this.ctx.cb.onBoltHit(e);
              }
              break;
            }
          }
        }
      }

      if (e.z > DESPAWN_Z || Math.abs(e.x) > 420 || Math.abs(e.y) > 300) e.alive = false;
      if (e.alive && Math.abs(e.z - shipPos.z) < 900 && e.z < 40 && Math.abs(e.x) < 420) {
        this.radarData.push({ x: e.x, y: e.y, z: e.z, type: 'ast', r: e.r });
      }
    }

    for (let i = this.crys.length - 1; i >= 0; i--) {
      const e = this.crys[i];
      if (!e.alive) { this.crys.splice(i, 1); continue; }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.z += sp * dt;
      let picked = false;
      if (!godmode) {
        const dx = e.x - shipPos.x, dy = e.y - shipPos.y, dz = e.z - shipPos.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < this.magnetR) {
          const k = Math.min(1, dt * 9);
          e.x -= dx * k; e.y -= dy * k; e.z -= dz * k;
        }
        if (d < shipR + 2.8) { this.ctx.cb.onCrystal(e); e.alive = false; picked = true; }
      }
      if (picked || e.z > DESPAWN_Z || Math.abs(e.x) > 420) e.alive = false;
      if (e.alive && Math.abs(e.z - shipPos.z) < 900 && e.z < 40 && Math.abs(e.x) < 420) {
        this.radarData.push({ x: e.x, y: e.y, z: e.z, type: 'cry', r: 2 });
      }
    }

    for (let i = this.pups.length - 1; i >= 0; i--) {
      const e = this.pups[i];
      if (!e.alive) { this.pups.splice(i, 1); continue; }
      e.mesh.position.z += sp * dt;
      e.core.rotation.y += e.spin * dt;
      e.core.rotation.x += e.spin * dt * 0.6;
      let taken = false;
      if (!godmode) {
        const d = e.mesh.position.distanceTo(shipPos);
        if (d < shipR + 3.4) {
          this.ctx.cb.onPowerup(e.ptype, e.mesh.position);
          taken = true;
        }
        const rel = e.mesh.position.z - shipPos.z;
        e.prevRel = rel;
      }
      if (taken || e.mesh.position.z > DESPAWN_Z) { this.release(e); this.pups.splice(i, 1); continue; }
      this.radarData.push({ x: e.mesh.position.x, y: e.mesh.position.y, z: e.mesh.position.z, type: 'pup', r: 2 });
    }

    for (let i = this.comets.length - 1; i >= 0; i--) {
      const e = this.comets[i];
      if (!e.alive) { this.comets.splice(i, 1); continue; }
      e.mesh.position.addScaledVector(e.vel, dt);
      e.mesh.position.z += sp * dt;
      e.mesh.rotation.x += dt * 2;
      e.mesh.rotation.y += dt * 3;
      const p = e.mesh.position;
      const h = e.tHead;
      e.ring[h * 3] = p.x; e.ring[h * 3 + 1] = p.y; e.ring[h * 3 + 2] = p.z;
      e.tHead = (h + 1) % this.tailLen;
      if (e.tCount < this.tailLen) e.tCount++;
      const arr = e.tail.geometry.attributes.position.array;
      let idx = e.tHead;
      for (let k = 0; k < this.tailLen; k++) {
        const j = (idx + this.tailLen) % this.tailLen;
        arr[k * 3] = e.ring[j * 3];
        arr[k * 3 + 1] = e.ring[j * 3 + 1];
        arr[k * 3 + 2] = e.ring[j * 3 + 2];
        idx++;
      }
      e.tail.geometry.attributes.position.needsUpdate = true;
      e.tail.visible = true;

      if (!godmode) {
        const d = p.distanceTo(shipPos);
        if (d < e.r + shipR) {
          this.killComet(e);
          this.ctx.cb.onHitComet(e);
          continue;
        }
        const rel = p.z - shipPos.z;
        if (e.prevRel !== null && e.prevRel < 0 && rel >= 0) {
          const dl = Math.hypot(p.x - shipPos.x, p.y - shipPos.y);
          if (dl > e.r + shipR && dl < e.r + shipR + 14) this.ctx.cb.onNearMiss(e, 'comet');
        }
        e.prevRel = rel;
        if (bolts) {
          for (const b of bolts) {
            if (!b.alive) continue;
            const bx = p.x - b.pos.x, by = p.y - b.pos.y, bz = p.z - b.pos.z;
            const rr = e.r + 1.4 + boltStep * 0.5;
            if (bx * bx + by * by + bz * bz < rr * rr) {
              b.alive = false;
              e.hp -= b.dmg;
              if (e.hp <= 0) {
                this.killComet(e);
                this.ctx.cb.onCometKilled(e);
              } else {
                this.ctx.cb.onBoltHit(e);
              }
              break;
            }
          }
        }
      }
      if (p.z > DESPAWN_Z + 30 || Math.abs(p.x) > 460 || Math.abs(p.y) > 320) { this.killComet(e); continue; }
      this.radarData.push({ x: p.x, y: p.y, z: p.z, type: 'comet', r: e.r });
    }

    for (let i = this.tanks.length - 1; i >= 0; i--) {
      const e = this.tanks[i];
      if (!e.alive) { this.tanks.splice(i, 1); continue; }
      const p = e.mesh.position;
      p.x += e.vx * dt;
      p.y += e.vy * dt;
      p.z += sp * dt;
      e.mesh.rotation.x += e.rv * dt * 0.5;
      e.mesh.rotation.z += e.rv * dt * 0.3;
      if (!godmode) {
        const d = p.distanceTo(shipPos);
        if (d < e.r + shipR) {
          this.release(e);
          this.tanks.splice(i, 1);
          this.ctx.cb.onTankCrash(e);
          continue;
        }
        if (bolts) {
          for (const b of bolts) {
            if (!b.alive) continue;
            const bx = p.x - b.pos.x, by = p.y - b.pos.y, bz = p.z - b.pos.z;
            const rr = e.r + 1.4 + boltStep * 0.5;
            if (bx * bx + by * by + bz * bz < rr * rr) {
              b.alive = false;
              this.release(e);
              this.tanks.splice(i, 1);
              this.ctx.cb.onTankDestroyed(e);
              break;
            }
          }
        }
        const rel = p.z - shipPos.z;
        if (e.prevRel !== null && e.prevRel < 0 && rel >= 0) {
          const dl = Math.hypot(p.x - shipPos.x, p.y - shipPos.y);
          if (dl > e.r + shipR && dl < e.r + shipR + 10) this.ctx.cb.onNearMiss(p, 'tank');
        }
        e.prevRel = rel;
        this.radarData.push({ x: p.x, y: p.y, z: p.z, type: 'tank', r: e.r });
      }
      if (p.z > DESPAWN_Z) { this.release(e); this.tanks.splice(i, 1); }
    }

    for (let i = this.sats.length - 1; i >= 0; i--) {
      const e = this.sats[i];
      if (!e.alive) { this.sats.splice(i, 1); continue; }
      const p = e.mesh.position;
      p.x += e.vx * dt;
      p.y += e.vy * dt;
      p.z += sp * dt;
      e.mesh.rotation.x += e.rv * dt;
      e.mesh.rotation.y += e.rv * dt * 1.4;
      e.blink.material.opacity = (this.elapsed % 1) < 0.12 ? 1 : 0.15;
      if (!godmode) {
        const d = p.distanceTo(shipPos);
        if (d < e.r + shipR) {
          this.release(e);
          this.sats.splice(i, 1);
          this.ctx.cb.onSatCrash(e);
          continue;
        }
        if (bolts) {
          for (const b of bolts) {
            if (!b.alive) continue;
            const bx = p.x - b.pos.x, by = p.y - b.pos.y, bz = p.z - b.pos.z;
            const rr = e.r + 1.4 + boltStep * 0.5;
            if (bx * bx + by * by + bz * bz < rr * rr) {
              b.alive = false;
              e.hp -= b.dmg;
              if (e.hp <= 0) {
                this.release(e);
                this.sats.splice(i, 1);
                this.ctx.cb.onSatKilled(e);
              } else {
                this.ctx.cb.onBoltHit(e);
              }
              break;
            }
          }
        }
        const rel = p.z - shipPos.z;
        if (e.prevRel !== null && e.prevRel < 0 && rel >= 0) {
          const dl = Math.hypot(p.x - shipPos.x, p.y - shipPos.y);
          if (dl > e.r + shipR && dl < e.r + shipR + 12) this.ctx.cb.onNearMiss(p, 'sat');
        }
        e.prevRel = rel;
        this.radarData.push({ x: p.x, y: p.y, z: p.z, type: 'sat', r: e.r });
      }
      if (p.z > DESPAWN_Z) { this.release(e); this.sats.splice(i, 1); }
    }

    for (let i = this.mines.length - 1; i >= 0; i--) {
      const e = this.mines[i];
      if (!e.alive) { this.mines.splice(i, 1); continue; }
      const p = e.mesh.position;
      p.x += e.vx * dt;
      p.y += e.vy * dt;
      p.z += sp * dt;
      e.mesh.rotation.y += dt * 1.2;
      const d = p.distanceTo(shipPos);
      if (!godmode) {
        if (!e.armed && d < 75) e.armed = true;
        const pulse = e.armed ? 0.5 + 0.5 * Math.sin(this.elapsed * 14) : 0.3 + 0.2 * Math.sin(this.elapsed * 3);
        e.glow.material.opacity = 0.35 + pulse * 0.5;
        e.glow.scale.setScalar(5 + pulse * 3.5);
        if (d < 26) {
          this.release(e);
          this.mines.splice(i, 1);
          this.ctx.cb.onMineDetonate(p.clone());
          continue;
        }
        if (bolts) {
          for (const b of bolts) {
            if (!b.alive) continue;
            const bx = p.x - b.pos.x, by = p.y - b.pos.y, bz = p.z - b.pos.z;
            const rr = e.r + 1.4 + boltStep * 0.5;
            if (bx * bx + by * by + bz * bz < rr * rr) {
              b.alive = false;
              this.release(e);
              this.mines.splice(i, 1);
              this.ctx.cb.onMineShot(p.clone());
              break;
            }
          }
        }
        this.radarData.push({ x: p.x, y: p.y, z: p.z, type: 'mine', r: e.r });
      }
      if (p.z > DESPAWN_Z) { this.release(e); this.mines.splice(i, 1); }
    }

    for (let i = this.artifacts.length - 1; i >= 0; i--) {
      const e = this.artifacts[i];
      if (!e.alive) { this.artifacts.splice(i, 1); continue; }
      const p = e.mesh.position;
      p.z += sp * dt;
      e.mesh.rotation.y += dt * 0.4;
      if (!godmode) {
        if (!e.scanned && p.distanceTo(shipPos) < 22) {
          e.scanned = true;
          this.ctx.cb.onArtifactScanned(p);
        }
        if (e.scanned) this.radarData.push({ x: p.x, y: p.y, z: p.z, type: 'art', r: e.r });
      }
      if (p.z > DESPAWN_Z) { this.release(e); this.artifacts.splice(i, 1); }
    }

    if (this.station) {
      const p = this.station.group.position;
      p.z += sp * dt;
      this.station.group.rotation.z += this.station.spin * dt;
      for (let i = 0; i < 4; i++) {
        const l = this.station.group.userData['l' + i];
        if (l) l.visible = ((this.elapsed + i * 0.25) % 1) < 0.15;
      }
      if (p.z > 220) {
        this.scene.remove(this.station.group);
        this.station = null;
      }
    }

    this.buoyScroll += sp * dt;
    {
      const rails = [
        { x: -W, y: 0 }, { x: W, y: 0 },
        { x: 0, y: -H }, { x: 0, y: H }
      ];
      let bi = 0;
      for (let r = 0; r < 4; r++) {
        for (let i = 0; i < 12; i++) {
          const z = ((i * 150 + this.buoyScroll) % 1650) - 1580;
          const rail = rails[r];
          this._v.set(rail.x, rail.y, z);
          this._s.setScalar(1 + 0.25 * Math.sin(this.elapsed * 3 + i));
          this._q.identity();
          this._m.compose(this._v, this._q, this._s);
          this.buoyMesh.setMatrixAt(bi++, this._m);
        }
      }
      this.buoyMesh.instanceMatrix.needsUpdate = true;
    }

    for (let i = this.gates.length - 1; i >= 0; i--) {
      const e = this.gates[i];
      if (!e.alive) { this.gates.splice(i, 1); continue; }
      e.mesh.position.z += sp * dt;
      e.mesh.rotation.z += dt * 0.8;
      if (!godmode) {
        const rel = e.mesh.position.z - shipPos.z;
        if (e.prevRel !== null && !e.passed && e.prevRel < 0 && rel >= 0) {
          e.passed = true;
          const dl = Math.hypot(e.mesh.position.x - shipPos.x, e.mesh.position.y - shipPos.y);
          if (dl < 13) this.ctx.cb.onGate(e);
        }
        e.prevRel = rel;
        this.radarData.push({ x: e.mesh.position.x, y: e.mesh.position.y, z: e.mesh.position.z, type: 'gate', r: 16 });
      }
      if (e.mesh.position.z > DESPAWN_Z) { this.release(e); this.gates.splice(i, 1); }
    }

    for (let i = this.planets.length - 1; i >= 0; i--) {
      const e = this.planets[i];
      if (!e.alive) { this.planets.splice(i, 1); continue; }
      const p = e.mesh.position;
      p.z += sp * dt;
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
            if (dl > hitR && dl < hitR + e.r * 0.5 + 12) this.ctx.cb.onNearMiss(p, 'planet');
          }
          e.prevRel = rel;
          this.radarData.push({ x: p.x, y: p.y, z: p.z, type: 'planet', r: e.r });
        }
      }
      if (p.z > DESPAWN_Z + e.r * 2) { this.release(e); this.planets.splice(i, 1); }
    }

    for (let i = this.bhs.length - 1; i >= 0; i--) {
      const e = this.bhs[i];
      if (!e.alive) { this.bhs.splice(i, 1); continue; }
      const p = e.mesh.position;
      p.z += sp * dt;
      e.diskMat.uniforms.uTime.value = this.elapsed;
      e.orbitMat.uniforms.uTime.value = this.elapsed;
      e.mesh.rotation.y += dt * 0.05;
      if (!godmode) {
        const dx = shipPos.x - p.x;
        const dy = shipPos.y - p.y;
        const dz = shipPos.z - p.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < e.horizon + shipR * 0.4) {
          this.release(e);
          this.bhs.splice(i, 1);
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
        this.radarData.push({ x: p.x, y: p.y, z: p.z, type: 'bh', r: e.horizon });
      }
      if (p.z > DESPAWN_Z + e.horizon * 4) { this.release(e); this.bhs.splice(i, 1); }
    }

    st.bhDanger = nearestBH;
    this.writeInstances();
  }

  writeInstances() {
    let n = 0;
    for (const e of this.asts) {
      if (!e.alive || n >= MAX_AST) continue;
      this._e.set(e.rx, e.ry, e.rz);
      this._q.setFromEuler(this._e);
      this._v.set(e.x, e.y, e.z);
      this._s.setScalar(e.s);
      this._m.compose(this._v, this._q, this._s);
      this.astMesh.setMatrixAt(n++, this._m);
    }
    this.astMesh.count = n;
    this.astMesh.instanceMatrix.needsUpdate = true;

    let m = 0;
    const pulse = 1 + 0.1 * Math.sin(this.elapsed * 3);
    for (const e of this.crys) {
      if (!e.alive || m >= MAX_CRY) continue;
      const ry = e.y + Math.sin(this.elapsed * 2 + e.phase) * 1.4;
      this._e.set(0, this.elapsed * 2.4 + e.phase, 0);
      this._q.setFromEuler(this._e);
      this._v.set(e.x, ry, e.z);
      this._s.setScalar(pulse);
      this._m.compose(this._v, this._q, this._s);
      this.cryMesh.setMatrixAt(m++, this._m);
    }
    this.cryMesh.count = m;
    this.cryMesh.instanceMatrix.needsUpdate = true;

    let k = 0;
    for (const e of this.shardEnts) {
      if (!e.alive || k >= 36) continue;
      this._e.set(e.rx, e.ry, 0);
      this._q.setFromEuler(this._e);
      this._v.set(e.x, e.y, e.z);
      this._s.setScalar(e.s);
      this._m.compose(this._v, this._q, this._s);
      this.shardMesh.setMatrixAt(k++, this._m);
    }
    this.shardMesh.count = k;
    this.shardMesh.instanceMatrix.needsUpdate = true;
  }
}


