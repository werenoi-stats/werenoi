/* Universe 01, The Trident: procedural golden trident on dark stone, with four orbiting gateways. */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const host = document.getElementById("trident");
const canvas = document.getElementById("trident-canvas");
const tip = document.getElementById("otip");
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const COARSE = matchMedia("(pointer: coarse)").matches;
const FLOOR = -2.95;
const fail = () => host.classList.add("no-webgl");

/* ---------- procedural textures ---------- */
function cnv(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h || w; return [c, c.getContext("2d")]; }
function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; }
function tex(c, repeat, srgb) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function grainCanvas(size, lo, hi, seed) {
  const [c, g] = cnv(size), r = rng(seed), im = g.createImageData(size, size);
  for (let i = 0; i < im.data.length; i += 4) { const v = lo + r() * (hi - lo); im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0);
  // granules: small raised beads, as on cast gold
  for (let i = 0; i < size * 6; i++) {
    const x = r() * size, y = r() * size, rad = .6 + r() * 1.6, b = r() < .5 ? 255 : lo * .8;
    g.fillStyle = `rgba(${b},${b},${b},${.25 + r() * .5})`; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
  }
  return c;
}
function engraveCanvas() {
  const W = 256, H = 2048, [c, g] = cnv(W, H), r = rng(77);
  g.fillStyle = "#f3f3f3"; g.fillRect(0, 0, W, H);
  const im = g.getImageData(0, 0, W, H);
  for (let i = 0; i < im.data.length; i += 4) { const v = 222 + r() * 33; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; }
  g.putImageData(im, 0, 0);
  const Y = (y) => (1 - (y + 3) / 4) * H; // shaft spans y -3..1
  g.fillStyle = "#4a4a4a";
  // ring bands with beads
  [[.92, 1], [.62, 1], [-1.22, 1], [-2.5, 1], [-2.9, 1]].forEach(([y]) => {
    const yy = Y(y); g.fillRect(0, yy - 7, W, 2.5); g.fillRect(0, yy + 5, W, 2.5);
    for (let x = 4; x < W; x += 12) { g.beginPath(); g.arc(x, yy, 2.4, 0, 7); g.fill(); }
  });
  // helical engraving, lower shaft (tileable around the circumference)
  g.strokeStyle = "rgba(60,60,60,.85)"; g.lineWidth = 2;
  const y0 = Y(-2.5) - 14, y1 = Y(-2.9) + 12;
  g.save(); g.beginPath(); g.rect(0, y0, W, y1 - y0); g.clip();
  for (let k = -12; k < 30; k++) { g.beginPath(); g.moveTo(0, y0 + k * 18); g.lineTo(W, y0 + k * 18 - 90); g.stroke(); g.beginPath(); g.moveTo(0, y0 + k * 18 + 6); g.lineTo(W, y0 + k * 18 + 96); g.stroke(); }
  g.restore();
  // chevrons, upper shaft
  g.lineWidth = 2.5;
  for (let y = Y(.58) + 18; y < Y(.1); y += 26) { g.beginPath(); for (let x = 0; x <= W; x += 32) { g.lineTo(x, y + ((x / 32) % 2 ? 9 : -9)); } g.stroke(); }
  // inscriptions, reading upward along the shaft
  const font = (px) => `italic 500 ${px}px "Bodoni Moda", "Didot", Georgia, serif`;
  g.fillStyle = "#3a3a3a"; g.textAlign = "center"; g.textBaseline = "middle";
  [[W * .25, Y(-.45), "WERENOI", 58, "26px"], [W * .75, Y(-.45), "XVII V MMXXV", 40, "14px"]].forEach(([x, y, s, px, ls]) => {
    g.save(); g.translate(x, y); g.rotate(-Math.PI / 2); g.font = font(px); if ("letterSpacing" in g) g.letterSpacing = ls; g.fillText(s, 0, 0); g.restore();
  });
  return c;
}
function stoneCanvas() {
  const S = 512, [c, g] = cnv(S), r = rng(9);
  g.fillStyle = "#2b2722"; g.fillRect(0, 0, S, S);
  const blob = (x, y, rad, col) => {
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
      const X = x + dx, Y = y + dy; if (X + rad < 0 || X - rad > S || Y + rad < 0 || Y - rad > S) continue;
      const gr = g.createRadialGradient(X, Y, 0, X, Y, rad); gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(X - rad, Y - rad, rad * 2, rad * 2);
    }
  };
  for (let i = 0; i < 900; i++) { const l = r() < .5; blob(r() * S, r() * S, 6 + r() * 40, l ? `rgba(90,82,72,${.05 + r() * .08})` : `rgba(8,7,6,${.08 + r() * .12})`); }
  const im = g.getImageData(0, 0, S, S);
  for (let i = 0; i < im.data.length; i += 4) { const n = (r() - .5) * 26; im.data[i] += n; im.data[i + 1] += n; im.data[i + 2] += n; }
  g.putImageData(im, 0, 0);
  return c;
}
function pigmentCanvas() {
  const S = 1024, [c, g] = cnv(S), r = rng(31), cx = S / 2, cy = S / 2;
  // red pigment, laid in irregular smears around the base
  for (let p = 0; p < 5; p++) {
    const a = r() * 6.28, d = 140 + r() * 260, px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d * .8;
    for (let i = 0; i < 70; i++) {
      const x = px + (r() - .5) * 220, y = py + (r() - .5) * 120, rad = 10 + r() * 60;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(${110 + r() * 40},${18 + r() * 14},${14 + r() * 8},${.1 + r() * .2})`); gr.addColorStop(1, "rgba(80,10,8,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
    }
  }
  // gold dust, denser near the base
  for (let i = 0; i < 14000; i++) {
    const a = r() * 6.28, d = Math.pow(r(), 1.8) * 500, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
    g.fillStyle = `rgba(${235 + r() * 20},${190 + r() * 40},${110 + r() * 50},${.25 + r() * .7})`;
    g.fillRect(x, y, .6 + r() * 1.6, .6 + r() * 1.6);
  }
  const fade = g.createRadialGradient(cx, cy, S * .3, cx, cy, S * .5);
  fade.addColorStop(0, "rgba(0,0,0,1)"); fade.addColorStop(1, "rgba(0,0,0,0)");
  g.globalCompositeOperation = "destination-in"; g.fillStyle = fade; g.fillRect(0, 0, S, S);
  return c;
}
function grooveCanvas() {
  const S = 512, [c, g] = cnv(S), m = S / 2;
  g.fillStyle = "#0c0b0a"; g.fillRect(0, 0, S, S);
  for (let rr = m; rr > m * .34; rr -= 1.6) { g.strokeStyle = rr % 3.2 < 1.6 ? "#1d1b19" : "#080807"; g.lineWidth = 1; g.beginPath(); g.arc(m, m, rr, 0, 7); g.stroke(); }
  return c;
}
function dotCanvas() {
  const [c, g] = cnv(64), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.25, "rgba(255,240,200,.8)"); gr.addColorStop(1, "rgba(255,200,120,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return c;
}

/* ---------- scene ---------- */
async function main() {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" }); }
  catch (e) { fail(); return; }
  if (document.fonts && document.fonts.load) {
    await Promise.race([document.fonts.load('italic 500 40px "Bodoni Moda"'), new Promise((r) => setTimeout(r, 1500))]).catch(() => {});
  }
  let tier = COARSE || innerWidth < 760 ? 1 : 2;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = tier === 2;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x060504, 1);
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); fail(); canvas.classList.remove("ready"); }, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060504);
  scene.fog = new THREE.Fog(0x060504, 10, 26);

  // studio reflections: dark room, warm softboxes, a low ember strip
  const pm = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), new THREE.MeshBasicMaterial({ color: 0x070504, side: THREE.BackSide })));
  const panel = (w, h, pos, rgb) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); m.material.color.setRGB(...rgb); m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m); };
  panel(7, 3.5, [-5, 7, 5], [7, 5.2, 3.2]);
  panel(1.4, 9, [8, 1, -2], [4, 2.9, 1.7]);
  panel(9, 1.6, [0, 4, -8], [2.6, 1.9, 1.1]);
  panel(12, 2, [0, -6, 4], [1.4, .2, .1]);
  panel(3, 3, [4, 0, 9], [.7, .55, .4]);
  scene.environment = pm.fromScene(env, .035).texture;
  pm.dispose();

  // materials
  const grain = tex(grainCanvas(256, 170, 255, 5), [6, 6]);
  const goldOpts = { color: 0xf1cc82, metalness: 1, roughness: .34, roughnessMap: grain, bumpMap: grain, bumpScale: 1.2, clearcoat: .2, clearcoatRoughness: .3, envMapIntensity: 1.25 };
  const gold = new THREE.MeshPhysicalMaterial(goldOpts);
  const engrave = engraveCanvas();
  const shaftMat = new THREE.MeshPhysicalMaterial({ ...goldOpts, map: tex(engrave, null, true), bumpMap: tex(engrave), bumpScale: 3, roughnessMap: tex(grainCanvas(256, 170, 255, 8), [1, 8]) });
  const gem = new THREE.MeshPhysicalMaterial({ color: 0x07070a, metalness: .15, roughness: .05, clearcoat: 1, clearcoatRoughness: .02, iridescence: .45, iridescenceIOR: 1.5, envMapIntensity: 2.4, flatShading: true });

  /* ---------- the trident ---------- */
  const trident = new THREE.Group();
  const add = (geo, mat, setup) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; if (setup) setup(m); trident.add(m); return m; };
  const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
  // pommel
  add(lathe([[0, -3.38], [.06, -3.36], [.12, -3.29], [.15, -3.18], [.13, -3.08], [.09, -3.02], [.1, -2.99], [.085, -2.97]]), gold);
  // shaft with engravings
  add(new THREE.CylinderGeometry(.085, .085, 4, 48, 1, true), shaftMat, (m) => { m.position.y = -1; m.rotation.y = -Math.PI / 2; });
  // grip wraps and bands
  for (let i = 0; i < 11; i++) add(new THREE.TorusGeometry(.092, .017, 10, 40), gold, (m) => { m.rotation.x = Math.PI / 2; m.position.y = -2.38 + i * .1; });
  [-2.5, -1.22, .62].forEach((y) => add(new THREE.TorusGeometry(.098, .024, 12, 44), gold, (m) => { m.rotation.x = Math.PI / 2; m.position.y = y; }));
  // collar and head socket
  add(lathe([[.085, .95], [.12, 1], [.125, 1.05], [.1, 1.08], [.16, 1.15], [.2, 1.27], [.17, 1.4], [.11, 1.47], [.14, 1.52], [.1, 1.58], [0, 1.6]], 56), gold);
  // black diamonds set front and back, in gold bezels
  [1, -1].forEach((s) => {
    add(new THREE.OctahedronGeometry(.1, 0), gem, (m) => { m.scale.set(1, 1.35, .55); m.position.set(0, 1.27, .19 * s); });
    add(new THREE.TorusGeometry(.105, .016, 10, 36), gold, (m) => { m.scale.set(1, 1.3, 1); m.position.set(0, 1.27, .185 * s); });
  });
  // crossbar: a main arc and a finer lower arc
  const arc = (pts, r) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0))), 80, r, 16);
  add(arc([[-1.02, 2.02], [-.8, 1.74], [-.42, 1.58], [0, 1.54], [.42, 1.58], [.8, 1.74], [1.02, 2.02]], .062), gold);
  add(arc([[-.78, 1.62], [-.45, 1.44], [0, 1.4], [.45, 1.44], [.78, 1.62]], .026), gold);
  [-.78, .78, 0].forEach((x) => add(new THREE.SphereGeometry(x ? .045 : .06, 20, 14), gold, (m) => m.position.set(x, x ? 1.62 : 1.4, 0)));
  [-1.02, 1.02].forEach((x) => add(new THREE.SphereGeometry(.075, 24, 16), gold, (m) => m.position.set(x, 2.02, 0)));
  // blades: four-sided lathe, flattened
  const blade = (pts) => { const g = lathe(pts, 6); g.scale(1, 1, .4); g.computeVertexNormals(); return g; };
  add(new THREE.CylinderGeometry(.055, .068, 1.05, 24), gold, (m) => m.position.y = 2.1);
  add(blade([[0, 2.55], [.12, 2.72], [.15, 2.95], [.1, 3.2], [0, 3.55]]), gold);
  add(new THREE.TorusGeometry(.06, .018, 8, 28), gold, (m) => { m.rotation.x = Math.PI / 2; m.position.y = 2.6; });
  [-1, 1].forEach((s) => {
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(1.02 * s, 2.02, 0), new THREE.Vector3(1.09 * s, 2.4, 0), new THREE.Vector3(1.06 * s, 2.76, 0)]), 30, .052, 14), gold);
    add(blade([[0, 2.7], [.095, 2.84], [.115, 3.0], [.07, 3.16], [0, 3.38]]), gold, (m) => { m.position.x = 1.06 * s; m.rotation.z = -.05 * s; });
    add(new THREE.ConeGeometry(.045, .26, 12), gold, (m) => { m.position.set(1.2 * s, 2.76, 0); m.rotation.z = s > 0 ? Math.PI + .55 : Math.PI - .55; });
  });
  trident.scale.setScalar(.86);
  scene.add(trident);

  /* ---------- ground ---------- */
  const stone = tex(stoneCanvas(), [12, 12], true);
  const stoneBump = tex(stoneCanvas(), [12, 12]);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(32, 72), new THREE.MeshStandardMaterial({ map: stone, bumpMap: stoneBump, bumpScale: 2.5, roughness: .93, metalness: 0, color: 0xb0a596 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = FLOOR; ground.receiveShadow = true;
  scene.add(ground);
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ map: tex(pigmentCanvas(), null, true), transparent: true, depthWrite: false, roughness: .55, metalness: .35, polygonOffset: true, polygonOffsetFactor: -2 }));
  decal.rotation.x = -Math.PI / 2; decal.position.y = FLOOR + .002; decal.receiveShadow = true;
  scene.add(decal);

  /* ---------- light ---------- */
  const key = new THREE.SpotLight(0xffefd6, 0, 0, .42, .85, 2);
  key.position.set(-2.6, 9.5, 4.2); key.target.position.set(0, -.6, 0);
  key.castShadow = tier === 2; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.0004; key.shadow.normalBias = .02; key.shadow.camera.near = 4; key.shadow.camera.far = 20;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xffe2b4, 2.6); rim.position.set(5, 4, -6); scene.add(rim);
  const ember = new THREE.PointLight(0xff3018, 7, 0, 2); ember.position.set(-2.4, FLOOR + .7, 1.6); scene.add(ember);
  scene.add(new THREE.HemisphereLight(0x3a2c1a, 0x050403, .7));
  const KEY_I = 300;

  /* ---------- gold dust ---------- */
  const N = tier === 2 ? 650 : 280, r = rng(4), pos = new Float32Array(N * 3), col = new Float32Array(N * 3), spd = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = r() * 6.28, d = 1 + Math.sqrt(r()) * 5.5;
    pos[i * 3] = Math.cos(a) * d; pos[i * 3 + 1] = FLOOR + r() * 8.5; pos[i * 3 + 2] = Math.sin(a) * d - 1;
    const red = r() < .12; col.set(red ? [.75, .16, .1] : [1, .78 + r() * .15, .45 + r() * .2], i * 3); spd[i] = .05 + r() * .18;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); dustGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: .05, map: tex(dotCanvas()), vertexColors: true, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  scene.add(dust);

  /* ---------- the four gateways ---------- */
  const glowTex = tex(dotCanvas());
  const gw = [];
  function gateway(dest, build, y, phase) {
    const g = new THREE.Group(), face = new THREE.Group(), body = new THREE.Group(), m = gold.clone();
    m.emissive = new THREE.Color(0xffa83a); m.emissiveIntensity = 0;
    build(body, m); face.add(body); g.add(face);
    body.traverse((o) => { if (o.isMesh) o.castShadow = tier === 2; });
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xf5c46a, transparent: true, opacity: .1, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(1.8); g.add(halo);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(.62, 12, 8), new THREE.MeshBasicMaterial({ visible: false })); g.add(hit);
    const btn = document.querySelector(`.dest [data-go="${dest}"]`);
    const o = { dest, g, face, body, m, halo, hit, y, phase, h: 0, name: btn ? btn.querySelector(".nm").textContent : dest, fn: btn ? btn.querySelector(".fn").textContent : "" };
    hit.userData.gw = o; scene.add(g); gw.push(o);
    const lb = document.createElement("button"); lb.type = "button"; lb.className = "olabel"; lb.textContent = o.name; lb.tabIndex = -1;
    lb.addEventListener("click", () => window.WN && window.WN.go(dest));
    host.querySelector(".world-inner").appendChild(lb); o.label = lb;
    return o;
  }
  const lacquer = new THREE.MeshPhysicalMaterial({ color: 0x0c0b0a, roughness: .22, metalness: .2, clearcoat: 1, clearcoatRoughness: .08 });
  gateway("archive", (b, m) => { // a record
    const grooves = new THREE.MeshPhysicalMaterial({ map: tex(grooveCanvas(), null, true), roughness: .5, metalness: .1, clearcoat: .7, clearcoatRoughness: .2, envMapIntensity: .6 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(.46, .46, .02, 72), [lacquer, grooves, grooves]);
    const label = new THREE.Mesh(new THREE.CylinderGeometry(.155, .155, .026, 48), m);
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .03, 12), lacquer);
    const spin = new THREE.Group(); spin.add(disc, label, hole); spin.rotation.x = Math.PI / 2 - .45; b.add(spin); b.userData.spin = (dt) => { disc.rotation.y += dt * 1.4; label.rotation.y += dt * 1.4; };
  }, 1.0, 0);
  gateway("numbers", (b, m) => { // rising gold bars
    const base = new THREE.Mesh(new THREE.BoxGeometry(.86, .05, .36), lacquer); base.position.y = -.38; b.add(base);
    const hs = [.22, .38, .5, .74], tops = [];
    hs.forEach((h, i) => { const x = -.3 + i * .2, bar = new THREE.Mesh(new THREE.BoxGeometry(.13, h, .13), m); bar.position.set(x, -.355 + h / 2, 0); b.add(bar); tops.push(new THREE.Vector3(x, -.355 + h + .1, 0)); });
    b.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tops), 40, .012, 8), m));
    tops.forEach((p) => { const s = new THREE.Mesh(new THREE.SphereGeometry(.028, 12, 10), m); s.position.copy(p); b.add(s); });
    b.userData.spin = (dt, t) => { b.rotation.y = Math.sin(t * .5) * .5; };
  }, -.5, 1);
  gateway("legacy", (b, m) => { // a framed certification plaque
    const frame = new THREE.Mesh(new THREE.BoxGeometry(.6, .78, .06), lacquer);
    const fillet = new THREE.Mesh(new THREE.BoxGeometry(.52, .7, .064), m);
    const mat = new THREE.Mesh(new THREE.BoxGeometry(.48, .66, .07), new THREE.MeshStandardMaterial({ color: 0x5e1410, roughness: 1 }));
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .012, 56), m); disc.rotation.x = Math.PI / 2; disc.position.set(0, .07, .04);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .016, 24), lacquer); hub.rotation.x = Math.PI / 2; hub.position.set(0, .07, .042);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(.22, .05, .01), m); plate.position.set(0, -.23, .04);
    b.add(frame, fillet, mat, disc, hub, plate);
    b.userData.spin = (dt, t) => { b.rotation.y = Math.sin(t * .4 + 1) * .35; };
  }, .95, 2);
  gateway("vault", (b, m) => { // a vault wheel
    const steel = new THREE.MeshPhysicalMaterial({ color: 0x3a3229, metalness: 1, roughness: .38, envMapIntensity: 1.1 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.38, .38, .1, 64), steel); body.rotation.x = Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.35, .026, 12, 64), m); ring.position.z = .05;
    const wheel = new THREE.Group(); wheel.position.z = .07;
    for (let i = 0; i < 40; i++) { const tk = new THREE.Mesh(new THREE.BoxGeometry(.008, i % 5 ? .03 : .055, .01), m), a = i / 40 * Math.PI * 2; tk.position.set(Math.cos(a) * .28, Math.sin(a) * .28, 0); tk.rotation.z = a + Math.PI / 2; wheel.add(tk); }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.09, .11, .08, 32), m); hub.rotation.x = Math.PI / 2; hub.position.z = .05; wheel.add(hub);
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2 + .3, sp = new THREE.Mesh(new THREE.CylinderGeometry(.016, .016, .44, 10), m);
      sp.position.set(Math.cos(a) * .22, Math.sin(a) * .22, .1); sp.rotation.z = a - Math.PI / 2; wheel.add(sp);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(.036, 14, 10), m); knob.position.set(Math.cos(a) * .44, Math.sin(a) * .44, .1); wheel.add(knob);
    }
    b.add(body, ring, wheel);
    b.userData.spin = (dt) => { wheel.rotation.z -= dt * .45; };
  }, -.45, 3);

  /* ---------- camera & post ---------- */
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 60);
  const look = new THREE.Vector3();
  let W = 0, H = 0, rx = 2.7, rz = 1.7, dist = 12, shiftY = 0;
  let composer = null, bloom = null;
  function setupPost() {
    if (tier < 2) { composer = null; return; }
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(W, H), .5, .55, .8);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }
  function resize() {
    W = host.clientWidth; H = host.clientHeight; if (!W || !H) return;
    const aspect = W / H, t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, tier === 2 ? 1.75 : 1.5));
    renderer.setSize(W, H, false);
    camera.aspect = aspect;
    const portrait = aspect < .85;
    rx = portrait ? 1.55 : aspect < 1.25 ? 2.2 : 2.75; rz = portrait ? 1.15 : 1.6;
    const needH = portrait ? 11 : 8.4, needW = (rx + .75) * 2;
    dist = Math.max(needH / 2 / t, needW / 2 / (t * aspect));
    shiftY = needH * (portrait ? .17 : .055);
    camera.updateProjectionMatrix();
    scene.fog.near = dist; scene.fog.far = dist + 14;
    if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(W, H); }
  }
  setupPost();
  resize();
  addEventListener("resize", resize);

  /* ---------- interaction ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hits = gw.map((o) => o.hit);
  let speed = 1, mx = 0, my = 0, smx = 0, smy = 0, hovered = null, external = null, drag = null, spinV = 0, rot = 0, orbit = 0;
  function pick(cx, cy) {
    const rc = canvas.getBoundingClientRect();
    ndc.set(((cx - rc.left) / rc.width) * 2 - 1, -((cy - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(hits, false)[0];
    return h ? h.object.userData.gw : null;
  }
  function setHover(o) {
    if (o === hovered) return;
    hovered = o;
    canvas.classList.toggle("pointing", !!o);
    if (window.WN) window.WN.lightDest(o ? o.dest : null);
    if (o) { tip.textContent = ""; const b = document.createElement("b"); b.textContent = o.name; tip.append(b, o.fn); tip.classList.add("on"); }
    else tip.classList.remove("on");
  }
  canvas.addEventListener("pointermove", (e) => {
    const rc = canvas.getBoundingClientRect();
    mx = ((e.clientX - rc.left) / rc.width) * 2 - 1; my = ((e.clientY - rc.top) / rc.height) * 2 - 1;
    if (drag) {
      const dx = e.clientX - drag.x; drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(e.clientY - drag.y0));
      spinV = (e.clientX - drag.lx) * .006; rot += spinV; orbit += spinV * .6; drag.lx = e.clientX;
      return;
    }
    if (e.pointerType !== "touch") setHover(pick(e.clientX, e.clientY));
  });
  canvas.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y0: e.clientY, lx: e.clientX, moved: 0, t: performance.now() };
    if (e.pointerType !== "touch") { canvas.setPointerCapture(e.pointerId); canvas.classList.add("grabbing"); }
  });
  const end = (e) => {
    if (!drag) return;
    const click = drag.moved < 7 && performance.now() - drag.t < 600;
    drag = null; canvas.classList.remove("grabbing");
    if (click && e.type === "pointerup") { const o = pick(e.clientX, e.clientY); if (o && window.WN) window.WN.go(o.dest); }
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", () => { if (!drag) { setHover(null); mx = my = 0; } });
  window.WN_SCENE = { highlight: (dest) => { external = dest; }, points: () => gw.map((o) => { const q = o.g.position.clone().project(camera), rc = canvas.getBoundingClientRect(); return { dest: o.dest, x: rc.left + (q.x * .5 + .5) * rc.width, y: rc.top + (-q.y * .5 + .5) * rc.height }; }) };

  /* ---------- loop ---------- */
  const v = new THREE.Vector3(), clock = { t: 0 };
  let last = performance.now(), born = -1, frames = 0, slow = 0, ready = false;
  const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  function render() { if (composer) composer.render(); else renderer.render(scene, camera); }
  function loop(now) {
    requestAnimationFrame(loop);
    const visible = !document.hidden && window.WN_TRIDENT_VISIBLE !== false && !document.documentElement.classList.contains("locked");
    if (!visible && ready) { last = now; return; }
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (born < 0) born = now;
    const t = clock.t += dt, intro = REDUCED ? 1 : ease((now - born) / 2600);

    // scroll: the camera rises as the universe is left behind
    const rc = host.getBoundingClientRect(), sp = Math.min(1, Math.max(0, -rc.top / Math.max(1, rc.height)));

    // trident motion
    if (!drag) { spinV *= .94; rot += spinV; if (!REDUCED) rot += dt * (.16 + sp * .5); }
    trident.rotation.y = rot - (1 - intro) * 2.4;
    trident.position.y = .2 + (REDUCED ? 0 : Math.sin(t * .8) * .06) - (1 - intro) * 1.6;
    smx += (mx - smx) * .05; smy += (my - smy) * .05;
    trident.rotation.z = -smx * .04; trident.rotation.x = smy * .03;
    key.intensity = KEY_I * ease((now - born) / 1800 + (REDUCED ? 1 : 0));

    // gateways
    speed += ((hovered || external ? .2 : 1) - speed) * .06;
    if (!REDUCED && !drag) orbit += dt * .11 * speed;
    gw.forEach((o, i) => {
      const a = orbit + i * Math.PI / 2 + .55, lift = REDUCED ? 0 : Math.sin(t * .7 + o.phase) * .12;
      o.g.position.set(Math.cos(a) * rx, o.y + lift + Math.sin(a) * -.25 + (1 - intro) * -2.5, Math.sin(a) * rz);
      o.face.lookAt(camera.position.x, o.g.position.y, camera.position.z);
      if (!REDUCED && o.body.userData.spin) o.body.userData.spin(dt, t);
      const on = hovered === o || external === o.dest ? 1 : 0;
      o.h += (on - o.h) * .12;
      o.g.scale.setScalar((1.1 + o.h * .2) * Math.min(1, intro * 1.4));
      o.m.emissiveIntensity = o.h * .4;
      o.halo.material.opacity = .05 + o.h * .55;
      // labels for touch screens, and the tooltip
      v.copy(o.g.position).project(camera);
      const x = (v.x * .5 + .5) * W, y = (-v.y * .5 + .5) * H;
      o.label.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, 40px)`;
      o.label.classList.toggle("behind", o.g.position.z < -.2);
      if (hovered === o) { tip.style.left = (x + 44) + "px"; tip.style.top = y + "px"; }
    });

    // dust drift
    const p = dustGeo.attributes.position.array;
    if (!REDUCED) {
      for (let i = 0; i < N; i++) { p[i * 3 + 1] += spd[i] * dt; p[i * 3] += Math.sin(t * .3 + i) * .0016; if (p[i * 3 + 1] > 5.6) p[i * 3 + 1] = FLOOR; }
      dustGeo.attributes.position.needsUpdate = true;
    }

    // camera: parallax, gentle dolly, scroll rise
    camera.position.set(smx * .6, .6 - smy * .35 + sp * 2.2, dist * (1 - sp * .18) + (1 - intro) * 2);
    look.set(0, .27 - shiftY + sp * 1.8, 0);
    camera.lookAt(look);

    render();
    if (!ready) { ready = true; canvas.classList.add("ready"); host.classList.remove("no-webgl"); }

    // adaptive quality: drop bloom then shadows if the device struggles
    if (++frames > 30 && frames < 240) {
      slow = slow * .95 + (dt > 1 / 32 ? 1 : 0) * .05;
      if (slow > .5 && tier === 2) {
        tier = 1; composer = null; renderer.shadowMap.enabled = false; key.castShadow = false;
        scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((mm) => mm.needsUpdate = true); });
        resize(); slow = 0; frames = 31;
      } else if (slow > .5 && tier === 1) { tier = 0; renderer.setPixelRatio(1); renderer.setSize(W, H, false); slow = 0; frames = 240; }
    }
  }
  requestAnimationFrame(loop);
}

try { main().catch((e) => { console.error(e); fail(); }); }
catch (e) { console.error(e); fail(); }
