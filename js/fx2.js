import * as THREE from 'three';

function softDotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.8)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Explosions {
  constructor(scene, poolSize) {
    this.pool = [];
    this.tex = softDotTexture();
    for (let i = 0; i < poolSize; i++) {
      const N = 90;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(N * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        size: 2.4,
        map: this.tex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
      });
      const pts = new THREE.Points(geo, mat);
      pts.visible = false;
      pts.frustumCulled = false;
      scene.add(pts);
      this.pool.push({ pts, vel: new Float32Array(N * 3), life: 0, active: false });
    }
  }

  spawn(origin, colorHex, power = 1, inward = false) {
    const e = this.pool.find(p => !p.active) || this.pool[0];
    const posAttr = e.pts.geometry.attributes.position;
    const arr = posAttr.array;
    e.pts.material.color.set(colorHex);
    e.pts.material.size = 1.8 + power * 1.4;
    const N = arr.length / 3;
    for (let i = 0; i < N; i++) {
      arr[i * 3] = origin.x;
      arr[i * 3 + 1] = origin.y;
      arr[i * 3 + 2] = origin.z;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const sp = (inward ? 34 : 12) + Math.random() * 48 * power;
      const dir = inward ? -1 : 1;
      e.vel[i * 3] = Math.sin(ph) * Math.cos(th) * sp * dir;
      e.vel[i * 3 + 1] = Math.sin(ph) * Math.sin(th) * sp * dir;
      e.vel[i * 3 + 2] = Math.cos(ph) * sp * dir;
    }
    posAttr.needsUpdate = true;
    e.life = 1;
    e.active = true;
    e.pts.visible = true;
  }

  update(dt) {
    for (const e of this.pool) {
      if (!e.active) continue;
      e.life -= dt * 1.25;
      if (e.life <= 0) {
        e.active = false;
        e.pts.visible = false;
        continue;
      }
      const posAttr = e.pts.geometry.attributes.position;
      const arr = posAttr.array;
      const drag = Math.pow(0.14, dt);
      for (let i = 0; i < arr.length / 3; i++) {
        arr[i * 3] += e.vel[i * 3] * dt;
        arr[i * 3 + 1] += e.vel[i * 3 + 1] * dt;
        arr[i * 3 + 2] += e.vel[i * 3 + 2] * dt;
        e.vel[i * 3] *= drag;
        e.vel[i * 3 + 1] *= drag;
        e.vel[i * 3 + 2] *= drag;
      }
      posAttr.needsUpdate = true;
      e.pts.material.opacity = Math.max(e.life, 0);
    }
  }
}

export class Shocks {
  constructor(scene, poolSize) {
    this.pool = [];
    for (let i = 0; i < poolSize; i++) {
      const geo = new THREE.RingGeometry(0.92, 1, 48);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({ mesh, life: 0, maxR: 10 });
    }
  }

  spawn(origin, colorHex, maxR = 16) {
    const s = this.pool.find(p => p.life <= 0) || this.pool[0];
    s.mesh.position.copy(origin);
    s.mesh.material.color.set(colorHex);
    s.mesh.scale.setScalar(0.5);
    s.life = 1;
    s.maxR = maxR;
    s.mesh.visible = true;
  }

  update(dt, camera) {
    for (const s of this.pool) {
      if (s.life <= 0) continue;
      s.life -= dt * 1.6;
      if (s.life <= 0) {
        s.mesh.visible = false;
        continue;
      }
      const t = 1 - s.life;
      s.mesh.scale.setScalar(0.5 + s.maxR * (1 - Math.pow(1 - t, 2.2)));
      s.mesh.material.opacity = s.life * 0.75;
      s.mesh.quaternion.copy(camera.quaternion);
    }
  }
}

export class Debris {
  constructor(scene, poolSize) {
    this.pool = [];
    const geo = new THREE.TetrahedronGeometry(0.55, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x6b6156, roughness: 1, flatShading: true });
    for (let i = 0; i < poolSize; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({
        mesh,
        vel: new THREE.Vector3(),
        rot: new THREE.Vector3(),
        life: 0,
        scale: 1
      });
    }
  }

  spawn(origin, count, power) {
    let spawned = 0;
    for (const d of this.pool) {
      if (spawned >= count) break;
      if (d.life > 0) continue;
      d.mesh.position.copy(origin);
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const sp = 8 + Math.random() * 26 * power;
      d.vel.set(Math.sin(ph) * Math.cos(th) * sp, Math.sin(ph) * Math.sin(th) * sp, Math.cos(ph) * sp);
      d.rot.set(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4);
      d.scale = 0.5 + Math.random() * 1.1 * power;
      d.mesh.scale.setScalar(d.scale);
      d.life = 1;
      d.mesh.visible = true;
      spawned++;
    }
  }

  update(dt) {
    for (const d of this.pool) {
      if (d.life <= 0) continue;
      d.life -= dt * 0.9;
      if (d.life <= 0) {
        d.mesh.visible = false;
        continue;
      }
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += d.rot.x * dt;
      d.mesh.rotation.y += d.rot.y * dt;
      d.mesh.scale.setScalar(d.scale * d.life);
    }
  }
}

export class Flash {
  constructor(scene, poolSize) {
    this.pool = [];
    for (let i = 0; i < poolSize; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 60, 2);
      light.visible = false;
      scene.add(light);
      this.pool.push({ light, life: 0 });
    }
  }

  trigger(origin, colorHex, power = 1) {
    const f = this.pool.find(p => p.life <= 0.15) || this.pool[0];
    f.light.position.copy(origin);
    f.light.color.set(colorHex);
    f.light.intensity = 26 * power;
    f.light.distance = 40 + power * 40;
    f.life = 1;
    f.light.visible = true;
  }

  update(dt) {
    for (const f of this.pool) {
      if (f.life <= 0) continue;
      f.life -= dt * 3.2;
      if (f.life <= 0) {
        f.light.visible = false;
        f.light.intensity = 0;
        continue;
      }
      f.light.intensity *= Math.pow(0.001, dt);
    }
  }
}

export class Trails {
  constructor(scene, ship, glowColor) {
    this.ship = ship;
    this.MAX = 40;
    this.ringL = new Float32Array(this.MAX * 3);
    this.ringR = new Float32Array(this.MAX * 3);
    this.head = 0;
    this.count = 0;
    this.tipL = new THREE.Vector3();
    this.tipR = new THREE.Vector3();
    this.tmpL = new THREE.Vector3();
    this.tmpR = new THREE.Vector3();
    this.color = new THREE.Color(glowColor);
    this.lineL = this.makeLine();
    this.lineR = this.makeLine();
    scene.add(this.lineL);
    scene.add(this.lineR);
    this.clear();
  }

  makeLine() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.MAX * 3), 3));
    const colors = new Float32Array(this.MAX * 3);
    const c = this.color;
    for (let i = 0; i < this.MAX; i++) {
      const f = Math.pow(1 - i / this.MAX, 1.8) * 1.15;
      colors[i * 3] = c.r * f;
      colors[i * 3 + 1] = c.g * f;
      colors[i * 3 + 2] = c.b * f;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    return line;
  }

  setGlow(colorHex) {
    this.color.set(colorHex);
    for (const line of [this.lineL, this.lineR]) {
      const attr = line.geometry.attributes.color;
      const arr = attr.array;
      for (let i = 0; i < this.MAX; i++) {
        const f = Math.pow(1 - i / this.MAX, 1.8) * 1.15;
        arr[i * 3] = this.color.r * f;
        arr[i * 3 + 1] = this.color.g * f;
        arr[i * 3 + 2] = this.color.b * f;
      }
      attr.needsUpdate = true;
    }
  }

  push() {
    const g = this.ship.group;
    g.updateMatrixWorld(true);
    this.tmpL.set(-0.62, 0.02, 1.62).applyMatrix4(g.matrixWorld);
    this.tmpR.set(0.62, 0.02, 1.62).applyMatrix4(g.matrixWorld);
    const h = this.head;
    this.ringL[h * 3] = this.tmpL.x;
    this.ringL[h * 3 + 1] = this.tmpL.y;
    this.ringL[h * 3 + 2] = this.tmpL.z;
    this.ringR[h * 3] = this.tmpR.x;
    this.ringR[h * 3 + 1] = this.tmpR.y;
    this.ringR[h * 3 + 2] = this.tmpR.z;
    this.head = (h + 1) % this.MAX;
    if (this.count < this.MAX) this.count++;
    this.write(this.lineL, this.ringL);
    this.write(this.lineR, this.ringR);
  }

  write(line, ring) {
    const arr = line.geometry.attributes.position.array;
    let idx = this.head;
    for (let i = 0; i < this.MAX; i++) {
      const j = (idx + this.MAX) % this.MAX;
      arr[i * 3] = ring[j * 3];
      arr[i * 3 + 1] = ring[j * 3 + 1];
      arr[i * 3 + 2] = ring[j * 3 + 2];
      idx++;
    }
    line.geometry.attributes.position.needsUpdate = true;
  }

  clear() {
    this.ringL.fill(0);
    this.ringR.fill(0);
    this.head = 0;
    this.count = 0;
    const p = this.ship.group.position;
    for (const line of [this.lineL, this.lineR]) {
      const arr = line.geometry.attributes.position.array;
      for (let i = 0; i < this.MAX; i++) {
        arr[i * 3] = p.x;
        arr[i * 3 + 1] = p.y;
        arr[i * 3 + 2] = p.z;
      }
      line.geometry.attributes.position.needsUpdate = true;
    }
  }

  setVisible(v) {
    this.lineL.visible = v;
    this.lineR.visible = v;
  }
}
