import * as THREE from 'three';

export class Ship {
  constructor(scene) {
    this.group = new THREE.Group();
    this.inner = new THREE.Group();
    this.group.add(this.inner);
    this.r = 2.3;
    this.vel = new THREE.Vector3();
    this.build();
    scene.add(this.group);
    this.light = new THREE.PointLight(0x57e6ff, 2.2, 26, 1.8);
    this.light.position.set(0, 0.4, 1.4);
    this.inner.add(this.light);
  }

  build() {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8fa3c8, metalness: 0.75, roughness: 0.34, side: THREE.DoubleSide });
    const accMat = new THREE.MeshStandardMaterial({ color: 0x39d7ff, metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x57e6ff });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0c1826, metalness: 0.9, roughness: 0.12, emissive: 0x0a2033, emissiveIntensity: 0.7 });

    this.bodyMats = [bodyMat];
    this.accentMats = [accMat];
    this.glowMats = [glowMat];

    const fus = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 2.6, 4, 14), bodyMat);
    fus.rotation.x = Math.PI / 2;
    this.inner.add(fus);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.7, 14), accMat);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -2.55;
    this.inner.add(nose);

    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), glassMat);
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

    const wingL = new THREE.Mesh(wingGeo, bodyMat);
    wingL.position.set(-0.45, 0, 0.55);
    wingL.rotation.z = 0.06;
    this.inner.add(wingL);

    const wingR = new THREE.Mesh(wingGeo, bodyMat);
    wingR.position.set(0.45, 0, 0.55);
    wingR.rotation.z = Math.PI + 0.06;
    wingR.scale.x = -1;
    this.inner.add(wingR);

    const finGeo = new THREE.BoxGeometry(0.08, 1.0, 1.15);
    const fin = new THREE.Mesh(finGeo, accMat);
    fin.position.set(0, 0.62, 1.05);
    fin.rotation.x = 0.28;
    this.inner.add(fin);

    for (const s of [-1, 1]) {
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.34, 0.8, 12), bodyMat);
      eng.rotation.x = Math.PI / 2;
      eng.position.set(s * 0.62, -0.02, 1.2);
      this.inner.add(eng);

      const nozzle = new THREE.Mesh(new THREE.CircleGeometry(0.24, 12), glowMat);
      nozzle.position.set(s * 0.62, -0.02, 1.61);
      nozzle.rotation.y = Math.PI;
      this.inner.add(nozzle);
      if (s === -1) this.nozzleL = nozzle; else this.nozzleR = nozzle;

      const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8), accMat);
      gun.rotation.x = Math.PI / 2;
      gun.position.set(s * 2.6, 0.02, -0.4);
      this.inner.add(gun);
    }

    this.stripes = [];
    for (const s of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 1.7), glowMat);
      strip.position.set(s * 1.35, 0.075, 0.4);
      strip.rotation.z = s * -0.32;
      this.inner.add(strip);
      this.stripes.push(strip);
    }
  }

  setSkin(skin) {
    const c = new THREE.Color(skin.body);
    const a = new THREE.Color(skin.accent);
    const g = new THREE.Color(skin.glow);
    for (const m of this.bodyMats) m.color.copy(c);
    for (const m of this.accentMats) m.color.copy(a);
    for (const m of this.glowMats) m.color.copy(g);
    this.light.color.copy(g);
  }

  engineFlicker(throttle, boost, t) {
    const s = 0.75 + throttle * 0.55 + (boost ? 0.5 : 0) + Math.sin(t * 40) * 0.07;
    if (this.nozzleL) {
      this.nozzleL.scale.setScalar(s);
      this.nozzleR.scale.setScalar(s);
    }
    this.light.intensity = 1.6 + throttle * 1.6 + (boost ? 2 : 0);
    this.light.distance = 22 + (boost ? 10 : 0);
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
