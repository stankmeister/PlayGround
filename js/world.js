import * as THREE from 'three';
import { radialTexture } from './fx.js';

function makeTrackTexture() {
  const w = 512, h = 1024;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');

  const base = ctx.createLinearGradient(0, 0, w, 0);
  base.addColorStop(0, '#0b0820');
  base.addColorStop(0.5, '#121031');
  base.addColorStop(1, '#0b0820');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // subtle hex-ish tile grid
  ctx.strokeStyle = 'rgba(120, 100, 200, 0.075)';
  ctx.lineWidth = 1;
  for (let y = 0; y <= h; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  for (let x = 0; x <= w; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  // outer edge glow strips
  const edge = (x0, dir, colorA, colorB) => {
    const g = ctx.createLinearGradient(x0, 0, x0 + dir * 46, 0);
    g.addColorStop(0, colorA);
    g.addColorStop(0.28, colorB);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(Math.min(x0, x0 + dir * 46), 0, 46, h);
  };
  edge(0, 1, 'rgba(62,246,255,0.95)', 'rgba(62,246,255,0.12)');
  edge(w, -1, 'rgba(255,62,165,0.95)', 'rgba(255,62,165,0.12)');

  // lane dashes
  ctx.strokeStyle = 'rgba(150, 140, 255, 0.35)';
  ctx.lineWidth = 4;
  ctx.setLineDash([34, 52]);
  for (const x of [w * 0.25, w * 0.75]) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // center energy line
  const cg = ctx.createLinearGradient(0, 0, 0, h);
  cg.addColorStop(0, 'rgba(255,255,255,0)');
  cg.addColorStop(0.5, 'rgba(180,160,255,0.28)');
  cg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = cg;
  ctx.fillRect(w / 2 - 1.5, 0, 3, h);

  // chevrons
  ctx.strokeStyle = 'rgba(62, 246, 255, 0.28)';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  for (let y = 40; y < h; y += 128) {
    ctx.beginPath();
    ctx.moveTo(w / 2 - 34, y + 26);
    ctx.lineTo(w / 2, y);
    ctx.lineTo(w / 2 + 34, y + 26);
    ctx.stroke();
  }

  // little sparkles
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(${140 + Math.random() * 100},${160 + Math.random() * 80},255,${0.04 + Math.random() * 0.1})`;
    const s = 1 + Math.random() * 2.5;
    ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 26);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeGridTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(255, 62, 165, 0.65)';
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(255,62,165,0.8)';
  ctx.shadowBlur = 8;
  ctx.strokeRect(1, 1, 254, 254);
  ctx.strokeStyle = 'rgba(62, 246, 255, 0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(128, 0); ctx.lineTo(128, 256);
  ctx.moveTo(0, 128); ctx.lineTo(256, 128);
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(80, 80);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeBuildingTexture(hue = 280) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0a0718';
  ctx.fillRect(0, 0, 128, 256);
  const colors = ['#ffd28a', '#7de8ff', '#ff8bd6', '#a6a0ff'];
  for (let y = 8; y < 250; y += 13) {
    for (let x = 8; x < 122; x += 12) {
      if (Math.random() < 0.42) {
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        ctx.globalAlpha = 0.3 + Math.random() * 0.65;
        ctx.fillRect(x, y, 5, 5);
      }
    }
  }
  ctx.globalAlpha = 1;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, `rgba(${hue === 280 ? '120,60,255' : '255,60,150'},0.18)`);
  grad.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeCloudTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 7; i++) {
    const x = 40 + Math.random() * 176;
    const y = 45 + Math.random() * 40;
    const r = 24 + Math.random() * 36;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255, 220, 255, 0.32)');
    g.addColorStop(0.55, 'rgba(230, 160, 255, 0.13)');
    g.addColorStop(1, 'rgba(200, 120, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.menuDrift = 0;
    this._buildSky();
    this._buildTrack();
    this._buildRails();
    this._buildArches();
    this._buildScenery();
    this._buildDust();
    this._buildLights();
  }

  _buildSky() {
    const geo = new THREE.SphereGeometry(620, 32, 24);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color('#0b0524') },
        midColor: { value: new THREE.Color('#3a1154') },
        lowColor: { value: new THREE.Color('#b13363') },
        horizonColor: { value: new THREE.Color('#ff9b62') },
        sunDir: { value: new THREE.Vector3(-0.22, 0.09, -1).normalize() }
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor; uniform vec3 midColor; uniform vec3 lowColor; uniform vec3 horizonColor; uniform vec3 sunDir;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, -0.2, 1.0);
          vec3 col = mix(horizonColor, lowColor, smoothstep(-0.01, 0.12, h));
          col = mix(col, midColor, smoothstep(0.08, 0.38, h));
          col = mix(col, topColor, smoothstep(0.42, 0.95, h));
          float sun = max(dot(normalize(vDir), sunDir), 0.0);
          col += vec3(1.0, 0.52, 0.22) * pow(sun, 160.0) * 1.3;
          col += vec3(1.0, 0.40, 0.40) * pow(sun, 16.0) * 0.22;
          // subtle horizontal synth bands near the horizon
          float band = sin(h * 160.0) * 0.5 + 0.5;
          col += vec3(1.0, 0.25, 0.5) * band * 0.012 * smoothstep(0.25, 0.0, abs(h - 0.07));
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.position.y = 30;
    this.scene.add(this.sky);

    // sun halo
    const sunMat = new THREE.SpriteMaterial({
      map: radialTexture('rgba(255,220,170,0.95)', 'rgba(255,110,60,0)', 256),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.95
    });
    this.sun = new THREE.Sprite(sunMat);
    this.sun.scale.set(180, 180, 1);
    this.sun.position.set(-140, 62, -520);
    this.scene.add(this.sun);

    const discMat = new THREE.SpriteMaterial({
      map: radialTexture('rgba(255,236,205,1)', 'rgba(255,140,80,0)', 128),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.sunDisc = new THREE.Sprite(discMat);
    this.sunDisc.scale.set(42, 42, 1);
    this.sunDisc.position.set(-140, 62, -519);
    this.scene.add(this.sunDisc);

    // stars
    const starCount = 420;
    const pos = new Float32Array(starCount * 3);
    const col = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 420 + Math.random() * 140;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.85 + 0.12);
      pos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      pos[i * 3 + 1] = Math.cos(phi) * r + 80;
      pos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
      const c = new THREE.Color().setHSL(0.55 + Math.random() * 0.25, 0.5, 0.7 + Math.random() * 0.3);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({
      size: 1.4, vertexColors: true, transparent: true, opacity: 0.85,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
    }));
    this.scene.add(this.stars);

    // clouds
    this.clouds = [];
    const cloudTex = makeCloudTexture();
    for (let i = 0; i < 9; i++) {
      const mat = new THREE.SpriteMaterial({
        map: cloudTex, transparent: true, depthWrite: false,
        opacity: 0.22 + Math.random() * 0.22, blending: THREE.AdditiveBlending
      });
      const s = new THREE.Sprite(mat);
      s.position.set((Math.random() - 0.5) * 420, 45 + Math.random() * 80, -200 - Math.random() * 280);
      const sc = 70 + Math.random() * 90;
      s.scale.set(sc, sc * 0.42, 1);
      this.scene.add(s);
      this.clouds.push({ sprite: s, drift: 0.4 + Math.random() * 1.1 });
    }
  }

  _buildTrack() {
    this.trackTex = makeTrackTexture();
    const geo = new THREE.PlaneGeometry(18.6, 620);
    const mat = new THREE.MeshStandardMaterial({
      map: this.trackTex,
      roughness: 0.82,
      metalness: 0.18,
      color: 0xffffff,
      emissive: 0x080411,
      emissiveIntensity: 0.4
    });
    this.track = new THREE.Mesh(geo, mat);
    this.track.rotation.x = -Math.PI / 2;
    this.track.position.set(0, 0, -270);
    this.scene.add(this.track);

    // underside / base slab
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(19.6, 1.2, 620),
      new THREE.MeshStandardMaterial({ color: 0x0c0820, roughness: 0.5, metalness: 0.5 })
    );
    slab.position.set(0, -0.72, -270);
    this.scene.add(slab);

    // void grid below
    const grid = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshBasicMaterial({
        map: makeGridTexture(),
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    grid.rotation.x = -Math.PI / 2;
    grid.position.set(0, -10, -260);
    this.scene.add(grid);
    this.grid = grid;

    const voidPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshBasicMaterial({ color: 0x06030f })
    );
    voidPlane.rotation.x = -Math.PI / 2;
    voidPlane.position.set(0, -11, -260);
    this.scene.add(voidPlane);
  }

  _buildRails() {
    const railMat = new THREE.MeshStandardMaterial({ color: 0x191232, roughness: 0.4, metalness: 0.7 });
    const neonCyan = new THREE.MeshBasicMaterial({ color: 0x3ef6ff });
    const neonPink = new THREE.MeshBasicMaterial({ color: 0xff3ea5 });
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 620), railMat);
      rail.position.set(side * 9.65, 0.1, -270);
      this.scene.add(rail);
      const glow = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 620), side < 0 ? neonCyan : neonPink);
      glow.position.set(side * 9.65, 0.31, -270);
      this.scene.add(glow);

      const wall = new THREE.Mesh(
        new THREE.PlaneGeometry(620, 1.8),
        new THREE.MeshBasicMaterial({
          color: side < 0 ? 0x3ef6ff : 0xff3ea5,
          transparent: true,
          opacity: 0.05,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      wall.rotation.y = Math.PI / 2;
      wall.rotation.z = Math.PI / 2;
      wall.position.set(side * 9.85, 1.0, -270);
      this.scene.add(wall);
    }
  }

  _buildArches() {
    this.arches = [];
    const metal = new THREE.MeshStandardMaterial({ color: 0x1a1336, roughness: 0.4, metalness: 0.75 });
    const cyan = new THREE.MeshBasicMaterial({ color: 0x52f7ff });
    const geoPillar = new THREE.BoxGeometry(0.7, 5.6, 0.7);
    const geoCap = new THREE.BoxGeometry(0.5, 0.16, 0.5);
    const capMats = {
      0x3ef6ff: new THREE.MeshBasicMaterial({ color: 0x3ef6ff, transparent: true, opacity: 0.9 }),
      0xff6ac8: new THREE.MeshBasicMaterial({ color: 0xff6ac8, transparent: true, opacity: 0.9 })
    };

    for (let i = 0; i < 13; i++) {
      const g = new THREE.Group();
      const color = i % 2 ? 0x3ef6ff : 0xff6ac8;
      const left = new THREE.Mesh(geoPillar, metal);
      left.position.set(-10.9, 2.8, 0);
      const right = new THREE.Mesh(geoPillar, metal);
      right.position.set(10.9, 2.8, 0);
      const capL = new THREE.Mesh(geoCap, capMats[color]);
      capL.position.set(-10.9, 5.65, 0);
      const capR = new THREE.Mesh(geoCap, capMats[color]);
      capR.position.set(10.9, 5.65, 0);
      g.add(left, right, capL, capR);

      for (const side of [-1, 1]) {
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
          map: radialTexture(i % 2 ? 'rgba(62,246,255,.5)' : 'rgba(255,62,165,.45)', 'rgba(0,0,0,0)', 128),
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          opacity: 0.85
        }));
        halo.position.set(side * 10.9, 5.7, 0);
        halo.scale.set(3.2, 3.2, 1);
        g.add(halo);
      }

      g.position.z = 18 - i * 30;
      this.scene.add(g);
      this.arches.push({ group: g, index: i });
    }
    this.archSpan = 13 * 30;
  }

  _buildScenery() {
    this.islands = [];
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x18112f, roughness: 0.9, metalness: 0.2, flatShading: true });
    const ringMats = [0xff3ea5, 0x3ef6ff, 0x8c5cff, 0xa7ff4f];
    for (let i = 0; i < 14; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const g = new THREE.Group();
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(3 + Math.random() * 3, 0), rockMat);
      rock.scale.set(1.5, 0.8 + Math.random() * 0.7, 1.4);
      g.add(rock);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(4.2, 0.09, 6, 40),
        new THREE.MeshBasicMaterial({ color: ringMats[i % ringMats.length], transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -1.6;
      g.add(ring);
      g.position.set(side * (20 + Math.random() * 34), -2 + Math.random() * 9, 20 - i * 34);
      g.userData.baseY = g.position.y;
      g.userData.phase = Math.random() * 6;
      g.userData.ring = ring;
      this.scene.add(g);
      this.islands.push(g);
    }

    // skyline
    this.buildings = [];
    const texA = makeBuildingTexture(280);
    const texB = makeBuildingTexture(330);
    const mats = [
      new THREE.MeshBasicMaterial({ map: texA, color: 0x9a8cff, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
      new THREE.MeshBasicMaterial({ map: texB, color: 0xff8bd6, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    ];
    for (let i = 0; i < 20; i++) {
      const mat = mats[i % 2];
      const h = 12 + Math.random() * 34;
      const b = new THREE.Mesh(new THREE.BoxGeometry(6 + Math.random() * 9, h, 6 + Math.random() * 9), mat);
      const side = i % 2 === 0 ? -1 : 1;
      b.position.set(side * (34 + Math.random() * 55), h / 2 - 7, 10 - i * 24);
      b.rotation.y = Math.random() * 0.6;
      this.scene.add(b);
      this.buildings.push(b);
    }
  }

  _buildDust() {
    const count = 260;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 44;
      pos[i * 3 + 1] = 0.3 + Math.random() * 14;
      pos[i * 3 + 2] = 30 - Math.random() * 260;
      const c = new THREE.Color().setHSL(0.5 + Math.random() * 0.35, 0.8, 0.65);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.dust = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.16, vertexColors: true, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);
    this.dustPos = pos;
  }

  _buildLights() {
    const hemi = new THREE.HemisphereLight(0x9d8bff, 0x180b2b, 1.25);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffc49a, 2.1);
    key.position.set(-28, 42, 18);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x54e8ff, 1.3);
    rim.position.set(24, 18, -42);
    this.scene.add(rim);
    const fill = new THREE.PointLight(0x8c5cff, 32, 60, 1.6);
    fill.position.set(0, 8, 12);
    this.scene.add(fill);
    this.fill = fill;
  }

  update(dt, distance, speed, time, camera) {
    // scrolling road
    this.trackTex.offset.y = (distance * 0.047) % 1;
    this.grid.material.map.offset.y = (distance * 0.012) % 1;
    this.grid.material.map.offset.x = (distance * 0.004) % 1;

    // arches recycle
    const move = speed * dt;
    for (const a of this.arches) {
      a.group.position.z += move;
      if (a.group.position.z > 34) a.group.position.z -= this.archSpan;
    }

    // islands and buildings parallax
    for (const g of this.islands) {
      g.position.z += move * 0.22;
      g.position.y = g.userData.baseY + Math.sin(time * 0.7 + g.userData.phase) * 0.7;
      g.userData.ring.rotation.z = time * 0.35 + g.userData.phase;
      if (g.position.z > 50) g.position.z -= 480;
    }
    for (const b of this.buildings) {
      b.position.z += move * 0.12;
      if (b.position.z > 60) b.position.z -= 490;
    }

    // clouds drift
    for (const c of this.clouds) {
      c.sprite.position.x += dt * c.drift;
      if (c.sprite.position.x > 250) c.sprite.position.x = -250;
    }
    this.stars.rotation.y += dt * 0.006;
    this.sun.material.opacity = 0.9 + Math.sin(time * 0.9) * 0.05;

    // floating dust
    const pos = this.dustPos;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i + 2] += move * (0.6 + ((i / 3) % 10) * 0.035);
      if (pos[i + 2] > 34) {
        pos[i + 2] -= 290;
        pos[i] = (Math.random() - 0.5) * 44;
      }
    }
    this.dust.geometry.attributes.position.needsUpdate = true;

    if (this.fill) {
      this.fill.intensity = 38 + Math.sin(time * 3.2) * 8;
    }
    this.sky.rotation.y = time * 0.003;
  }
}
