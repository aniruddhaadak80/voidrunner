import * as THREE from 'three';

const CORE_HP = 8;
const CORE_HP_EXPOSED = 14;

export class Boss {
  constructor(scene, onEvent) {
    this.scene = scene;
    this.cb = onEvent;
    this.group = new THREE.Group();
    this.group.position.set(0, 0, -1500);
    this.state = 'entering';
    this.t = 0;
    this.fireT = 2.2;
    this.telegraphT = -1;
    this.dieT = 0;
    this.shakeT = 0;

    this.hullMat = new THREE.MeshStandardMaterial({ color: 0x3a4254, roughness: 0.45, metalness: 0.85, side: THREE.DoubleSide, flatShading: true });
    this.darkMat = new THREE.MeshStandardMaterial({ color: 0x1c2029, roughness: 0.6, metalness: 0.9 });
    this.glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.5, 0.3), toneMapped: false });

    const hull = new THREE.Mesh(new THREE.CylinderGeometry(4, 13, 46, 6), this.hullMat);
    hull.rotation.x = Math.PI / 2;
    hull.rotation.z = Math.PI / 6;
    this.group.add(hull);

    const prow = new THREE.Mesh(new THREE.ConeGeometry(4, 12, 6), this.hullMat);
    prow.rotation.x = -Math.PI / 2;
    prow.rotation.z = Math.PI / 6;
    prow.position.z = -28;
    this.group.add(prow);

    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(26, 2.2, 9), this.hullMat);
      wing.position.set(s * 15, 0, 6);
      wing.rotation.z = s * 0.16;
      this.group.add(wing);

      const wingTip = new THREE.Mesh(new THREE.BoxGeometry(4, 3.4, 7), this.darkMat);
      wingTip.position.set(s * 26, 0, 6);
      this.group.add(wingTip);

      const turret = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 2.6, 8), this.darkMat);
      turret.position.set(s * 12, -3.4, -8);
      this.group.add(turret);
    }

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(7, 4.5, 9), this.darkMat);
    bridge.position.set(0, 5.5, 8);
    this.group.add(bridge);

    const engineGlow = new THREE.Mesh(new THREE.CircleGeometry(6, 16), new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.0, 0.8, 0.4), toneMapped: false
    }));
    engineGlow.position.set(0, 0, 23.2);
    this.group.add(engineGlow);

    this.cores = [];
    const corePos = [
      [-12, -3.4, -8],
      [12, -3.4, -8],
      [0, 6.5, 3]
    ];
    for (const [x, y, z] of corePos) {
      const core = new THREE.Mesh(new THREE.SphereGeometry(2.3, 16, 12), new THREE.MeshBasicMaterial({
        color: new THREE.Color(2.6, 1.1, 0.25), toneMapped: false
      }));
      core.position.set(x, y, z);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.28, 8, 24), new THREE.MeshBasicMaterial({
        color: new THREE.Color(1.6, 0.6, 0.2), toneMapped: false
      }));
      core.add(ring);
      const halo = glowSprite('rgba(255,150,60,0.55)', 14);
      core.add(halo);
      this.group.add(core);
      this.cores.push({ mesh: core, hp: CORE_HP, alive: true, ring, halo });
    }

    this.mainCore = new THREE.Mesh(new THREE.SphereGeometry(3.4, 18, 14), new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.8, 0.4, 0.5), toneMapped: false
    }));
    this.mainCore.position.set(0, 0, -2);
    this.mainCore.visible = false;
    const mainHalo = glowSprite('rgba(255,80,110,0.6)', 20);
    this.mainCore.add(mainHalo);
    this.group.add(this.mainCore);
    this.mainHp = CORE_HP_EXPOSED;
    this.exposed = false;

    this.boltPool = [];
    for (let i = 0; i < 14; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.6, 4.5),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 0.5, 0.4), toneMapped: false })
      );
      mesh.visible = false;
      scene.add(mesh);
      this.boltPool.push({ mesh, pos: mesh.position, dir: new THREE.Vector3(), life: 0, alive: false, speed: 300 });
    }

    scene.add(this.group);
  }

  get alive() {
    return this.state !== 'dead' && this.state !== 'removed';
  }

  get pos() {
    return this.group.position;
  }

  update(dt, playerPos, playerR) {
    if (this.state === 'dead' || this.state === 'removed') return;
    this.t += dt;
    const p = this.group.position;

    if (this.state === 'entering') {
      p.z += 240 * dt;
      p.x = Math.sin(this.t * 0.4) * 50;
      p.y = Math.sin(this.t * 0.27) * 26;
      if (p.z >= -360) this.state = 'active';
    } else if (this.state === 'active') {
      p.x = Math.sin(this.t * 0.4) * 62;
      p.y = Math.sin(this.t * 0.27) * 30;
      p.z += (this.exposed ? -14 : -6) * dt;
      if (p.z < -430) p.z = -430;
    } else if (this.state === 'dying') {
      this.dieT -= dt;
      this.group.rotation.z += dt * 0.6;
      p.x += Math.sin(this.t * 30) * 0.8;
      if (Math.random() < 0.35) {
        tmp.set((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 30).add(p);
        this.cb.bossExplosion(tmp, 0.9 + Math.random() * 0.8);
      }
      if (this.dieT <= 0) {
        this.cb.bossDestroyed(p.clone());
        this.state = 'dead';
        this.group.visible = false;
      }
      return;
    }

    this.group.rotation.z = Math.sin(this.t * 0.3) * 0.06;

    for (const core of this.cores) {
      if (!core.alive) continue;
      const s = 1 + 0.12 * Math.sin(this.t * 5 + core.mesh.position.x);
      core.mesh.scale.setScalar(s * (this.exposed ? 0 : 1));
      core.ring.rotation.z += dt * 2;
      if (this.exposed) core.mesh.visible = false;
    }
    if (this.exposed) {
      this.mainCore.visible = true;
      this.mainCore.scale.setScalar(1 + 0.15 * Math.sin(this.t * 8));
      this.shakeT = 0.2;
    }
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      this.group.position.x += (Math.random() - 0.5) * 1.2;
    }

    const distZ = Math.abs(p.z - playerPos.z);
    if (this.state === 'active' && distZ < 700) {
      if (this.telegraphT > 0) {
        this.telegraphT -= dt;
        if (this.telegraphT <= 0) this.fireVolley(playerPos);
      } else {
        this.fireT -= dt * (this.exposed ? 1.6 : 1);
        if (this.fireT <= 0) {
          this.fireT = this.exposed ? 1.1 : 1.7;
          this.telegraphT = 0.45;
        }
      }
    }

    for (const b of this.boltPool) {
      if (!b.alive) continue;
      b.pos.addScaledVector(b.dir, b.speed * dt);
      b.life -= dt;
      if (b.life <= 0) { b.alive = false; b.mesh.visible = false; continue; }
      const dx = b.pos.x - playerPos.x, dy = b.pos.y - playerPos.y, dz = b.pos.z - playerPos.z;
      const rr = playerR + 1.6;
      if (dx * dx + dy * dy + dz * dz < rr * rr) {
        b.alive = false;
        b.mesh.visible = false;
        this.cb.bossBoltHit(b.pos.clone());
      }
    }

    const dx = p.x - playerPos.x, dy = p.y - playerPos.y, dz = p.z - playerPos.z;
    const rr = 22 + playerR;
    if (dx * dx + dy * dy + dz * dz < rr * rr) {
      this.cb.bossRam(playerPos.clone().sub(p).normalize());
    }
  }

  fireVolley(playerPos) {
    const shots = this.exposed ? 4 : 3;
    let fired = 0;
    for (const b of this.boltPool) {
      if (fired >= shots) break;
      if (b.alive) continue;
      const side = fired % 2 === 0 ? -12 : 12;
      b.pos.set(side, -3, -4).applyMatrix4(this.group.matrixWorld);
      b.dir.copy(playerPos).sub(b.pos).normalize();
      b.dir.x += (Math.random() - 0.5) * 0.06;
      b.dir.y += (Math.random() - 0.5) * 0.06;
      b.dir.normalize();
      b.speed = 300 + Math.random() * 60;
      b.life = 5;
      b.alive = true;
      b.mesh.visible = true;
      b.mesh.quaternion.setFromUnitVectors(FWD, b.dir);
      fired++;
    }
    this.cb.bossFired();
  }

  targets() {
    if (this.state !== 'active') return null;
    if (this.exposed) return this.mainCore.position;
    for (const c of this.cores) if (c.alive) return c.mesh.position;
    return null;
  }

  tryHit(pos) {
    if (this.state !== 'active') return false;
    const local = tmp.copy(pos).sub(this.group.position);
    if (local.lengthSq() > 40 * 40) return false;
    if (this.exposed) {
      if (local.distanceTo(this.mainCore.position) < 5) {
        this.mainHp--;
        this.cb.bossCoreHit(this.mainCore.position.clone());
        if (this.mainHp <= 0) this.startDeath();
        return true;
      }
      return local.lengthSq() < 20 * 20;
    }
    for (const c of this.cores) {
      if (!c.alive) continue;
      if (local.distanceTo(c.mesh.position) < 4.4) {
        c.hp--;
        this.cb.bossCoreHit(c.mesh.position.clone());
        if (c.hp <= 0) {
          c.alive = false;
          c.mesh.visible = false;
          this.cb.bossCoreDestroyed(c.mesh.position.clone());
          if (this.cores.every(k => !k.alive)) {
            this.exposed = true;
            this.cb.bossExposed();
          }
        }
        return true;
      }
    }
    return local.lengthSq() < 19 * 19;
  }

  healthFrac() {
    if (this.exposed) return Math.max(0, this.mainHp / CORE_HP_EXPOSED) * 0.34;
    let hp = 0;
    for (const c of this.cores) if (c.alive) hp += c.hp;
    return 0.34 + (hp / (CORE_HP * 3)) * 0.66;
  }

  startDeath() {
    this.state = 'dying';
    this.dieT = 1.7;
    for (const b of this.boltPool) { b.alive = false; b.mesh.visible = false; }
  }

  dispose() {
    this.scene.remove(this.group);
    for (const b of this.boltPool) this.scene.remove(b.mesh);
    this.state = 'removed';
  }
}

const tmp = new THREE.Vector3();
const FWD = new THREE.Vector3(0, 0, -1);

function glowSprite(colorHex, scale) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, colorHex);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  sp.scale.setScalar(scale);
  return sp;
}
