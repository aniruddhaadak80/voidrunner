import * as THREE from 'three';

export const NOISE_GLSL = `
float hash1(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash1(i),hash1(i+vec2(1.,0.)),u.x), mix(hash1(i+vec2(0.,1.)),hash1(i+vec2(1.,1.)),u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0; float a = 0.5;
  for(int i=0;i<4;i++){ v += a*vnoise(p); p = p*2.03 + vec2(19.7,7.3); a *= 0.5; }
  return v;
}
`;

export class Stars {
  constructor(scene, count) {
    this.box = 4200;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const seed = new Float32Array(count);
    const palette = [
      [1, 1, 1], [0.75, 0.85, 1], [1, 0.9, 0.75], [0.85, 0.8, 1], [1, 0.75, 0.65]
    ];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * this.box;
      pos[i * 3 + 1] = (Math.random() - 0.5) * this.box;
      pos[i * 3 + 2] = (Math.random() - 0.5) * this.box;
      const c = palette[(Math.random() * palette.length) | 0];
      const b = 0.55 + Math.random() * 0.45;
      col[i * 3] = c[0] * b;
      col[i * 3 + 1] = c[1] * b;
      col[i * 3 + 2] = c[2] * b;
      size[i] = Math.random() < 0.06 ? 2.6 + Math.random() * 2.4 : 0.7 + Math.random() * 1.4;
      seed[i] = Math.random();
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uCam: { value: new THREE.Vector3() },
        uBox: { value: this.box },
        uTime: { value: 0 },
        uScale: { value: 340 }
      },
      vertexShader: `
        uniform vec3 uCam; uniform float uBox; uniform float uTime; uniform float uScale;
        attribute float aSize; attribute float aSeed; attribute vec3 aColor;
        varying vec3 vColor;
        void main(){
          vec3 rel = position - uCam;
          rel = mod(rel + uBox*0.5, uBox) - uBox*0.5;
          vec4 mv = viewMatrix * vec4(uCam + rel, 1.0);
          gl_Position = projectionMatrix * mv;
          float d = max(-mv.z, 1.0);
          gl_PointSize = aSize * uScale / d;
          float tw = 0.72 + 0.28*sin(uTime*(1.0+aSeed*2.4)+aSeed*40.0);
          vColor = aColor * tw;
        }`,
      fragmentShader: `
        varying vec3 vColor;
        void main(){
          vec2 uv = gl_PointCoord - 0.5;
          float r = length(uv);
          float a = smoothstep(0.5, 0.08, r);
          gl_FragColor = vec4(vColor, a);
        }`
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = -5;
    scene.add(this.points);
  }

  update(camPos, t) {
    this.mat.uniforms.uCam.value.copy(camPos);
    this.mat.uniforms.uTime.value = t;
  }
}

export class Dust {
  constructor(scene, count) {
    this.box = 340;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * this.box;
      pos[i * 3 + 1] = (Math.random() - 0.5) * this.box;
      pos[i * 3 + 2] = (Math.random() - 0.5) * this.box;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uCam: { value: new THREE.Vector3() },
        uBox: { value: this.box },
        uOp: { value: 0.25 },
        uScale: { value: 420 }
      },
      vertexShader: `
        uniform vec3 uCam; uniform float uBox; uniform float uScale;
        varying float vA;
        void main(){
          vec3 rel = position - uCam;
          rel = mod(rel + uBox*0.5, uBox) - uBox*0.5;
          vec4 mv = viewMatrix * vec4(uCam + rel, 1.0);
          gl_Position = projectionMatrix * mv;
          float d = max(-mv.z, 1.0);
          gl_PointSize = min(2.6 * uScale / d, 9.0);
          vA = smoothstep(300.0, 40.0, d);
        }`,
      fragmentShader: `
        uniform float uOp; varying float vA;
        void main(){
          vec2 uv = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.05, length(uv));
          gl_FragColor = vec4(0.62, 0.84, 1.0, a * uOp * (0.25 + vA));
        }`
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = -4;
    scene.add(this.points);
  }

  update(camPos, speed01, boost) {
    this.mat.uniforms.uCam.value.copy(camPos);
    this.mat.uniforms.uOp.value = 0.16 + speed01 * 0.35 + (boost ? 0.4 : 0);
  }
}

export class Nebula {
  constructor(scene) {
    this.mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec3 vDir;
        void main(){
          vDir = position;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: NOISE_GLSL + `
        uniform float uTime;
        varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          vec2 p1 = vec2(d.x*2.1 + d.z*1.4, d.y*2.4 - d.z*0.9);
          float n = fbm(p1*1.8 + vec2(uTime*0.006, uTime*0.003));
          float n2 = fbm(p1*3.6 - vec2(uTime*0.004, 0.0));
          vec3 col = mix(vec3(0.012,0.018,0.05), vec3(0.07,0.03,0.17), smoothstep(0.42,0.78,n));
          col = mix(col, vec3(0.02,0.10,0.18), smoothstep(0.52,0.86,n2)*0.75);
          col += vec3(0.13,0.07,0.24) * pow(max(n-0.58,0.0)*2.4, 2.0);
          col += vec3(0.02,0.09,0.12) * pow(max(n2-0.62,0.0)*2.6, 2.0);
          float band = smoothstep(0.15,0.0,abs(d.y))*0.35;
          col += vec3(0.05,0.02,0.10)*band;
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(6000, 40, 24), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    scene.add(this.mesh);
  }

  update(camPos, t) {
    this.mesh.position.copy(camPos);
    this.mat.uniforms.uTime.value = t;
  }
}
