import * as THREE from 'three';

const SHIELD_VERT = `
varying vec3 vN; varying vec3 vW;
void main(){
  vN = normalize(normalMatrix * normal);
  vec4 wp = modelMatrix * vec4(position,1.0);
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const SHIELD_FRAG = `
uniform float uTime; uniform vec3 uColor;
varying vec3 vN; varying vec3 vW;
void main(){
  vec3 v = normalize(cameraPosition - vW);
  float f = pow(1.0 - abs(dot(normalize(vN), v)), 2.2);
  float pulse = 0.75 + 0.25*sin(uTime*6.0);
  gl_FragColor = vec4(uColor * f * 2.2 * pulse, f * 0.85);
}`;

function wingShape(scale = 1) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.9 * scale);
  s.lineTo(-3.4 * scale, 1.15 * scale);
  s.lineTo(-3.62 * scale, 1.72 * scale);
  s.lineTo(-1.3 * scale, 1.52 * scale);
  s.lineTo(-0.25 * scale, 1.0 * scale);
  s.closePath();
  return s;
}

function extrudeFlat(shape, depth) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.04, bevelSegments: 1 });
  g.rotateX(Math.PI / 2);
  return g;
}

export class Ship {
  constructor(scene, ghost = false) {
    this.group = new THREE.Group();
    this.inner = new THREE.Group();
    this.group.add(this.inner);
    this.r = 2.4;
    this.vel = new THREE.Vector3();
    this.ghost = ghost;
    this.build();
    scene.add(this.group);
    if (!ghost) {
      this.light = new THREE.PointLight(0x57e6ff, 2.2, 26, 1.8);
      this.light.position.set(0, 0.4, 1.4);
      this.inner.add(this.light);
    }
  }

  makeMats() {
    if (this.ghost) {
      const m = new THREE.MeshBasicMaterial({ color: 0x39d7ff, wireframe: true, transparent: true, opacity: 0.22, depthWrite: false });
      return { body: m, acc: m, glow: m, glass: m, dark: m };
    }
    const body = new THREE.MeshStandardMaterial({ color: 0x93a7cc, metalness: 0.78, roughness: 0.32, side: THREE.DoubleSide });
    const acc = new THREE.MeshStandardMaterial({ color: 0x39d7ff, metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide });
    const glow = new THREE.MeshBasicMaterial({ color: 0x57e6ff });
    const glass = new THREE.MeshStandardMaterial({ color: 0x0c1826, metalness: 0.9, roughness: 0.12, emissive: 0x0a2033, emissiveIntensity: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a3242, metalness: 0.85, roughness: 0.4, side: THREE.DoubleSide });
    this.bodyMats = [body];
    this.accentMats = [acc];
    this.glowMats = [glow];
    return { body, acc, glow, glass, dark };
  }

  build() {
    const { body, acc, glow, glass, dark } = this.makeMats();

    const profile = [];
    const pts = [
      [0.02, -2.7], [0.22, -2.35], [0.42, -1.7], [0.54, -0.8],
      [0.58, 0.1], [0.55, 1.0], [0.46, 1.8], [0.3, 2.35], [0.24, 2.5]
    ];
    for (const [r, y] of pts) profile.push(new THREE.Vector2(r, y));
    const fus = new THREE.Mesh(new THREE.LatheGeometry(profile, 18), body);
    fus.geometry.rotateX(Math.PI / 2);
    this.inner.add(fus);

    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 2.6), dark);
    spine.position.set(0, 0.58, 0.3);
    this.inner.add(spine);
    for (let i = 0; i < 3; i++) {
      const greeble = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.34), acc);
      greeble.position.set(0, 0.66, -0.5 + i * 0.75);
      this.inner.add(greeble);
    }

    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.46, 18, 14), glass);
    canopy.scale.set(0.82, 0.6, 1.65);
    canopy.position.set(0, 0.5, -0.95);
    this.inner.add(canopy);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.035, 8, 24), acc);
    frame.rotation.x = Math.PI / 2;
    frame.scale.set(0.85, 1.7, 1);
    frame.position.set(0, 0.42, -0.95);
    this.inner.add(frame);

    const turret = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), dark);
    turret.position.set(0, -0.42, -1.15);
    this.inner.add(turret);
    const turretBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8), dark);
    turretBarrel.rotation.x = Math.PI / 2;
    turretBarrel.position.set(0, -0.42, -1.6);
    this.inner.add(turretBarrel);

    const wingGeo = extrudeFlat(wingShape(1), 0.1);
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(wingGeo, body);
      wing.position.set(s * 0.32, -0.06, 0.55);
      if (s === 1) wing.scale.x = -1;
      this.inner.add(wing);

      const strip = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.05, 0.16), glow);
      strip.position.set(s === -1 ? -1.7 : 1.7, 0.07, 0.35);
      strip.rotation.y = s * -0.18;
      wing.attach(strip);

      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 1.3, 10), dark);
      pod.rotation.x = Math.PI / 2;
      pod.position.set(s * 3.35, 0.02, -0.1);
      wing.attach(pod);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.5, 8), acc);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(s * 3.35, 0.02, -1.2);
      wing.attach(barrel);

      const navMat = new THREE.MeshBasicMaterial({
        color: s === -1 ? new THREE.Color(2.2, 0.25, 0.2) : new THREE.Color(0.2, 2.2, 0.5),
        toneMapped: false
      });
      const nav = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), navMat);
      nav.position.set(s * 3.35, 0.02, -0.85);
      wing.attach(nav);
      if (s === -1) this.navL = nav; else this.navR = nav;

      const canardShape = wingShape(0.34);
      const canard = new THREE.Mesh(extrudeFlat(canardShape, 0.06), acc);
      canard.position.set(s * 0.5, 0.16, -1.55);
      if (s === 1) canard.scale.x = -1;
      this.inner.add(canard);
    }

    for (const s of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.15, 0.95), acc);
      fin.position.set(s * 0.55, 0.6, 1.35);
      fin.rotation.z = s * -0.38;
      this.inner.add(fin);

      const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.15, 12), dark);
      nacelle.rotation.x = Math.PI / 2;
      nacelle.position.set(s * 0.72, -0.06, 1.45);
      this.inner.add(nacelle);

      const nozzle = new THREE.Mesh(new THREE.CircleGeometry(0.28, 12), glow);
      nozzle.position.set(s * 0.72, -0.06, 2.05);
      nozzle.rotation.y = Math.PI;
      this.inner.add(nozzle);
      if (s === -1) this.nozzleL = nozzle; else this.nozzleR = nozzle;

      const exhaust = new THREE.Mesh(
        new THREE.ConeGeometry(0.3, 2.4, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x57e6ff, transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
      );
      exhaust.rotation.x = -Math.PI / 2;
      exhaust.position.set(s * 0.72, -0.06, 3.1);
      this.inner.add(exhaust);
      if (s === -1) this.exhaustL = exhaust; else this.exhaustR = exhaust;
    }

    const ventral = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 1.0), acc);
    ventral.position.set(0, -0.5, 0.9);
    this.inner.add(ventral);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.0, 6), dark);
    antenna.position.set(0.18, 0.95, 0.6);
    antenna.rotation.z = -0.25;
    this.inner.add(antenna);

    if (!this.ghost) {
      this.shieldMesh = new THREE.Mesh(
        new THREE.SphereGeometry(3.2, 28, 20),
        new THREE.ShaderMaterial({
          vertexShader: SHIELD_VERT,
          fragmentShader: SHIELD_FRAG,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x4ab8ff) } }
        })
      );
      this.shieldMesh.visible = false;
      this.inner.add(this.shieldMesh);
    }
  }

  setSkin(skin) {
    if (this.ghost) return;
    const c = new THREE.Color(skin.body);
    const a = new THREE.Color(skin.accent);
    const g = new THREE.Color(skin.glow);
    for (const m of this.bodyMats) m.color.copy(c);
    for (const m of this.accentMats) m.color.copy(a);
    for (const m of this.glowMats) m.color.copy(g);
    this.light.color.copy(g);
    this.exhaustL.material.color.copy(g);
    this.exhaustR.material.color.copy(g);
  }

  engineFlicker(throttle, boost, t) {
    if (this.ghost) return;
    const s = 0.75 + throttle * 0.55 + (boost ? 0.5 : 0) + Math.sin(t * 40) * 0.07;
    this.nozzleL.scale.setScalar(s);
    this.nozzleR.scale.setScalar(s);
    this.light.intensity = 1.6 + throttle * 1.6 + (boost ? 2 : 0);
    this.light.distance = 22 + (boost ? 10 : 0);
    const el = 0.5 + throttle * 1.3 + (boost ? 1.1 : 0);
    for (const ex of [this.exhaustL, this.exhaustR]) {
      ex.scale.set(0.7 + throttle * 0.4, el, 0.7 + throttle * 0.4);
      ex.material.opacity = 0.2 + throttle * 0.25 + (boost ? 0.2 : 0);
    }
  }

  blinkNav(t) {
    if (!this.navL) return;
    this.navL.visible = (t % 1.4) < 0.1;
    this.navR.visible = ((t + 0.7) % 1.4) < 0.1;
  }

  setShield(on, t) {
    if (!this.shieldMesh) return;
    this.shieldMesh.visible = on;
    if (on) this.shieldMesh.material.uniforms.uTime.value = t;
  }

  setVisible(v) {
    this.group.visible = v;
  }

  reset() {
    this.group.position.set(0, 0, 0);
    this.vel.set(0, 0, 0);
    this.inner.rotation.set(0, 0, 0);
    this.setVisible(true);
  }
}
