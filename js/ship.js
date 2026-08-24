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

export class Ship {
  constructor(scene, ghost = false) {
    this.group = new THREE.Group();
    this.inner = new THREE.Group();
    this.group.add(this.inner);
    this.r = 2.3;
    this.vel = new THREE.Vector3();
    this.ghost = ghost;
    this.shieldMesh = null;
    this.navL = null;
    this.navR = null;
    this.exhaust = null;
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
      return { body: m, acc: m, glow: m, glass: m };
    }
    const body = new THREE.MeshStandardMaterial({ color: 0x8fa3c8, metalness: 0.75, roughness: 0.34, side: THREE.DoubleSide });
    const acc = new THREE.MeshStandardMaterial({ color: 0x39d7ff, metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide });
    const glow = new THREE.MeshBasicMaterial({ color: 0x57e6ff });
    const glass = new THREE.MeshStandardMaterial({ color: 0x0c1826, metalness: 0.9, roughness: 0.12, emissive: 0x0a2033, emissiveIntensity: 0.7 });
    this.bodyMats = [body];
    this.accentMats = [acc];
    this.glowMats = [glow];
    return { body, acc, glow, glass };
  }

  build() {
    const { body, acc, glow, glass } = this.makeMats();

    const fus = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 2.6, 4, 14), body);
    fus.rotation.x = Math.PI / 2;
    this.inner.add(fus);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.7, 14), acc);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -2.55;
    this.inner.add(nose);

    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), glass);
    cockpit.scale.set(0.85, 0.62, 1.7);
    cockpit.position.set(0, 0.44, -0.85);
    this.inner.add(cockpit);

    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, -1.15);
    wingShape.lineTo(-3.05, 0.95);
    wingShape.lineTo(-3.25, 1.5);
    wingShape.lineTo(-1.15, 1.35);
    wingShape.lineTo(0, 0.95);
    wingShape.lineTo(0, -1.15);
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.04, bevelSegments: 1 });
    wingGeo.rotateX(Math.PI / 2);

    const wingL = new THREE.Mesh(wingGeo, body);
    wingL.position.set(-0.45, 0, 0.55);
    wingL.rotation.z = 0.06;
    this.inner.add(wingL);

    const wingR = new THREE.Mesh(wingGeo, body);
    wingR.position.set(0.45, 0, 0.55);
    wingR.rotation.z = Math.PI + 0.06;
    wingR.scale.x = -1;
    this.inner.add(wingR);

    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 1.15), acc);
    fin.position.set(0, 0.62, 1.05);
    fin.rotation.x = 0.28;
    this.inner.add(fin);

    for (const s of [-1, 1]) {
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.34, 0.8, 12), body);
      eng.rotation.x = Math.PI / 2;
      eng.position.set(s * 0.62, -0.02, 1.2);
      this.inner.add(eng);

      const nozzle = new THREE.Mesh(new THREE.CircleGeometry(0.24, 12), glow);
      nozzle.position.set(s * 0.62, -0.02, 1.61);
      nozzle.rotation.y = Math.PI;
      this.inner.add(nozzle);
      if (s === -1) this.nozzleL = nozzle; else this.nozzleR = nozzle;

      const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8), acc);
      gun.rotation.x = Math.PI / 2;
      gun.position.set(s * 2.6, 0.02, -0.4);
      this.inner.add(gun);

      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), acc);
      antenna.position.set(s * 0.3, 0.85, 0.9);
      antenna.rotation.z = s * 0.35;
      this.inner.add(antenna);
    }

    for (const s of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 1.7), glow);
      strip.position.set(s * 1.35, 0.075, 0.4);
      strip.rotation.z = s * -0.32;
      this.inner.add(strip);
    }

    if (!this.ghost) {
      const navMatL = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.25, 0.2), toneMapped: false });
      const navMatR = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 2.2, 0.5), toneMapped: false });
      this.navL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), navMatL);
      this.navL.position.set(-3.55, 0.06, -0.55);
      this.inner.add(this.navL);
      this.navR = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), navMatR);
      this.navR.position.set(3.55, 0.06, -0.55);
      this.inner.add(this.navR);

      this.exhaust = new THREE.Mesh(
        new THREE.ConeGeometry(0.34, 2.4, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x57e6ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
      );
      this.exhaust.rotation.x = -Math.PI / 2;
      this.exhaust.position.set(0, -0.02, 2.6);
      this.inner.add(this.exhaust);

      this.shieldMesh = new THREE.Mesh(
        new THREE.SphereGeometry(3.1, 28, 20),
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
    if (this.exhaust) this.exhaust.material.color.copy(g);
  }

  engineFlicker(throttle, boost, t) {
    if (this.ghost) return;
    const s = 0.75 + throttle * 0.55 + (boost ? 0.5 : 0) + Math.sin(t * 40) * 0.07;
    this.nozzleL.scale.setScalar(s);
    this.nozzleR.scale.setScalar(s);
    this.light.intensity = 1.6 + throttle * 1.6 + (boost ? 2 : 0);
    this.light.distance = 22 + (boost ? 10 : 0);
    const el = 0.5 + throttle * 1.3 + (boost ? 1.1 : 0);
    this.exhaust.scale.set(0.7 + throttle * 0.4, el, 0.7 + throttle * 0.4);
    this.exhaust.material.opacity = 0.22 + throttle * 0.25 + (boost ? 0.2 : 0);
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
