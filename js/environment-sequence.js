// ====================================================================================================================
// ENVIRONMENT SEQUENCE: the paper world after the cells. The map of Delhi cut and folded into a walker, the green
// painted ground, the arch and the person walking in, people who pop in two, the folded paper creatures (walkers,
// cranes, crawlers, hoppers, rollers) and their meetings and breeding, ink, captions and speech, and the ruins.
//
// NOT REACHED AT THE MOMENT: the cells never hand over to it (see transitions.js, "cells -> environment", which is
// switched off). It is kept whole so it can be brought back.
// ====================================================================================================================

// ---------- the ground ----------
// the ground is a sheet of gold-flecked paper, mirrored from tile to tile so no seam shows
function groundTexture() {
  const t = new THREE.TextureLoader().load("green.jpg"); t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; t.encoding = THREE.sRGBEncoding;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.repeat.set(240 / 26, 240 / 18.6); // one sheet of the green painted paper is 26 units wide // one sheet is 10 units wide, small enough that the scan is never blown up past its own pixels
  return t;
}
const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

// ---------- the paper brood: folded map-paper creatures (from Paper Brood) ----------
// ---------- paper ----------
function makePaperTex(printed) {
  const N = 512, cv = document.createElement("canvas"); cv.width = cv.height = N;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#fbfaf7"; ctx.fillRect(0, 0, N, N);
  for (let i = 0; i < 900; i++) { // fibres
    ctx.strokeStyle = `rgba(60,55,48,${rnd(0.02, 0.07)})`; ctx.lineWidth = rnd(0.4, 1.1);
    const x = rnd(0, N), y = rnd(0, N), a = rnd(0, 6.28), l = rnd(3, 14);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  if (printed) { // newsprint: two columns of tiny grey word-bars and the odd headline
    for (let col = 0; col < 2; col++) {
      const x0 = 18 + col * 250, x1 = x0 + 226;
      for (let y = 20; y < N - 12; y += 9) {
        const head = Math.random() < 0.05, h = head ? 6 : 3;
        let x = x0;
        while (x < x1 - 10) {
          const w = Math.min(rnd(8, head ? 46 : 26), x1 - x);
          ctx.fillStyle = `rgba(28,27,25,${head ? 0.7 : rnd(0.35, 0.55)})`; ctx.fillRect(x, y, w, h);
          x += w + rnd(4, 7);
        }
        if (head) y += 6;
      }
    }
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  return t;
}
const plainPaper = makePaperTex(false);
// fragments cut from the author's own collection of 35 maps (five of them give two fragments): one 8 x 5 sheet, sliced into forty paper textures
let MAPS = [plainPaper];
function loadMaps() {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const COLS = 8, ROWS = 5, T = img.width / COLS, tiles = [];
      for (let i = 0; i < COLS * ROWS; i++) {
        const cv = document.createElement("canvas"); cv.width = cv.height = 512;
        cv.getContext("2d").drawImage(img, (i % COLS) * T, Math.floor(i / COLS) * T, T, T, 0, 0, 512, 512);
        const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
        tiles.push(t);
      }
      MAPS = tiles; res();
    };
    img.onerror = () => res();
    img.src = "maps.jpg";
  });
}
const mapOf = v => MAPS[Math.min(MAPS.length - 1, Math.floor(v * MAPS.length))];

// Map paper is laid on each facet with its own flat projection, so no facet is ever smeared or stretched.
// The projection keeps "up" pointing the same way on every facet and starts from where the facet sits on
// the body, so neighbouring facets show neighbouring parts of the map, like one sheet folded.
// UV_SCALE is map tiles per world unit; buildBody sets it per creature so small creatures still show a
// readable piece of their map.
let UV_SCALE = 0.45;
function paperGeo(tris, off = [0, 0], stretchY = 1) {
  const pos = [], uv = [], k = UV_SCALE;
  for (const t of tris) {
    const P = t.map(v => [v[0], v[1] * stretchY, v[2]]); // the shape it is shown at (legs are stretched later)
    const e1 = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], e2 = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]];
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const nl = Math.hypot(...n) || 1; n = n.map(x => x / nl);
    const ref = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1];
    const rd = ref[0] * n[0] + ref[1] * n[1] + ref[2] * n[2];
    let vAx = [ref[0] - n[0] * rd, ref[1] - n[1] * rd, ref[2] - n[2] * rd];
    const vl = Math.hypot(...vAx) || 1; vAx = vAx.map(x => x / vl);
    const uAx = [vAx[1] * n[2] - vAx[2] * n[1], vAx[2] * n[0] - vAx[0] * n[2], vAx[0] * n[1] - vAx[1] * n[0]];
    const cen = [0, 1, 2].map(i => (P[0][i] + P[1][i] + P[2][i]) / 3);
    const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
    const base = ax >= ay && ax >= az ? [cen[2], cen[1]] : ay >= az ? [cen[0], cen[2]] : [cen[0], cen[1]];
    t.forEach((v, i) => {
      pos.push(v[0], v[1], v[2]);
      const d = [P[i][0] - cen[0], P[i][1] - cen[1], P[i][2] - cen[2]];
      uv.push(off[0] + (base[0] + d[0] * uAx[0] + d[1] * uAx[1] + d[2] * uAx[2]) * k,
              off[1] + (base[1] + d[0] * vAx[0] + d[1] * vAx[1] + d[2] * vAx[2]) * k);
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}
// a leg is a long triangular fold, along y from 0 to 1; len is about how long it is drawn, so its paper isn't stretched
function legGeo(r0, r1, len = 1) {
  const ang = [0.5, 2.594, 4.689];
  const bot = ang.map(a => [Math.cos(a) * r0, 0, Math.sin(a) * r0]);
  const tris = [];
  if (r1 <= 0) for (let i = 0; i < 3; i++) tris.push([bot[i], bot[(i + 1) % 3], [0, 1, 0]]);
  else {
    const top = ang.map(a => [Math.cos(a) * r1, 1, Math.sin(a) * r1]);
    for (let i = 0; i < 3; i++) { const j = (i + 1) % 3; tris.push([bot[i], bot[j], top[j]], [bot[i], top[j], top[i]]); }
  }
  return paperGeo(tris, [Math.random(), Math.random()], len);
}
// ---------- genome ----------
// five kinds of creature; the form gene decides which, so a mutation or a mixed birth can turn one kind into another
const FORMS = ["walker", "floater", "crawler", "hopper", "roller"];
const randomGenome = () => GENES.map(() => Math.random());
function breed(a, b, rate) {
  return a.map((g, i) => {
    let v = Math.random() < 0.5 ? g : b[i];
    if (Math.random() < 0.15) v = (g + b[i]) / 2;
    if (Math.random() < rate) v += gauss() * 0.2;
    return clamp01(v);
  });
}
const S = 1;
const pheno = g => ({
  form: FORMS[Math.min(FORMS.length - 1, Math.floor(g[G.form] * FORMS.length))],
  count: g[G.legs],
  pairs: g[G.legs] < 0.5 ? 2 : 3,
  bulk: lerp(0.6, 1.25, g[G.bulk]) * S,
  stride: g[G.stride],
  leg: lerp(0.8, 1.8, g[G.stride]) * S,
  tone: g[G.tone],
  speed: lerp(0.9, 2.3, g[G.speed]),
  gait: lerp(3, 6.5, g[G.speed]),
  aggr: g[G.aggr],
  neck: lerp(0.2, 1.3, g[G.neck]),
  neckG: g[G.neck],
  wings: g[G.wings],
  crumple: g[G.crumple],
  print: g[G.print],
});
const MUT = 0.18;
// the brood is tiny beside the elephant: about half the height of its knee
const PACE = { walker: 1, floater: 0.65, crawler: 0.6, hopper: 1, roller: 1.15 };
const TURN = { walker: 2.2, floater: 1.1, crawler: 2.6, hopper: 0, roller: 1.6 };
// ---------- building bodies ----------
let creatures = [], scraps = [], meetings = [], nextId = 1, simT = 0;
const legRoot = new THREE.Group(); scene.add(legRoot);
const tmp = { a: new THREE.Vector3(), c: new THREE.Vector3(), x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3() };

function verts(J) {
  const V = {}, jit = () => [(Math.random() - 0.5) * J, (Math.random() - 0.5) * J, (Math.random() - 0.5) * J];
  return {
    V,
    set: (n, x, y, z) => { const j = jit(); V[n] = [x + j[0], y + j[1], z + j[2]]; },
    pair: (n, x, y, z) => { const j = jit(); V["L" + n] = [-x + j[0], y + j[1], z + j[2]]; V["R" + n] = [x - j[0], y + j[1], z + j[2]]; },
    T: (a, b, d) => [V[a], V[b], V[d]],
  };
}
function addPart(c, parent, geo, mat, edges = true) {
  const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; m.userData.creature = c;
  if (edges) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 6), c.lineMat));
  parent.add(m); return m;
}
function makeLegs(c, specs, lr) {
  const len = c.p.leg * 0.55;
  c.thighGeo = legGeo(lr, lr * 0.65, len); c.shinGeo = legGeo(lr * 0.65, 0, len);
  for (const s of specs) {
    const thigh = new THREE.Mesh(c.thighGeo, c.mat2), shin = new THREE.Mesh(c.shinGeo, c.mat2);
    for (const m of [thigh, shin]) { m.matrixAutoUpdate = false; m.castShadow = true; legRoot.add(m); }
    c.legs.push({ ...s, thigh, shin, down: true });
  }
}

function buildBody(c) {
  c.p = pheno(c.genome);
  // folded from map fragments: the body from one map, wings, legs and stripes from another
  c.color = new THREE.Color(0.96, 0.95, 0.93);
  c.mat = new THREE.MeshStandardMaterial({ color: c.color, map: mapOf(c.p.print), flatShading: true, side: THREE.DoubleSide, roughness: 0.88 });
  c.mat2 = new THREE.MeshStandardMaterial({ color: c.color, map: mapOf(c.p.tone), flatShading: true, side: THREE.DoubleSide, roughness: 0.88 });
  c.lineMat = new THREE.LineBasicMaterial({ color: 0x2a2826, transparent: true, opacity: 0.4 });
  c.body = new THREE.Group(); c.body.userData.creature = c; scene.add(c.body);
  c.legs = []; c.wingL = c.wingR = null; c.tassels = []; c.segs = null; c.segGroup = null; c.spin = null;
  UV_SCALE = 0.4 / c.p.bulk; // a body shows roughly half a map fragment, whatever its size
  ({ walker: buildWalker, floater: buildFloater, crawler: buildCrawler, hopper: buildHopper, roller: buildRoller })[c.p.form](c);
  UV_SCALE = 0.45;
}

// walker: a ridged envelope body, a neck and pointed head, a valley-fold tail, legs, sometimes wings
function buildWalker(c) {
  const p = c.p, B = p.bulk, L = 0.9 * B, W = 0.42 * B, H = 0.55 * B;
  const { set, pair, T } = verts(p.crumple * 0.22 * B);
  set("F", 0, 0.1 * H, L); set("T1", 0, H, 0.3 * L); set("T2", 0, 0.82 * H, -0.45 * L); set("B", 0, 0.2 * H, -L); set("D", 0, -0.45 * H, -0.05 * L);
  pair("F", W, 0, 0.3 * L); pair("B", 0.85 * W, 0.05 * H, -0.5 * L);
  const nl = p.neck * B, ny = 0.72 * H, nz = 0.6 * L, ty = ny + nl * 0.85, tz = nz + nl * 0.5, r = 0.11 * B, r2 = 0.06 * B;
  pair("n", r, ny, nz - r * 0.5); set("n3", 0, ny + 0.05 * H, nz + r);
  pair("m", r2, ty, tz - r2 * 0.5); set("m3", 0, ty + 0.02 * B, tz + r2);
  set("A", 0, ty - 0.1 * B, tz + 0.45 * B); set("C", 0, ty + 0.22 * B, tz - 0.12 * B);
  set("Tt", 0, 0.2 * H + 0.4 * B, -L - 0.35 * B); pair("t", 0.13 * B, 0.3 * H, -L + 0.18 * B);
  addPart(c, c.body, paperGeo([
    T("F", "T1", "LF"), T("F", "RF", "T1"), T("T1", "T2", "LB"), T("T1", "LB", "LF"), T("T1", "RF", "RB"), T("T1", "RB", "T2"), T("T2", "B", "LB"), T("T2", "RB", "B"),
    T("F", "LF", "D"), T("F", "D", "RF"), T("LF", "LB", "D"), T("RF", "D", "RB"), T("LB", "B", "D"), T("RB", "D", "B"),
    T("Ln", "Rn", "Rm"), T("Ln", "Rm", "Lm"), T("Rn", "n3", "m3"), T("Rn", "m3", "Rm"), T("n3", "Ln", "Lm"), T("n3", "Lm", "m3"),
    T("Lm", "m3", "A"), T("m3", "Rm", "A"), T("Rm", "Lm", "A"), T("Lm", "Rm", "C"),
    T("B", "Lt", "Tt"), T("B", "Tt", "Rt"),
  ], c.uvOff), c.mat);
  c.topY = Math.max(H, ty + 0.22 * B);
  if (p.wings > 0.4) {
    const span = (p.wings - 0.2) * 1.3 * B;
    for (const side of [-1, 1]) {
      const w = addPart(c, c.body, paperGeo([
        [[0, 0, 0.35 * L], [side * span * 0.5, 0.12 * B, 0.08 * L], [0, -0.03 * H, -0.32 * L]],
        [[side * span * 0.5, 0.12 * B, 0.08 * L], [side * span, 0.22 * B, -0.15 * L], [0, -0.03 * H, -0.32 * L]],
      ], c.uvOff), c.mat2);
      w.position.set(0, 0.86 * H, -0.1 * L);
      if (side < 0) c.wingL = w; else c.wingR = w;
    }
  }
  const zs = p.pairs === 2 ? [0.5 * L, -0.5 * L] : [0.55 * L, 0, -0.55 * L], specs = [];
  zs.forEach((z, k) => { for (const side of [-1, 1]) specs.push({ hip: new THREE.Vector3(side * 0.75 * W, -0.05 * H, z), side, phase: (k % 2 ? Math.PI : 0) + (side > 0 ? Math.PI : 0) + rnd(-0.3, 0.3) }); });
  makeLegs(c, specs, 0.06 * B + 0.025 * S);
  c.hipH = p.leg * 0.78;
}

// floater: a paper crane that drifts above the grid, wings beating slowly, paper tassels hanging under it
function buildFloater(c) {
  const p = c.p, B = p.bulk * 0.9, L = 0.75 * B, H = 0.3 * B, W = 0.22 * B;
  const { set, pair, T } = verts(p.crumple * 0.15 * B);
  set("F", 0, 0.05 * H, L * 0.55); set("K", 0, 0.1 * H, -L * 0.55); set("T", 0, H, 0); set("D", 0, -0.9 * H, 0); pair("S", W, 0, 0);
  const nTop = 0.35 * B + p.neck * 0.7 * B, nz = L * 0.55 + 0.45 * B;
  set("Nt", 0, nTop, nz); set("Hb", 0, nTop - 0.12 * B, nz + 0.3 * B); set("Tt", 0, 0.3 * B + p.neck * 0.4 * B, -L * 0.55 - 0.6 * B);
  pair("f", 0.05 * B, 0.05 * H, L * 0.5); pair("k", 0.05 * B, 0.1 * H, -L * 0.5); pair("h", 0.035 * B, nTop, nz);
  addPart(c, c.body, paperGeo([
    T("T", "F", "LS"), T("T", "RS", "F"), T("T", "LS", "K"), T("T", "K", "RS"), T("D", "LS", "F"), T("D", "F", "RS"), T("D", "K", "LS"), T("D", "RS", "K"),
    T("Lf", "Rf", "Nt"), T("Lh", "Rh", "Hb"), T("Lk", "Rk", "Tt"),
  ], c.uvOff), c.mat);
  const span = lerp(0.9, 2.4, p.wings) * B;
  for (const side of [-1, 1]) {
    const w = addPart(c, c.body, paperGeo([
      [[0, 0, 0.5 * L], [side * span * 0.45, 0.05 * B, 0.15 * L], [0, 0, -0.45 * L]],
      [[side * span * 0.45, 0.05 * B, 0.15 * L], [side * span, -0.05 * B, -0.35 * L], [0, 0, -0.45 * L]],
    ], c.uvOff), c.mat2);
    w.position.set(0, 0.6 * H, 0);
    if (side < 0) c.wingL = w; else c.wingR = w;
  }
  const n = 2 + Math.round(p.count * 5);
  for (let i = 0; i < n; i++) {
    const len = rnd(0.5, 1.3) * B;
    const t = addPart(c, c.body, paperGeo([
      [[-0.05 * B, 0, 0], [0.05 * B, 0, 0], [0, -len, 0.03]],
      [[0.05 * B, 0, 0], [0, -len, 0.03], [0.02 * B, -len * 0.6, -0.04]],
    ], c.uvOff), i % 2 ? c.mat : c.mat2, false);
    t.position.set(rnd(-W, W) * 0.8, -0.6 * H, rnd(-L * 0.4, L * 0.4));
    c.tassels.push(t);
  }
  c.topY = nTop + 0.2 * B;
}

// crawler: a chain of folded tents that slithers, striped in its two maps, with feelers on the head
function tentGeo(B, J, head, neck, off) {
  const w = 0.3 * B, l = 0.2 * B, h = 0.34 * B, { set, pair, T, V } = verts(J);
  pair("F", w, 0, l); pair("K", w, 0, -l); set("Tf", 0, h, l * 0.7); set("Tb", 0, h * 0.9, -l * 0.7);
  const tris = [T("LF", "Tf", "Tb"), T("LF", "Tb", "LK"), T("RF", "Tb", "Tf"), T("RF", "RK", "Tb"), T("LF", "RF", "Tf"), T("RK", "LK", "Tb")];
  if (head) {
    set("Sn", 0, 0.12 * B, l + 0.3 * B); tris.push(T("LF", "RF", "Sn"), T("LF", "Sn", "Tf"), T("RF", "Tf", "Sn"));
    for (const s of [-1, 1]) {
      const a = [V.Tf[0] + s * 0.03, V.Tf[1], V.Tf[2]], b = [V.Tf[0] + s * 0.07, V.Tf[1], V.Tf[2] - 0.02];
      tris.push([a, b, [s * 0.22 * B, h + (0.2 + 0.4 * neck) * B, l + 0.35 * B]]);
    }
  }
  return paperGeo(tris, off);
}
function buildCrawler(c) {
  const p = c.p, B = p.bulk, n = 4 + Math.round(p.count * 6), J = p.crumple * 0.12 * B;
  addPart(c, c.body, tentGeo(B, J, true, p.neckG, c.uvOff), c.mat);
  c.segGroup = new THREE.Group(); c.segGroup.userData.creature = c; scene.add(c.segGroup);
  c.segs = [];
  const segGeo = tentGeo(B, J, false, 0, c.uvOff);
  for (let i = 1; i <= n; i++) {
    const m = addPart(c, c.segGroup, segGeo, i % 2 ? c.mat2 : c.mat);
    m.userData.taper = 1 - (i / n) * 0.45; c.segs.push(m);
  }
  c.segSpacing = 0.42 * B;
  c.topY = 0.34 * B + (0.3 + 0.4 * p.neckG) * B;
  if (c.trail.length < 2) for (let i = 0; i < 80; i++) c.trail.push({ x: c.x - Math.sin(c.yaw) * i * 0.06, z: c.z - Math.cos(c.yaw) * i * 0.06 });
}

// hopper: a squat folded frog with big back legs; it crouches, then jumps
function buildHopper(c) {
  const p = c.p, B = p.bulk, L = 0.6 * B, W = 0.5 * B, H = 0.34 * B;
  const { set, pair, T } = verts(p.crumple * 0.18 * B);
  set("F", 0, 0.15 * H, L); set("T", 0, H, 0.05 * L); set("K", 0, 0.35 * H, -L); set("D", 0, -0.35 * H, 0);
  pair("F", 0.8 * W, 0, 0.35 * L); pair("B", W, 0.05 * H, -0.45 * L);
  pair("e", 0.2 * B, 0.75 * H, 0.6 * L); pair("E", 0.22 * B, 0.75 * H + 0.22 * B, 0.5 * L); pair("x", 0.32 * B, 0.7 * H, 0.35 * L);
  addPart(c, c.body, paperGeo([
    T("F", "T", "LF"), T("F", "RF", "T"), T("T", "LB", "LF"), T("T", "RF", "RB"), T("T", "K", "LB"), T("T", "RB", "K"),
    T("F", "LF", "D"), T("F", "D", "RF"), T("LF", "LB", "D"), T("RF", "D", "RB"), T("LB", "K", "D"), T("RB", "D", "K"),
    T("Le", "LE", "Lx"), T("Re", "Rx", "RE"),
  ], c.uvOff), c.mat);
  const specs = [];
  for (const side of [-1, 1]) {
    specs.push({ hip: new THREE.Vector3(side * 0.85 * W, 0, -0.45 * L), side, back: true });
    specs.push({ hip: new THREE.Vector3(side * 0.6 * W, -0.1 * H, 0.45 * L), side, back: false });
  }
  makeLegs(c, specs, 0.07 * B + 0.02 * S);
  c.topY = H + 0.35 * B;
}

// roller: a folded paper star that tumbles across the grid
function buildRoller(c) {
  const p = c.p, B = p.bulk, R = 0.42 * B, spike = lerp(1.25, 2, p.neckG);
  const base = p.count < 0.45 ? new THREE.OctahedronGeometry(R, 0) : new THREE.IcosahedronGeometry(R, 0);
  const a = base.attributes.position, tris = [];
  for (let i = 0; i < a.count; i += 3) {
    const v = [0, 1, 2].map(k => [a.getX(i + k), a.getY(i + k), a.getZ(i + k)]);
    const cen = [0, 1, 2].map(k => (v[0][k] + v[1][k] + v[2][k]) / 3), len = Math.hypot(...cen);
    const s = R * spike * (1 + (Math.random() - 0.5) * p.crumple * 0.5) / len, apex = cen.map(x => x * s);
    tris.push([v[0], v[1], apex], [v[1], v[2], apex], [v[2], v[0], apex]);
  }
  base.dispose();
  c.spin = new THREE.Group(); c.body.add(c.spin);
  addPart(c, c.spin, paperGeo(tris, c.uvOff), c.mat);
  c.rollR = R * (1 + spike) * 0.48;
  c.topY = R * spike * 1.6;
}

function destroyBody(c) {
  scene.remove(c.body);
  c.body.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  if (c.segGroup) { scene.remove(c.segGroup); c.segGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); }); c.segGroup = null; }
  for (const L of c.legs) legRoot.remove(L.thigh, L.shin);
  if (c.thighGeo) { c.thighGeo.dispose(); c.shinGeo.dispose(); c.thighGeo = c.shinGeo = null; }
  c.mat.dispose(); c.mat2.dispose(); c.lineMat.dispose();
}
// ---------- posing ----------
function pose(c, paused, dt) {
  const p = c.p, k = Math.max(0.02, Math.min(1, c.k)) * c.grow;
  const f = { sx: k, sy: k, legK: k, tilt: 0, drop: 0, k };
  if (c.dying) {
    const s = ease(Math.min(1, c.dying.t / 1.2));
    f.sx = f.sy = f.legK = Math.max(0.05, 1 - 0.92 * s); f.tilt = c.dying.tilt * s; f.drop = s;
  }
  f.fx = Math.sin(c.yaw); f.fz = Math.cos(c.yaw);
  f.sh = c.shake ? (Math.random() - 0.5) * c.shake : 0;
  ({ walker: poseWalker, floater: poseFloater, crawler: poseCrawler, hopper: poseHopper, roller: poseRoller })[p.form](c, paused, dt, f);
  if (c.elderT > 0 && p.form !== "roller") c.body.rotation.x += 0.18 * c.elderT;
  if (c.pop > 0) { c.pop = Math.max(0, c.pop - dt * 2.5); c.body.scale.multiplyScalar(1 + 0.12 * Math.sin(Math.PI * c.pop)); }
}
function place(mesh, a, b, fwd) {
  const y = tmp.y.subVectors(b, a); const len = y.length() || 1e-3; y.divideScalar(len);
  const x = tmp.x.copy(fwd).addScaledVector(y, -fwd.dot(y)).normalize();
  const z = tmp.z.crossVectors(x, y);
  mesh.matrix.makeBasis(x, y.multiplyScalar(len), z).setPosition(a);
  mesh.matrixWorldNeedsUpdate = true;
}
function poseWalker(c, paused, dt, f) {
  const p = c.p, wt = c.walkT, B = p.bulk;
  const bob = paused ? Math.sin(simT * 1.6 + c.id) * 0.015 * p.leg : Math.abs(Math.sin(wt * p.gait)) * 0.06 * p.leg;
  c.body.position.set(c.x + f.fx * c.lunge + f.sh, (c.hipH + bob) * f.legK + (1 - f.legK) * 0.12 * B, c.z + f.fz * c.lunge + f.sh);
  c.body.scale.set(f.sx, f.sy, f.sx);
  c.body.rotation.set(paused ? 0 : Math.sin(wt * p.gait * 0.5) * 0.04, c.yaw, f.tilt + (paused ? 0 : Math.sin(wt * p.gait) * 0.04));
  if (c.wingL) {
    const a = c.dying ? 0 : paused ? 0.2 + Math.sin(simT * 2 + c.id) * 0.05 : 0.35 + 0.45 * Math.sin(wt * p.gait * 1.6);
    c.wingL.rotation.z = -a; c.wingR.rotation.z = a;
  }
  c.body.updateMatrixWorld();
  const fwd = tmp.c.set(f.fx, 0, f.fz), sideBase = new THREE.Vector3(f.fz, 0, -f.fx);
  for (const L of c.legs) {
    const hip = tmp.a.copy(L.hip).applyMatrix4(c.body.matrixWorld);
    const side = sideBase.clone().multiplyScalar(L.side);
    const ph = wt * p.gait + L.phase, swing = paused ? 0 : Math.sin(ph);
    const foot = new THREE.Vector3(c.x, 0, c.z).addScaledVector(side, (0.32 * B + p.leg * 0.5) * f.legK)
      .addScaledVector(fwd, L.hip.z + swing * p.leg * 0.3 * f.legK);
    foot.y = paused ? 0 : Math.max(0, Math.cos(ph)) * p.leg * 0.2;
    const knee = hip.clone().lerp(foot, 0.42).addScaledVector(side, p.leg * 0.22 * f.legK); knee.y += p.leg * 0.28 * f.legK;
    place(L.thigh, hip, knee, fwd); place(L.shin, knee, foot, fwd);
    const down = foot.y < 0.01;
    if (down && !L.down && !paused) stamp(foot.x, foot.z);
    L.down = down;
  }
}
function poseFloater(c, paused, dt, f) {
  const p = c.p, B = p.bulk;
  let target = (c.meeting || c.forming) ? 0.7 + 0.3 * B : lerp(1.6, 3.4, p.stride);
  if (c.circling && !c.meeting && !c.forming) target = Math.max(target, Math.min(7, c.circleH * 0.85)); // up near the top of the building it circles
  c.alt = c.alt == null ? target : lerp(c.alt, target, Math.min(1, dt * 1.5));
  let y = lerp(0.2, c.alt + Math.sin(simT * 1.3 + c.id) * 0.22, c.dying ? 1 : f.k);
  y = lerp(y, 0.1, f.drop);
  c.bank = lerp(c.bank, Math.max(-0.6, Math.min(0.6, -c.turnV * 0.5)), Math.min(1, dt * 3));
  c.body.position.set(c.x + f.fx * c.lunge + f.sh, y, c.z + f.fz * c.lunge + f.sh);
  c.body.scale.set(f.sx, f.sy, f.sx);
  c.body.rotation.set(Math.sin(simT * 0.9 + c.id) * 0.06, c.yaw, c.bank + f.tilt);
  const a = c.dying ? -0.2 : paused ? 0.15 + Math.sin(simT * 1.5 + c.id) * 0.1 : 0.2 + 0.55 * Math.sin(c.walkT * p.gait * 0.45);
  c.wingL.rotation.z = -a; c.wingR.rotation.z = a;
  c.tassels.forEach((t, i) => { t.rotation.x = Math.sin(simT * 2.1 + i) * 0.25 + (paused ? 0 : 0.3); t.rotation.z = Math.sin(simT * 1.7 + i * 1.3) * 0.2; });
}
function poseCrawler(c, paused, dt, f) {
  const p = c.p, B = p.bulk, wt = c.walkT;
  c.body.position.set(c.x + f.fx * c.lunge + f.sh, 0, c.z + f.fz * c.lunge + f.sh);
  c.body.scale.set(f.sx, f.sy, f.sx);
  c.body.rotation.set(0, c.moveDir, f.tilt);
  let idx = 0, acc = 0, prev = { x: c.x, z: c.z };
  c.segs.forEach((s, i) => {
    const want = (i + 1) * c.segSpacing;
    while (idx < c.trail.length - 1 && acc < want) { acc += Math.hypot(c.trail[idx + 1].x - c.trail[idx].x, c.trail[idx + 1].z - c.trail[idx].z); idx++; }
    const q = c.trail[idx] || prev;
    const hump = paused ? 0 : Math.max(0, Math.sin(wt * p.gait - (i + 1) * 0.8)) * 0.12 * B;
    s.position.set(q.x, hump * f.sy, q.z);
    s.rotation.set(0, Math.atan2(prev.x - q.x, prev.z - q.z) || c.moveDir, f.tilt);
    const t = s.userData.taper; s.scale.set(f.sx * t, f.sy * t, f.sx * t);
    prev = q;
  });
}
function poseHopper(c, paused, dt, f) {
  const p = c.p, B = p.bulk, h = c.hop, air = h.air, fr = air ? Math.min(1, h.t / h.dur) : 0;
  const hopY = air ? Math.sin(Math.PI * fr) * lerp(0.5, 1.5, p.stride) * B : 0;
  const squash = !air && !paused ? Math.max(0, 1 - h.t / 0.2) * 0.25 : 0;
  c.body.position.set(c.x + f.fx * c.lunge + f.sh, (0.32 * B + hopY) * f.legK + 0.05 * S, c.z + f.fz * c.lunge + f.sh);
  c.body.scale.set(f.sx * (1 + squash * 0.4), f.sy * (1 - squash), f.sx * (1 + squash * 0.4));
  c.body.rotation.set(air ? -Math.cos(Math.PI * fr) * 0.35 : 0.08, c.yaw, f.tilt);
  c.body.updateMatrixWorld();
  const fwd = tmp.c.set(f.fx, 0, f.fz), sideBase = new THREE.Vector3(f.fz, 0, -f.fx), K = f.legK;
  for (const L of c.legs) {
    const hip = tmp.a.copy(L.hip).applyMatrix4(c.body.matrixWorld);
    const side = sideBase.clone().multiplyScalar(L.side);
    let foot, knee;
    if (L.back) {
      if (air) {
        foot = hip.clone().addScaledVector(fwd, -0.95 * B * K).addScaledVector(side, 0.15 * B * K); foot.y -= 0.25 * B * K;
        knee = hip.clone().lerp(foot, 0.5); knee.y += 0.1 * B * K;
      } else {
        foot = new THREE.Vector3(c.x, 0, c.z).addScaledVector(side, 0.6 * B * K).addScaledVector(fwd, -0.15 * B * K);
        knee = hip.clone().lerp(foot, 0.5).addScaledVector(side, 0.2 * B * K).addScaledVector(fwd, -0.35 * B * K); knee.y += 0.35 * B * K;
      }
    } else {
      if (air) { foot = hip.clone().addScaledVector(fwd, 0.35 * B * K); foot.y -= 0.2 * B * K; }
      else foot = new THREE.Vector3(c.x, 0, c.z).addScaledVector(side, 0.4 * B * K).addScaledVector(fwd, 0.45 * B * K);
      knee = hip.clone().lerp(foot, 0.5).addScaledVector(side, 0.08 * B * K); knee.y += 0.06 * B * K;
    }
    place(L.thigh, hip, knee, fwd); place(L.shin, knee, foot, fwd);
  }
}
function poseRoller(c, paused, dt, f) {
  const wob = paused ? 0 : Math.abs(Math.sin(c.rollA * 2.5)) * 0.06;
  c.body.position.set(c.x + f.fx * c.lunge + f.sh, (c.rollR + wob) * f.sy, c.z + f.fz * c.lunge + f.sh);
  c.body.scale.set(f.sx, f.sy, f.sx);
  c.body.rotation.set(0, c.yaw, f.tilt);
  c.spin.rotation.x = c.rollA;
}
const angleTo = (want, cur) => Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
const stamp = () => {}; // no footprints here
// ---------- cells ----------
// p (pressure) runs 0 → 1 while it squishes, 1 → 2 while it pinches and the nucleus divides; let go past ~1.75 and it splits
// the wall's edge darkens where it turns away from you, like a pencil outline round a bubble
const RIM_MAT = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { ink: { value: new THREE.Color(0x2f2d2a) } },
  vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normal; vV = vec3(0.0, 0.0, 1.0); gl_Position = projectionMatrix * mv; }",
  fragmentShader: "uniform vec3 ink; varying vec3 vN; varying vec3 vV; void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); float a = smoothstep(0.5, 0.97, f) * 0.85 + smoothstep(0.0, 0.5, f) * 0.06; gl_FragColor = vec4(ink, a); }",
});
const SPH = new THREE.SphereGeometry(1, 72, 48), BASE = SPH.attributes.position.array.slice();
const NUC = new THREE.IcosahedronGeometry(1, 3), NUCLEOLUS = new THREE.IcosahedronGeometry(1, 2);
const blobTex = (() => { const cv = document.createElement("canvas"); cv.width = cv.height = 128; const g = cv.getContext("2d"); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, "rgba(40,38,34,0.38)"); gr.addColorStop(1, "rgba(40,38,34,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(cv); })();
const cells = [];
let nextSeed = 1, splits = 0;
const S_OF = p => smooth(Math.min(1, p)), Q_OF = p => smooth(p - 1);

function makeCell(x, z, R, tile, sx = 1, sy = 1) {
  const o = { x, z, vx: 0, vz: 0, R, tile, p: 0, held: null, sx, sy, svx: 0, svy: 0, wait: 0, crossed: false, snd: null, seed: (nextSeed++) * 2.31, drift: rnd(0, 6), age: 0, roll: rnd(-1.1, 1.1) }; // roll: the screen direction it will divide along
  o.group = new THREE.Group(); scene.add(o.group);
  o.geo = new THREE.BufferGeometry();
  o.geo.setAttribute("position", new THREE.BufferAttribute(BASE.slice(), 3));
  o.geo.setAttribute("normal", new THREE.BufferAttribute(SPH.attributes.normal.array.slice(), 3));
  o.geo.setIndex(SPH.index);
  // the membrane: a clear, glossy wall with a dark rim drawn behind it like an outline
  o.wall = new THREE.Mesh(o.geo, new THREE.MeshPhysicalMaterial({ color: 0xf4f7f1, transparent: true, opacity: 0.22, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false, envMap: ENV, envMapIntensity: 1.2 }));
  o.wall.renderOrder = 2; o.wall.userData.cell = o;
  o.group.visible = false; o.figs = [walkSprite(o), walkSprite(o)]; o.frame = 4; o.dir = Math.random() < 0.5 ? 1 : -1; o.walkT = rnd(0.5, 3); o.wand = rnd(0, 6.28); o.roll = rnd(-1.1, 1.1);
  o.rim = new THREE.Mesh(o.geo, RIM_MAT); o.rim.renderOrder = 3;
  o.group.add(o.wall, o.rim);
  // two nuclei that sit on top of each other until the cell divides; each is wrapped in a map fragment,
  // the fragment the new creature will be folded from
  o.nuc = [0, 1].map(() => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(NUC, new THREE.MeshStandardMaterial({ map: MAPS[tile % MAPS.length], color: 0xf3efe6, roughness: 0.55, flatShading: true }));
    m.castShadow = true;
    const nl = new THREE.Mesh(NUCLEOLUS, new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.4 }));
    nl.scale.setScalar(0.3); nl.position.set(-0.32, 0.42, 0.62);
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(NUC, 20), new THREE.LineBasicMaterial({ color: 0x2a2826, transparent: true, opacity: 0.18 })));
    g.add(m, nl); o.group.add(g); return g;
  });
  // specks floating in the cytoplasm
  const n = 40, gp = new Float32Array(n * 3); o.gBase = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { let v; do { v = [rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)]; } while (Math.hypot(...v) > 0.85 || Math.hypot(...v) < 0.5); o.gBase.set(v, i * 3); }
  o.gGeo = new THREE.BufferGeometry(); o.gGeo.setAttribute("position", new THREE.BufferAttribute(gp, 3));
  o.specks = new THREE.Points(o.gGeo, new THREE.PointsMaterial({ color: 0x4a463f, size: 0.07, transparent: true, opacity: 0.55, depthWrite: false }));
  o.group.add(o.specks);
  o.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  o.shadow.rotation.x = -Math.PI / 2; o.shadow.position.y = 0.01; scene.add(o.shadow);
  o.dirty = true;
  cells.push(o); return o;
}
// ---------- the look of a cell: a walking figure, from a sheet of 23 drawn frames (5 to a row) ----------
// The sphere underneath still does the squeezing sums; what you see is the figure, squashed and pulled apart with it.
const WALK_TEX = new THREE.TextureLoader().load("walk.png"); WALK_TEX.encoding = THREE.sRGBEncoding; WALK_TEX.anisotropy = 4;
const WALK_MAT = new THREE.MeshBasicMaterial({ map: WALK_TEX, alphaTest: 0.5, side: THREE.DoubleSide });
const WALK_DEPTH = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: WALK_TEX, alphaTest: 0.5, side: THREE.DoubleSide });
const WALK_N = 23, FIG_H = 4.2, FIG_S = FIG_H * 256 / 215; // figure height and frame size, in cell radii
function walkSprite(o) {
  const g = new THREE.PlaneGeometry(1, 1); g.translate(0.012, 0.5 - 20 / 256, 0); // feet on the ground line
  const m = new THREE.Mesh(g, WALK_MAT); m.customDepthMaterial = WALK_DEPTH; m.castShadow = SHADOWS; m.matrixAutoUpdate = false; m.frustumCulled = false;
  m.userData.cell = o; m.userData.frame = -1; scene.add(m); return m;
}
function setFrame(m, f) {
  if (m.userData.frame === f) return; m.userData.frame = f;
  const c = f % 5, r = Math.floor(f / 5), u0 = c / 5, u1 = (c + 1) / 5, v1 = 1 - r / 5, v0 = 1 - (r + 1) / 5, uv = m.geometry.attributes.uv;
  uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0); uv.needsUpdate = true;
}
// close up, the first person (and the twins he splits into) is drawn from one large painting of him mid-stride
const HI_TEX = new THREE.TextureLoader().load("person.png"); HI_TEX.encoding = THREE.sRGBEncoding; HI_TEX.anisotropy = 8;
const HI_MAT = new THREE.MeshBasicMaterial({ map: HI_TEX, alphaTest: 0.5, side: THREE.DoubleSide });
const HI_DEPTH = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: HI_TEX, alphaTest: 0.5, side: THREE.DoubleSide });
const HI_PAD = 128, HI_CW = 707, HI_CH = 1800, HI_H = 215 / 256; // the painting has a wide clear margin, so nothing smears off its edges when it is drawn small
function setHi(m, on) {
  if (on) {
    if (m.userData.frame === "hi") return; m.userData.frame = "hi"; m.material = HI_MAT; m.customDepthMaterial = HI_DEPTH;
    const TW = HI_CW + 2 * HI_PAD, TH = HI_CH + 2 * HI_PAD, wS = HI_H * TW / HI_CH; // the whole image's width, in frame units
    const vy = y => HI_PAD / TH + (y / HI_H) * (HI_CH / TH);
    const u0 = 0.5 - 0.5 / wS, u1 = 0.5 + 0.5 / wS, v0 = vy(-20 / 256), v1 = vy(1 - 20 / 256), uv = m.geometry.attributes.uv;
    uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0); uv.needsUpdate = true;
  } else if (m.userData.frame === "hi") { m.material = WALK_MAT; m.customDepthMaterial = WALK_DEPTH; m.userData.frame = -1; }
}
const STAND = f => { const k = Math.floor(f) % WALK_N; return k === 4 || k === 16; }; // frames with the feet together
function updateFigure(o, sh, t) {
  if (o.orb) return updateOrb(o, sh, t);
  const dt = Math.min(0.1, Math.max(0, t - (o.figT ?? t))); o.figT = t;
  const R = o.R, spd = Math.hypot(o.vx, o.vz);
  if (Math.abs(o.vx) > 0.12 * R) o.dir = o.vx > 0 ? 1 : -1;
  if (spd > 0.12 * R && o.held == null) o.frame += dt * WALK_N * spd / (0.75 * FIG_H * R);
  else if (!STAND(o.frame)) o.frame += dt * 16; // come to rest with the feet together
  const f = Math.floor(o.frame) % WALK_N, S = FIG_S * R;
  // people are never squashed. Pressed, a mirror twin steps out from behind and the two pull apart back to back,
  // heads side by side, until they walk off in opposite directions.
  const pull = 0.5 * sh.s + 0.5 * sh.q, off = 0.5 * R * pull, twin = o.p > 0.02;
  // the large painting has one pose: walking, it steps along with a small rise and fall
  const bob = o.hi && spd > 0.12 * R ? Math.abs(Math.sin(o.frame / WALK_N * Math.PI * 2)) * 0.025 * S : 0;
  o.figs.forEach((m, i) => {
    m.visible = i === 0 || twin; setHi(m, !!o.hi); if (!o.hi) setFrame(m, twin ? 0 : f); // splitting, both stand in full stride
    const side = i ? 1 : -1, face = twin ? side : o.dir;
    lift.makeTranslation(o.x + (twin ? side * off : 0), bob, o.z + (i ? 0.02 : 0)).multiply(UPRIGHT);
    m.matrix.copy(lift).scale(lift3.set(face * S, S, 1)); m.matrixWorldNeedsUpdate = true;
  });
}
// the first cell is only the circle: the inlaid flower roundel, squeezed like the cells were. People pop out of it.
const ORB_TEX = new THREE.TextureLoader().load("orb.png"); ORB_TEX.encoding = THREE.sRGBEncoding; ORB_TEX.anisotropy = 4;
const ORB_MAT = new THREE.MeshBasicMaterial({ map: ORB_TEX, alphaTest: 0.5, side: THREE.DoubleSide });
const ORB_DEPTH = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: ORB_TEX, alphaTest: 0.5, side: THREE.DoubleSide });
function makeOrb(o) {
  o.orb = true; o.roll = 0;
  const g = new THREE.CircleGeometry(1, 72); o.discBase = g.attributes.position.array.slice();
  o.disc = new THREE.Mesh(g, ORB_MAT); o.disc.customDepthMaterial = ORB_DEPTH; o.disc.castShadow = SHADOWS; o.disc.matrixAutoUpdate = false; o.disc.frustumCulled = false;
  o.disc.userData.cell = o; scene.add(o.disc);
  for (const m of o.figs) m.visible = false;
}
function updateOrb(o, sh, t) {
  const pos = o.disc.geometry.attributes.position.array, b = o.discBase;
  for (let i = 0; i < pos.length; i += 3) deform(sh, b[i], b[i + 1], 0, pos, i);
  o.disc.geometry.attributes.position.needsUpdate = true;
  o.disc.visible = !micro.hideOrb; // hidden while the opening is under the microscope
  ORB_TEX.center.set(0.5, 0.5); ORB_TEX.rotation = t * CFG.circle.spin; // the pattern turns slowly inside the circle; the squeeze itself stays level
  const R = o.R * (1 + Math.sin(t * 1.6 + o.drift) * 0.012);
  o.disc.matrix.copy(lift.makeTranslation(o.x, o.R * (0.25 + sh.ys), o.z).multiply(UPRIGHT)).scale(lift3.set(R, R, 1)); o.disc.matrixWorldNeedsUpdate = true;
}
function disposeCell(o) {
  if (o.disc) { scene.remove(o.disc); o.disc.geometry.dispose(); }
  for (const m of o.figs) { scene.remove(m); m.geometry.dispose(); }
  squeezeStop(o);
  scene.remove(o.group, o.shadow);
  o.geo.dispose(); o.gGeo.dispose(); o.wall.material.dispose(); o.specks.material.dispose(); o.shadow.geometry.dispose(); o.shadow.material.dispose();
  for (const g of o.nuc) g.traverse(m => { if (m.material) m.material.dispose(); if (m.isLineSegments) m.geometry.dispose(); });
  const i = cells.indexOf(o); if (i >= 0) cells.splice(i, 1);
}
// the shape: squish flattens it toward you and widens it; pinch narrows a waist until it is two lobes
function shapeOf(o) {
  const s = S_OF(o.p), q = Q_OF(o.p);
  return { s, q, xs: (1 + 0.28 * s + 0.62 * q) * o.sx, ys: (1 - 0.16 * s - 0.1 * q) * o.sy, zs: (1 - 0.22 * s - 0.08 * q) * o.sy, pinch: 0.1 * s + 0.5 * q, dent: 0.25 * s * (1 - q) };
}
function deform(sh, x, y, z, out, k) {
  const w = 1 - sh.pinch * Math.exp(-(x * x) / 0.16);
  out[k] = x * sh.xs; out[k + 1] = y * sh.ys * w; let Z = z * sh.zs * w;
  if (z > 0) Z -= sh.dent * Math.exp(-(x * x + y * y) / 0.12) * z; // the finger's dent
  out[k + 2] = Z;
}
const lift = new THREE.Matrix4(), lift3 = new THREE.Vector3();
const rollQ = new THREE.Quaternion(), Z_AXIS = new THREE.Vector3(0, 0, 1);
function updateCellMesh(o, t) {
  const sh = shapeOf(o), R = o.R;
  const active = o.p > 0.001 || Math.abs(o.sx - 1) > 0.002 || Math.abs(o.sy - 1) > 0.002 || o.dirty;
  if (active) {
    const pos = o.geo.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) deform(sh, BASE[i], BASE[i + 1], BASE[i + 2], pos, i);
    o.geo.attributes.position.needsUpdate = true; o.geo.computeVertexNormals(); o.geo.computeBoundingSphere();
    o.dirty = false;
  }
  // specks drift slowly
  const gp = o.gGeo.attributes.position.array;
  for (let i = 0; i < gp.length; i += 3) {
    const a = t * 0.4 + i, b = o.gBase;
    deform(sh, b[i] + Math.sin(a) * 0.05, b[i + 1] + Math.cos(a * 1.3) * 0.05, b[i + 2] + Math.sin(a * 0.7) * 0.05, gp, i);
  }
  o.gGeo.attributes.position.needsUpdate = true;
  // nuclei: one in the middle, squashed by the squeeze; they part into the two lobes as it pinches
  const nr = 0.42 * (1 - 0.18 * sh.q), lobe = 0.6 * sh.xs * sh.q;
  o.nuc.forEach((g, i) => {
    const side = i ? 1 : -1, bob = Math.sin(t * 1.1 + o.drift + i) * 0.03;
    g.position.set(side * lobe, bob, 0.05);
    g.scale.set(nr * (1 + 0.35 * sh.s * (1 - sh.q)), nr * (1 - 0.3 * sh.s * (1 - sh.q)), nr * (1 - 0.2 * sh.s));
    g.rotation.set(t * 0.12 + i, t * 0.2 + o.drift, 0);
    g.visible = i === 0 || sh.q > 0.01;
  });
  o.group.scale.setScalar(R);
  // the wall breathes a little
  const br = 1 + Math.sin(t * 1.6 + o.drift) * 0.012;
  o.group.scale.multiplyScalar(br);
  o.group.quaternion.setFromAxisAngle(Z_AXIS, o.roll);
  o.group.position.set(o.x, R * sh.ys * 0.98, o.z);
  // leaned back, so the oblique view shows the cell round and face-on
  o.group.matrix.multiplyMatrices(lift.makeTranslation(o.x, R * sh.ys * 0.98, o.z), UPRIGHT).multiply(lift.makeRotationZ(o.roll)).scale(o.group.scale);
  o.group.matrixAutoUpdate = false; o.group.matrixWorldNeedsUpdate = true;
  o.shadow.visible = SHADOWS; o.shadow.position.set(o.x, 0.012, o.z); o.shadow.scale.set(R * 1.9 * sh.xs, R * 0.9, 1);
  updateFigure(o, sh, t);
}
// ---------- dividing ----------
const bursts = [];
// ---------- words in the world: a line written on the paper behind a person ----------
// The line lies on the page just behind the figure, so the figure stands in front of it, and it goes where they go.
// It arrives with the same dissolve as the other text. PLACEHOLDER lines for now.
const CAP_FONT = 'italic 500 92px "Cormorant Garamond", Garamond, Georgia, serif', CAP_W = 1024, CAP_H = 160, CAP_MAX = 1; // one line at a time, on some splits only: it comes in, stays, fades out
if (document.fonts && document.fonts.load) document.fonts.load(CAP_FONT).catch(() => {});
const captions = [];
function caption(o, text) {
  if (captions.length >= CAP_MAX || captions.some(c => c.cell === o)) return;
  const cv = document.createElement("canvas"); cv.width = CAP_W; cv.height = CAP_H;
  const g = cv.getContext("2d"); g.font = CAP_FONT;
  const total = g.measureText(text).width, k = Math.min(1, (CAP_W - 40) / total), D = DISSOLVE, spread = Math.max(0, D.duration - D.letterFade), letters = [];
  let x = (CAP_W - total * k) / 2;
  for (const ch of text) {
    const w = g.measureText(ch).width * k, when = Math.random() * spread;
    if (ch !== " ") letters.push({ ch, x, w, start: [0, 1, 2, 3].map(() => when + Math.random() * D.edgeRaggedness * D.letterFade * 0.8) });
    x += w;
  }
  const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, CAP_H / CAP_W), mat); mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 2; scene.add(mesh);
  captions.push({ cell: o, cv, g, tex, mat, mesh, letters, k, t: -D.delay, x: o.x, z: o.z, R: o.R, done: false, out: null });
}
function drawCaption(c) {
  const g = c.g, D = DISSOLVE, now = c.t, px = 92 * c.k;
  g.clearRect(0, 0, CAP_W, CAP_H); g.textBaseline = "alphabetic"; g.textAlign = "left";
  for (const L of c.letters) {
    const a = reduced ? [1, 1, 1, 1] : L.start.map(s => smooth((now - s) / D.letterFade)), avg = (L.start[0] + L.start[1] + L.start[2] + L.start[3]) / 4;
    const letter = reduced ? 1 : smooth((now - avg) / D.letterFade), lo = Math.min(...a), hi = Math.max(...a); if (hi <= 0) continue;
    const scale = D.startScale + (1 - D.startScale) * letter, drop = D.riseFrom * px * (1 - letter);
    // the four corner strengths (bottom-left, top-left, top-right, bottom-right), as a gradient across the letter
    const gx = (a[2] + a[3] - a[0] - a[1]) / 2, gy = (a[0] + a[3] - a[1] - a[2]) / 2, gl = Math.hypot(gx, gy) || 1;
    const cx = L.x + L.w / 2, cy = CAP_H * 0.55, r = px * 0.6;
    const gr = g.createLinearGradient(cx - gx / gl * r, cy - gy / gl * r, cx + gx / gl * r, cy + gy / gl * r);
    const tc = new THREE.Color(CFG.text.colour), rgb = `${Math.round(tc.r * 255)},${Math.round(tc.g * 255)},${Math.round(tc.b * 255)}`;
    gr.addColorStop(0, `rgba(${rgb},${lo.toFixed(3)})`); gr.addColorStop(1, `rgba(${rgb},${hi.toFixed(3)})`);
    g.save(); g.translate(cx, CAP_H * 0.68 + drop); g.scale(scale, scale); g.font = `italic 500 ${px.toFixed(1)}px "Cormorant Garamond", Garamond, Georgia, serif`;
    g.translate(-cx, -(CAP_H * 0.68 + drop)); g.fillStyle = gr; g.fillText(L.ch, L.x, CAP_H * 0.68 + drop); g.restore();
  }
  c.tex.needsUpdate = true;
}
function updateCaptions(dt) {
  for (let i = captions.length - 1; i >= 0; i--) {
    const c = captions[i], o = c.cell, D = DISSOLVE; c.t += dt;
    if (cells.includes(o) && !o.fusing) { c.x += (o.x - c.x) * Math.min(1, dt * 6); c.z += (o.z - c.z) * Math.min(1, dt * 6); c.R = o.R; }
    // if their person goes, the line stays where it was and still lives out its time
    if (!c.done) { drawCaption(c); if (reduced || c.t > D.duration + D.letterFade + 0.1) c.done = true; }
    if (c.out == null && c.t > DISSOLVE.duration + DISSOLVE.letterFade + CFG.text.staySeconds) c.out = 0;
    if (c.out != null) c.out += dt / Math.max(0.05, CFG.text.fadeSeconds);
    const wide = CFG.text.width * c.R;
    c.mesh.scale.set(wide, wide, 1); c.mesh.position.set(c.x, 0.014, c.z - 2.3 * c.R); // behind them: further up the page, at chest height on screen
    c.mat.opacity = c.out == null ? 1 : Math.max(0, 1 - c.out);
    if (c.out != null && c.out >= 1) { scene.remove(c.mesh); c.mesh.geometry.dispose(); c.mat.dispose(); c.tex.dispose(); captions.splice(i, 1); }
  }
}
function clearCaptions() { for (const c of captions) { scene.remove(c.mesh); c.mesh.geometry.dispose(); c.mat.dispose(); c.tex.dispose(); } captions.length = 0; }
// ---------- speech: white boxes with a small tail, beside whoever is talking ----------
// Anyone can talk: a person, the circle's children, a creature. A box sits up and to the side of the speaker's head and
// follows them; its words arrive with the same letter dissolve. Lines live in the settings (dialogue) so they can be rewritten.
const talkEl = document.getElementById("talk"), talking = [], talkLater = [];
let idleTalk = 6;
const isCell = s => cells.includes(s), isCreature = s => creatures.includes(s);
const alive = s => (isCell(s) && !s.fusing) || (isCreature(s) && !s.dying);
function headOf(s, v) {
  if (isCreature(s) || s.body) { const b = s.body.position; return v.set(b.x, b.y + 0.7 * (s.grow || 1) * (s.large ? 1.6 : 1), b.z); }
  return v.set(s.x, s.R * (s.orb ? 2.2 : FIG_H * 0.9), s.z);
}
const headV = new THREE.Vector3();
// Speech is typed out, letter by letter from the start. The whole line is laid out unseen first, so the box is its
// full size from the beginning and nothing jumps as the words arrive. Returns how long the typing takes.
function typeIn(el, text) {
  const run = el._run = (el._run || 0) + 1; el.textContent = ""; el.setAttribute("aria-label", text);
  const letters = [];
  text.split(" ").forEach((word, wi, all) => {
    const w = document.createElement("span"); w.className = "w"; w.setAttribute("aria-hidden", "true");
    for (const ch of word) { const l = document.createElement("span"); l.className = "l"; l.textContent = ch; l.style.opacity = 0; w.appendChild(l); letters.push(l); }
    el.appendChild(w); if (wi < all.length - 1) { el.appendChild(document.createTextNode(" ")); letters.push(null); } // a space takes a beat too
  });
  const rate = Math.max(4, CFG.speech.typingLettersPerSecond), wait = 0.25, total = wait + letters.length / rate;
  if (reduced) { for (const l of letters) if (l) l.style.opacity = ""; return 0; }
  const t0 = performance.now() / 1000; let shown = 0;
  const step = () => {
    if (run !== el._run || !el.isConnected) return;
    const upto = Math.min(letters.length, Math.floor((performance.now() / 1000 - t0 - wait) * rate));
    for (; shown < upto; shown++) if (letters[shown]) letters[shown].style.opacity = "";
    if (shown < letters.length) requestAnimationFrame(step);
  };
  step();
  return total;
}
const TALK_ON = false; // dialogue is switched off for now; set to true to bring every speech box back
function speak(s, text) {
  if (!TALK_ON) return null;
  if (!text || !alive(s) || talking.length >= Math.max(1, CFG.speech.atOnce) || talking.some(b => b.who === s)) return null;
  const el = document.createElement("div"); el.className = "say"; talkEl.appendChild(el);
  const typed = typeIn(el, text);
  const b = { who: s, el, t: 0, x: 0, y: 0, placed: false, life: typed + CFG.speech.staySeconds + text.length * 0.035, out: null };
  talking.push(b); return b;
}
const later = (seconds, fn) => talkLater.push({ t: seconds, fn });
function nearestTo(x, z, list, reach, skip) {
  let best = null, bd = reach;
  for (const k of list) { if (k === skip || !alive(k)) continue; const d = Math.hypot(k.x - x, k.z - z); if (d < bd) { bd = d; best = k; } }
  return best;
}
const people = () => cells.filter(o => !o.orb && !o.fusing);
// someone says a line; then, some of the time, the nearest other person answers
function converse(s, line, other) {
  if (!speak(s, line)) return;
  if (Math.random() < CFG.speech.replyChance) later(0.6 + line.length / Math.max(4, CFG.speech.typingLettersPerSecond), () => { const o = other && alive(other) ? other : nearestTo(s.x, s.z, people(), 14, s); if (o) speak(o, pick(CFG.dialogue.reply)); });
}
function remarkOnBuilding(kind, x, z) {
  if (Math.random() >= CFG.speech.onBuilding) return;
  const lines = CFG.dialogue.buildings[kind]; if (!lines || !lines.length) return;
  later(1.4, () => { const s = nearestTo(x, z, people(), 16) || nearestTo(x, z, creatures.filter(c => !c.launch && !c.forming), 12); if (s) converse(s, pick(lines)); });
}
function idleRemark() {
  const D = CFG.dialogue, ps = people(), cs = creatures.filter(c => !c.dying && !c.launch && !c.forming && !c.meeting);
  const pool = ps.concat(cs); if (!pool.length) return;
  const s = pick(pool);
  if (isCell(s)) {
    const c = nearestTo(s.x, s.z, cs, 9), o = nearestTo(s.x, s.z, ps, 7, s), roll = Math.random();
    if (c && roll < 0.45 && D.aboutCreature[c.p.form]) return void speak(s, pick(D.aboutCreature[c.p.form]));
    if (o && roll < 0.8) return converse(s, pick(D.aboutOther), o);
    return converse(s, pick(D.churn));
  }
  const o = nearestTo(s.x, s.z, ps, 10);
  speak(s, o && Math.random() < 0.7 ? pick(D.aboutPerson) : pick(D.churn));
}
function updateTalk(dt) {
  for (let i = talkLater.length - 1; i >= 0; i--) if ((talkLater[i].t -= dt) <= 0) { const job = talkLater.splice(i, 1)[0]; job.fn(); }
  if ((idleTalk -= dt) <= 0) { idleTalk = rnd(...CFG.speech.idleEverySeconds); if (!talking.length) idleRemark(); }
  const W = innerWidth, H = innerHeight;
  for (let i = talking.length - 1; i >= 0; i--) {
    const b = talking[i]; b.t += dt;
    if (alive(b.who)) { const [sx, sy] = toScreen(headOf(b.who, headV)); b.x = sx; b.y = sy; b.placed = true; }
    if (b.out == null && b.t > b.life) b.out = 0;
    if (b.out != null && (b.out += dt) > 0.4) { b.el.remove(); talking.splice(i, 1); continue; }
    if (!b.placed) continue;
    // the box sits above and to the right of the head, tail at its lower left; near the right edge it flips to the left
    const w = b.el.offsetWidth, hgt = b.el.offsetHeight, flip = b.x + 16 + w > W - 8 && b.x - 16 - w > 8;
    const left = Math.max(8, Math.min(W - w - 8, flip ? b.x - 16 - w : b.x + 16)), top = Math.max(54, Math.min(H - hgt - 8, b.y - 14 - hgt));
    const pop = reduced ? 1 : 0.6 + 0.4 * ease(Math.min(1, b.t / 0.28));
    b.el.classList.toggle("flip", flip);
    b.el.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px) scale(${pop.toFixed(3)})`;
    b.el.style.opacity = b.out != null ? 0 : 1;
  }
}
function clearTalk() { for (const b of talking) b.el.remove(); talking.length = 0; talkLater.length = 0; idleTalk = 6; }
// ---------- ink: where a split happens, a reaction-diffusion pattern inks itself into the paper ----------
// The pattern is the labyrinth a reaction-diffusion system settles into, made here as a field of equal-length waves
// in every direction (it tiles). The ground draws it wherever a patch has spread: solid lines at the heart of a patch,
// breaking into dots and then nothing toward its edge, which creeps outward as the ink soaks in.
const INK_MAX = 24;
// the pattern itself is a real one: a Gray-Scott reaction-diffusion run to its labyrinth state, worked out ahead of time (it tiles)
const inkField = new THREE.TextureLoader().load("rd.jpg"); inkField.wrapS = inkField.wrapT = THREE.RepeatWrapping;
inkField.minFilter = THREE.LinearFilter; inkField.generateMipmaps = false;
const inkPatches = Array.from({ length: INK_MAX }, () => new THREE.Vector4(0, 0, 0, 0)); // x, z, radius now, strength
const inkLive = [];
const inkMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, extensions: { derivatives: true },
  uniforms: { field: { value: inkField }, patches: { value: inkPatches }, ink: { value: new THREE.Color(CFG.ink.colour) }, tile: { value: CFG.ink.patternSize }, thick: { value: CFG.ink.lineThickness } },
  vertexShader: "varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }",
  fragmentShader: `uniform sampler2D field; uniform vec4 patches[${INK_MAX}]; uniform vec3 ink; uniform float tile; uniform float thick; varying vec2 vW;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
    float fbm(vec2 p){ return vnoise(p) * 0.55 + vnoise(p * 2.13 + 7.1) * 0.3 + vnoise(p * 4.7 + 3.3) * 0.15; }
    void main(){
      float creep = fbm(vW * 1.7);  // fine unevenness in how far the ink has crept, the same for every patch

      float v = texture2D(field, vW / tile).r;
      float aa = max(fwidth(v) * 0.75, 0.01);                  // the line edge is one screen pixel soft, at any zoom
      float blot = texture2D(field, vW / (tile * 7.0) + 0.37).r * 0.9 + 0.1;
      float a = 0.0;
      for (int i = 0; i < ${INK_MAX}; i++) {
        vec4 p = patches[i]; if (p.z < 0.01) continue;
        vec2 dl = vW - p.xy; float dist = length(dl); if (dist > p.z * 1.5) continue;
        // a blot, not a disc: each patch has its own lobes and bays (it reaches further in some directions), and a ragged creeping rim
        float lobes = fbm(dl / max(p.z, 0.001) * 1.25 + p.xy * 0.731 + 11.0);
        float reach = p.z * (0.5 + 0.95 * lobes);
        float d = dist + (creep - 0.5) * p.z * 0.45;
        float soak = 1.0 - smoothstep(reach * 0.5, reach, d); if (soak < 0.004) continue;
        float th = mix(1.04, mix(0.92, 0.4, thick), soak); // high at the edge: only the peaks ink, as dots; low at the heart: full lines
        a = max(a, smoothstep(th - aa, th + aa, v) * smoothstep(0.0, 0.12, soak) * p.w);
      }
      if (a < 0.004) discard;
      gl_FragColor = vec4(ink, a * (0.62 + 0.3 * blot));
    }`,
});
const inkLayer = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), inkMat); inkLayer.rotation.x = -Math.PI / 2; inkLayer.position.y = 0.008; inkLayer.renderOrder = 1; scene.add(inkLayer);
// A patch starts under a cell the moment it is pressed and spreads with the squeeze; let go early and it draws back in.
// Once the split happens it runs out to its full size, then over some seconds fades to a faint trace that stays.
function inkAt(x, z, r, cell = null) {
  if (inkLive.filter(p => p.going == null).length >= INK_MAX - 4) { const old = inkLive.find(p => p.going == null && !p.cell); if (old) old.going = 0; } // the oldest dries away
  const slot = inkPatches.findIndex((v, i) => !inkLive.some(p => p.slot === i)); if (slot < 0) return null;
  const p = { slot, x, z, r, grow: 0.06, age: 0, cell, going: null }; inkLive.push(p); return p;
}
const inkSize = o => o.orb ? CFG.ink.reachCircle : CFG.ink.reachPerson + CFG.ink.reachPerSize * o.R;
function updateInk(dt) {
  for (const o of cells) if (o.p > 0.04 && !o.inkP && !o.fusing) o.inkP = inkAt(o.x, o.z, inkSize(o), o);
  for (let i = inkLive.length - 1; i >= 0; i--) {
    const p = inkLive[i]; let w = 1;
    if (p.cell) {
      const o = p.cell;
      if (!cells.includes(o)) { p.cell = null; p.going = 0; }                      // the cell went some other way
      else {
        p.x = o.x; p.z = o.z; p.grow += (Math.min(1, o.p / 2) * 0.8 - p.grow) * Math.min(1, dt * 5);
        if (o.p <= 0.001 && p.grow < 0.03) { o.inkP = null; inkPatches[p.slot].set(0, 0, 0, 0); inkLive.splice(i, 1); continue; }
      }
    } else {
      p.grow = Math.min(1, p.grow + dt / 1.6); p.age += dt;
      w = 1 - smooth((p.age - CFG.ink.holdSeconds) / Math.max(0.05, CFG.ink.fadeSeconds));                                           // fades away completely
      if (w <= 0) { inkPatches[p.slot].set(0, 0, 0, 0); inkLive.splice(i, 1); continue; }
    }
    let rad = p.r * p.grow;
    if (p.going != null) { p.going += dt / 3; w *= 1 - p.going; }
    inkPatches[p.slot].set(p.x, p.z, Math.max(0, rad), Math.max(0, w));
    if (p.going != null && p.going >= 1) { inkPatches[p.slot].set(0, 0, 0, 0); inkLive.splice(i, 1); }
  }
}
function clearInk() { inkLive.length = 0; for (const v of inkPatches) v.set(0, 0, 0, 0); }
// people aren't squeezed. A touch pops one, and the pop is how they split: two people fly out of the burst.
let popSeen = false;
function popPerson(o) {
  if (!cells.includes(o) || o.fusing) return;
  if (arrivalTap(o)) return; // during the arrival a tap steps the camera back instead of popping
  o.p = 2; divide(o); buzz([12, 30, 18]);
  if (!popSeen) { popSeen = true; hint("four together become something larger"); }
}
function divide(o) {
  if (!cells.includes(o)) return;
  const sh = shapeOf(o), R = o.R, off = 0.6 * sh.xs * R;
  const ri = new THREE.Vector3(Math.cos(o.roll), 0, -Math.sin(o.roll)).normalize(); // the axis it pinched along, on the paper
  const R2 = o.orb || o.giant ? CFG.people.firstSize : Math.max(CFG.people.smallestSize, R * CFG.people.shrinkEachSplit), full = cells.length >= 16;
  const bh = o.giant ? R * FIG_H * 0.5 : R;
  const [sx, sy] = toScreen(new THREE.Vector3(o.x, bh, o.z));
  const [ex] = toScreen(new THREE.Vector3(o.x, bh, o.z).addScaledVector(camR, o.giant ? R * 0.6 : R));
  bursts.push({ x: sx, y: sy, r: Math.abs(ex - sx), t: 0, seed: nextSeed++ * 5.1 });
  for (const side of full ? [0] : [-1, 1]) {
    // a daughter keeps the map; now and then it drifts to a neighbouring fragment
    const tile = Math.random() < 0.7 ? o.tile : (o.tile + (Math.random() < 0.5 ? 1 : MAPS.length - 1)) % MAPS.length;
    const c = makeCell(o.x + ri.x * off * side, o.z + ri.z * off * side, R2, tile, 1.3, 0.75);
    c.vx = ri.x * side * 7; c.vz = ri.z * side * 7; c.svx = -2; c.svy = 2;
    if (side !== -1 && Math.random() < CFG.speech.onSplit) { const born = c, line = pick(o.orb ? CFG.dialogue.split : CFG.dialogue.pop); later(0.5, () => converse(born, line)); }
  }
  { const p = o.inkP || inkAt(o.x, o.z, inkSize(o)); if (p) { p.cell = null; p.x = o.x; p.z = o.z; } o.inkP = null; } // the patch is let go to finish spreading
  disposeCell(o);
  hatch(o.x, o.z, o.tile, o.giant ? CFG.people.firstSize : R);
  pop(); rustle(); buzz([15, 30, 40]);
  splits++;
  if (splits === 1) hint("every cell divides · tap a creature");
  else if (splits === 3) hint("");
}

// ---------- the brood: a paper creature unfolds out of the division ----------
const CAP = 14;
const SMALL = ["hopper", "crawler"], LARGE = ["walker", "floater", "roller"];
const formGene = f => (FORMS.indexOf(f) + rnd(0.15, 0.85)) / FORMS.length;
function hatch(x, z, tile, R) {
  // a division only frees something small: a paper frog or a caterpillar
  const g = randomGenome(), T = MAPS.length;
  g[G.print] = (tile + 0.5) / T;
  if (Math.random() < 0.5) g[G.tone] = (tile + 0.5) / T;
  g[G.form] = formGene(pick(SMALL)); g[G.bulk] = rnd(0, 0.45); g[G.legs] = rnd(0, 0.6);
  const c = spawnCreature(g, x, z, 0.75);
  const to = new THREE.Vector3(-camF.x, 0, -camF.z).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), rnd(-0.9, 0.9));
  const d = rnd(2.8, 4.2) + R * 0.6;
  c.launch = { t: 0, dur: 0.9, fx: x, fz: z, tx: x + to.x * d, tz: z + to.z * d, h: R * 1.6 + 1.5 };
  c.yaw = Math.atan2(to.x, to.z); c.wand = c.yaw;
  const small = creatures.filter(k => !k.large && k.leaving == null && !k.dying);
  if (small.length > CAP) { const old = small.find(k => !k.launch && !k.meeting); if (old) startDeath(old); }
}
// ---------- clumping: four cells that cling together fuse into one large creature ----------
let FUSE_N = CFG.people.gatherAtCount; const FUSE_HOLD = 1.8, FUSE_T = 1.6, BIG_CAP = 5;
const fusions = [];
function clumps() { // groups of cells touching one another
  const free = cells.filter(o => o.held == null && !o.fusing && o.age > 1.2), seen = new Set(), out = [];
  for (const o of free) {
    if (seen.has(o)) continue;
    const comp = [o], st = [o]; seen.add(o);
    while (st.length) {
      const a = st.pop();
      for (const b of free) if (!seen.has(b) && Math.hypot(a.x - b.x, a.z - b.z) < (a.R + b.R) * 1.3) { seen.add(b); comp.push(b); st.push(b); }
    }
    out.push(comp);
  }
  return out;
}
function updateClumps(dt) {
  const inBig = new Set();
  for (const comp of clumps()) {
    if (comp.length < FUSE_N) continue;
    for (const o of comp) { inBig.add(o); o.clumpT = (o.clumpT || 0) + dt; }
    if (Math.min(...comp.map(o => o.clumpT)) > FUSE_HOLD) {
      const cx = comp.reduce((a, o) => a + o.x, 0) / comp.length, cz = comp.reduce((a, o) => a + o.z, 0) / comp.length;
      const four = comp.sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz)).slice(0, FUSE_N);
      startFusion(four);
    }
  }
  for (const o of cells) if (!inBig.has(o)) o.clumpT = 0;
}
function startFusion(group) {
  speak(group[0], pick(CFG.dialogue.gather));
  const cx = group.reduce((a, o) => a + o.x, 0) / group.length, cz = group.reduce((a, o) => a + o.z, 0) / group.length;
  const f = { cells: group, x: cx, z: cz, t: 0, R: group.reduce((a, o) => a + o.R, 0) / group.length, creature: null };
  for (const o of group) { o.fusing = f; o.fx0 = o.x; o.fz0 = o.z; o.R0 = o.R; }
  // the large creature is folded from the maps the four nuclei carried
  const tiles = group.map(o => o.tile), count = {};
  for (const t of tiles) count[t] = (count[t] || 0) + 1;
  const main = +Object.keys(count).sort((a, b) => count[b] - count[a])[0], other = tiles.find(t => t !== main) ?? main, T = MAPS.length;
  const g = randomGenome();
  g[G.form] = formGene(Math.random() < CFG.creatures.birdChance ? "floater" : pick(["walker", "roller"])); g[G.print] = (main + 0.5) / T; g[G.tone] = (other + 0.5) / T; // birds more often than not
  g[G.bulk] = rnd(0.55, 1); g[G.stride] = rnd(0.4, 1); g[G.wings] = rnd(0.3, 1);
  f.genome = g;
  fusions.push(f);
  squelch();
  if (!bigSeen) { bigSeen = true; hint("four together raise a building · tap it to crack it open"); }
}
let bigSeen = false;
function updateFusions(dt) {
  for (let i = fusions.length - 1; i >= 0; i--) {
    const f = fusions[i]; f.t += dt;
    let t = Math.min(1, f.t / FUSE_T);
    // the four crowd into the middle, then go in one pop: they vanish together and the large creature is simply there
    const t0 = t; t = Math.min(1, f.t / Math.max(0.05, CFG.people.popIntoLargeSeconds));
    for (const o of f.cells) {
      const e2 = smooth(t);
      o.x = o.fx0 + (f.x - o.fx0) * e2 * 0.75; o.z = o.fz0 + (f.z - o.fz0) * e2 * 0.75; o.vx = o.vz = 0;
    }
    if (t >= 1) {
      for (const o of f.cells) if (!o.popped) disposeCell(o);
      riseFromFusion(f); // four people become a building (they used to become one large creature)
      const [sx, sy] = toScreen(new THREE.Vector3(f.x, f.R, f.z));
      const [ex] = toScreen(new THREE.Vector3(f.x, f.R, f.z).addScaledVector(camR, f.R * 3.4));
      bursts.push({ x: sx, y: sy, r: Math.abs(ex - sx), t: 0, seed: nextSeed++ * 5.1 });
      pop(); rustle(0); buzz([20, 40, 60]);
      fusions.splice(i, 1);
    }
  }
}
// ---------- four people become a building; a building cracked open lets creatures out ----------
// The building is one of the large ones (a gateway, a domed tomb, a minaret...), rising where the four met. A tap cracks
// it: a black tear opens in it and a creature comes out of the crack, flying (a crane) or crawling (a frog, a
// caterpillar). Each building can be cracked a few times.
const CRACKS_MAX = 3;
function riseFromFusion(f) {
  const B = CFG.buildings, odds = Object.entries(B.fromLarge).filter(([k, p]) => BUILD[k] && p > 0), sum = odds.reduce((a, [, p]) => a + p, 0) || 1;
  let k = Math.random() * sum, kind = odds[0][0]; for (const [name, p] of odds) { if ((k -= p) < 0) { kind = name; break; } }
  const height = rnd(...(B.heightLarge[kind] || [6, 8])) * 0.8, pic = picture(kind, height);
  const [px, pz] = openSpot(f.x, f.z, pic.r + B.gapLarge, height, height * BUILD[kind][4]);
  const r = placeRuin(pic, px, pz, { yaw: 0, tilt: false, sink: 0, kind });
  r.crackable = true; r.cracks = 0; r.height = height; r.wide = height * BUILD[kind][4]; r.pic = pic.g.children[0];
  pic.g.traverse(o => { o.userData.ruin = r; });
  remarkOnBuilding(kind, px, pz); rumble();
}
// a black tear in the face of the building, around the place it was tapped (in the building's own flat face)
function crackShape(len, wid) {
  const pts = [], n = 9, a = rnd(-0.6, 0.6) + (Math.random() < 0.5 ? 0 : Math.PI / 2);
  const along = new THREE.Vector2(Math.cos(a), Math.sin(a)), across = new THREE.Vector2(-along.y, along.x);
  for (let i = 0; i <= n; i++) { const t = i / n - 0.5, w = wid * (1 - 4 * t * t) * rnd(0.5, 1.2) + wid * 0.08; pts.push(along.clone().multiplyScalar(t * len).addScaledVector(across, w + rnd(-0.1, 0.1) * wid)); }
  for (let i = n; i >= 0; i--) { const t = i / n - 0.5, w = wid * (1 - 4 * t * t) * rnd(0.5, 1.2) + wid * 0.08; pts.push(along.clone().multiplyScalar(t * len).addScaledVector(across, -w + rnd(-0.1, 0.1) * wid)); }
  return new THREE.ShapeGeometry(new THREE.Shape(pts));
}
function crackBuilding(r, point) {
  if (!r.crackable || r.cracks >= CRACKS_MAX || r.going != null) return;
  r.cracks++;
  const local = r.g.worldToLocal(point.clone());
  const geo = crackShape(r.height * rnd(0.45, 0.6), r.height * rnd(0.1, 0.15)), px = local.x, py = Math.max(r.height * 0.15, local.y);
  // the tear is cut only where the building is: it is drawn with the building's own picture, in black, so it stops at its outline
  const [u, v, w, hh] = BUILD[r.kind], pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, u + ((px + pos.getX(i)) / r.wide + 0.5) * w, v + ((py + pos.getY(i)) / r.height) * hh);
  uv.needsUpdate = true;
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x050403, map: r.pic.material.map, alphaTest: 0.5, side: THREE.DoubleSide }));
  m.position.set(px, py, 0.02); m.renderOrder = 2; r.g.add(m);
  // the tear opens, then the creature comes through it: it starts small inside the crack, on the face of the building,
  // and grows as it pushes out towards you; a crane flies on from there, a frog or a caterpillar drops to the ground
  m.scale.setScalar(0.15); later(0.07, () => m.scale.setScalar(0.55)); later(0.15, () => m.scale.setScalar(0.85)); later(0.24, () => m.scale.setScalar(1));
  const fly = Math.random() < 0.5, cx = r.x + m.position.x, cy = m.position.y + r.g.position.y, cz = r.z + 0.05;
  later(0.32, () => {
    if (!ruins.includes(r)) return;
    const g = randomGenome(), T = MAPS.length, tile = Math.floor(rnd(0, T));
    g[G.print] = (tile + 0.5) / T; g[G.form] = formGene(fly ? "floater" : pick(SMALL)); g[G.bulk] = rnd(0.1, 0.5); g[G.legs] = rnd(0, 0.6); g[G.wings] = rnd(0.6, 1);
    const c = spawnCreature(g, cx, cz, 0.8);
    const to = new THREE.Vector3(rnd(-0.6, 0.6), 0, 1).normalize(), d = fly ? rnd(3.5, 5.5) : rnd(1.6, 2.6);
    c.launch = { t: 0, dur: fly ? 1.3 : 0.9, fx: cx, fz: cz, tx: cx + to.x * d, tz: cz + to.z * d, h: fly ? 1.5 : 0.4, y0: cy, grow: true };
    c.yaw = Math.atan2(to.x, to.z); c.wand = c.yaw;
  });
  if (!playSound(CRACK, 0.5)) pop(); buzz([14, 30, 20]);
}
function squelch() { // a low wet churn while they fuse (switched off)
  return;
  const A = audio(); if (!A) return; const t = A.currentTime;
  const src = A.createBufferSource(); src.buffer = noiseBuf;
  const fl = A.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.setValueAtTime(300, t); fl.frequency.linearRampToValueAtTime(900, t + FUSE_T);
  const g = A.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.14, t + 0.3); g.gain.linearRampToValueAtTime(0, t + FUSE_T);
  src.connect(fl).connect(g).connect(A.destination); src.start(t); src.stop(t + FUSE_T + 0.1);
}

function spawnCreature(genome, x, z, grow = 1) {
  const c = {
    id: nextId++, genome, age: 0, walkT: rnd(0, 10), k: 0.05, x, z, yaw: rnd(0, 6.28), turnV: 0, bank: 0, lunge: 0, shake: 0,
    dying: null, elderT: 0, grow, pop: 0, alt: null, leaving: null, launch: null, wand: rnd(0, 6.28),
    hop: { air: false, t: 0, rest: rnd(0.2, 0.8), dur: 0.5, dist: 0 }, rollA: 0, trail: [], trailD: 0,
    uvOff: [Math.random(), Math.random()],
    energy: rnd(60, 100), met: new Map(), meeting: null, cocoon: false, grace: 2, gen: 0,
  };
  c.moveDir = c.yaw;
  buildBody(c);
  // the first few creatures live 3–6 seconds, so buildings come at once; lives lengthen to 14–34 seconds over the next thirty
  const CC = CFG.creatures, lk = Math.min(1, Math.max(0, (window.__lifeN - CC.shortLivesFor) / Math.max(1, CC.lengthenOver))); window.__lifeN++;
  c.life = lerp(lerp(CC.firstLivesSeconds[0], CC.laterLivesSeconds[0], lk), lerp(CC.firstLivesSeconds[1], CC.laterLivesSeconds[1], lk), genome[G.life]) * (lk > 0 ? rnd(0.9, 1.1) : 1);
  creatures.push(c);
  return c;
}
function removeCreature(c) {
  if (c.meeting) cancelMeeting(c.meeting);
  destroyBody(c);
  creatures = creatures.filter(x => x !== c);
}
// ---------- the paper brood's genetics (from Paper Brood) ----------
// When two come within reach they either trade scraps of paper (each takes on the other's map and pulls a
// trait toward it), or the hungrier one reels the other in and unfolds it scrap by scrap, or the pair press
// together into a crumpled cocoon that bursts into both parents (changed) and a child bred from them.
const THREAD_RANGE = 3.4, SNAP = 6.5, MAX_POP = 22;
function exchange(c, other) {
  const g = [...c.genome];
  let i = 0, best = -1;
  g.forEach((v, k) => { const d = Math.abs(other.genome[k] - v); if (d > best) { best = d; i = k; } });
  g[i] += (other.genome[i] - g[i]) * 0.55;
  if (Math.random() < 0.35 + MUT * 2) { const k = Math.floor(Math.random() * g.length); g[k] += gauss() * 0.18; }
  for (let k = 0; k < g.length; k++) g[k] = clamp01(g[k]);
  return { genome: g };
}
const touchDist = (a, b) => 0.75 * (a.p.bulk * a.grow + b.p.bulk * b.grow) + 0.3;
const free = c => !c.meeting && !c.dying && !c.cocoon && !c.forming && !c.launch && c.leaving == null && c.k >= 1 && c.grace <= 0;
const anchor = c => new THREE.Vector3(c.body.position.x, c.body.position.y + c.topY * 0.5 * c.body.scale.y, c.body.position.z);
function threadPoint(A, B, f) {
  const p = A.clone().lerp(B, f), sag = Math.max(0, SNAP - A.distanceTo(B)) * 0.12;
  p.y = Math.max(0.03, p.y - Math.sin(Math.PI * f) * sag);
  return p;
}
function checkMeeting(a, b) {
  if (!free(a) || !free(b)) return;
  if ((a.met.get(b.id) || 0) > simT) return;
  if (Math.hypot(a.x - b.x, a.z - b.z) > THREAD_RANGE * Math.max(a.grow, b.grow)) return;
  const elder = c => c.elderT > 0 ? 0.7 : 1;
  const threat = c => c.p.aggr * (0.6 + 0.4 * c.p.bulk * c.grow) * (1.2 - c.energy / 120) * elder(c);
  const ta = threat(a), tb = threat(b), hot = Math.max(ta, tb);
  const m = { a, b, t: 0, kind: "trade", pieces: [], next: 0.5, sent: 0 };
  if (hot > 0.35 && Math.random() < hot) {
    m.kind = "kill"; m.killer = ta >= tb ? a : b; m.victim = m.killer === a ? b : a;
  } else if (creatures.filter(c => !c.dying).length < MAX_POP && a.energy > 30 && b.energy > 30 && a.large === b.large && Math.random() < 0.55) {
    m.kind = "breed";
  } else {
    m.ga = [...a.genome]; m.gb = [...b.genome]; m.goal = 3 + Math.floor(rnd(0, 3));
  }
  a.meeting = b.meeting = m;
  meetings.push(m);
}
// a folded scrap of the giver's paper that flies across
function sendPiece(m, from, to) {
  const s = (0.16 + 0.1 * from.p.bulk) * from.grow;
  UV_SCALE = 0.3 / s;
  const geo = paperGeo([[[-s, 0, 0], [s, 0, 0], [0, s * 1.4, 0]], [[s, 0, 0], [0, s * 1.4, 0], [0, s * 0.5, s * 0.6]]], [Math.random(), Math.random()]);
  UV_SCALE = 0.45;
  const mat = new THREE.MeshStandardMaterial({ map: from.mat.map, color: 0xf5f4f0, flatShading: true, side: THREE.DoubleSide, roughness: 0.9 });
  const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true;
  scene.add(mesh);
  m.pieces.push({ mesh, from, to, t: 0, spin: rnd(4, 8) });
}
function arrive(m, pc) {
  if (m.kind !== "trade") return;
  // the receiver's second paper becomes the giver's map, and it pulls one trait toward the giver
  const g = pc.to === m.a ? m.ga : m.gb, src = pc.from.genome;
  g[G.tone] = src[G.print];
  pc.to.mat2.map = pc.from.mat.map; pc.to.mat2.needsUpdate = true;
  let i = 0, best = -1;
  g.forEach((v, k) => { if (k === G.tone) return; const d = Math.abs(src[k] - v); if (d > best) { best = d; i = k; } });
  g[i] += (src[i] - g[i]) * 0.35;
  if (Math.random() < MUT * 2) { const k = Math.floor(Math.random() * g.length); g[k] = clamp01(g[k] + gauss() * 0.15); }
}
function updateMeeting(m, dt) {
  m.t += dt;
  const { a, b } = m;
  if (m.kind === "trade") {
    if (m.t > 14) return endMeeting(m);
    m.next -= dt;
    if (m.next <= 0 && m.sent < m.goal) { m.next = 1.2; const from = m.sent % 2 ? b : a; sendPiece(m, from, from === a ? b : a); m.sent++; }
    if (m.sent >= m.goal && m.pieces.length === 0) return endMeeting(m);
  } else if (m.kind === "kill") {
    const { killer, victim } = m;
    if (m.feeding == null) { // the victim is reeled in
      const dx = killer.x - victim.x, dz = killer.z - victim.z, dd = Math.hypot(dx, dz) || 1;
      victim.x += dx / dd * 1.5 * dt; victim.z += dz / dd * 1.5 * dt;
      if (dd < touchDist(a, b)) { m.feeding = 0; victim.cocoon = true; }
      if (m.t > 10) return endMeeting(m);
    } else { // and unfolded scrap by scrap
      m.feeding += dt;
      victim.k = Math.max(0.02, 1 - m.feeding / 1.8); victim.shake = 0.1;
      m.next -= dt; if (m.next <= 0) { m.next = 0.2; sendPiece(m, victim, killer); }
      if (m.feeding >= 1.8) {
        const res = exchange(killer, victim);
        killer.energy = Math.min(120, killer.energy + 60);
        victim.meeting = null; victim.cocoon = false; victim.shake = 0;
        leaveSheet(victim); removeCreature(victim);
        endMeeting(m);
        apply(killer, res);
        return;
      }
    }
  } else { // breed
    if (!m.cocoon) {
      const dx = b.x - a.x, dz = b.z - a.z, dd = Math.hypot(dx, dz) || 1;
      a.x += dx / dd * 0.9 * dt; a.z += dz / dd * 0.9 * dt; b.x -= dx / dd * 0.9 * dt; b.z -= dz / dd * 0.9 * dt;
      if (dd < touchDist(a, b)) startCocoon(m);
      else if (m.t > 12) return endMeeting(m);
    } else updateCocoon(m, dt);
  }
  for (let i = m.pieces.length - 1; i >= 0; i--) {
    const pc = m.pieces[i]; pc.t += dt / 0.9;
    const q = threadPoint(anchor(pc.from), anchor(pc.to), Math.min(1, pc.t));
    pc.mesh.position.copy(q); pc.mesh.position.y += 0.08;
    pc.mesh.rotation.set(pc.t * pc.spin, pc.t * pc.spin * 0.7, 0);
    if (pc.t >= 1) { arrive(m, pc); disposePiece(pc); m.pieces.splice(i, 1); }
  }
}
function disposePiece(pc) { scene.remove(pc.mesh); pc.mesh.geometry.dispose(); pc.mesh.material.dispose(); }
function crumpledBall(r, map, seed) {
  const g = new THREE.IcosahedronGeometry(r, 1), a = g.attributes.position, off = new Map();
  for (let i = 0; i < a.count; i++) {
    const key = `${a.getX(i).toFixed(3)},${a.getY(i).toFixed(3)},${a.getZ(i).toFixed(3)}`;
    if (!off.has(key)) off.set(key, 1 + (Math.random() - 0.5) * 0.45);
    const k = off.get(key); a.setXYZ(i, a.getX(i) * k, a.getY(i) * k, a.getZ(i) * k);
  }
  const tris = [];
  for (let i = 0; i < a.count; i += 3) tris.push([0, 1, 2].map(k => [a.getX(i + k), a.getY(i + k), a.getZ(i + k)]));
  g.dispose(); UV_SCALE = 0.4 / r; const wad = paperGeo(tris, [seed, seed * 1.7]); UV_SCALE = 0.45;
  const mat = new THREE.MeshStandardMaterial({ map, color: 0xf5f4f0, flatShading: true, side: THREE.DoubleSide, roughness: 0.9 });
  const mesh = new THREE.Mesh(wad, mat); mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(wad, 6), new THREE.LineBasicMaterial({ color: 0x2a2826, transparent: true, opacity: 0.35 })));
  return mesh;
}
function startCocoon(m) {
  const { a, b } = m;
  m.cocoon = { t: 0, x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, r: (0.4 * (a.p.bulk + b.p.bulk) / 2 + 0.25) * (a.grow + b.grow) / 2 };
  a.cocoon = b.cocoon = true;
  const grp = new THREE.Group(), r = m.cocoon.r;
  const wa = crumpledBall(r, a.mat.map, Math.random()), wb = crumpledBall(r * 0.9, b.mat.map, Math.random());
  wa.position.x = -0.22 * r; wb.position.set(0.25 * r, 0.1 * r, 0.1 * r);
  grp.add(wa, wb); grp.position.set(m.cocoon.x, r, m.cocoon.z); grp.scale.setScalar(0.05);
  scene.add(grp); m.cocoonGroup = grp;
}
function updateCocoon(m, dt) {
  const C = m.cocoon, { a, b } = m; C.t += dt;
  for (const c of [a, b]) { c.k = Math.max(0.02, 1 - C.t / 0.5); c.x = lerp(c.x, C.x, Math.min(1, dt * 4)); c.z = lerp(c.z, C.z, Math.min(1, dt * 4)); }
  const grow = Math.min(1, C.t / 0.5), pulse = 1 + Math.sin(C.t * 7) * 0.06 * grow;
  m.cocoonGroup.scale.setScalar(Math.max(0.05, grow) * pulse);
  m.cocoonGroup.rotation.y += dt * 0.9; m.cocoonGroup.rotation.z = Math.sin(C.t * 3) * 0.15;
  if (C.t >= 3) burst(m);
}
function burst(m) {
  const C = m.cocoon, { a, b } = m, th = rnd(0, 6.28), d = 1.1 * (a.grow + b.grow) / 2;
  a.x = C.x + Math.cos(th) * d; a.z = C.z + Math.sin(th) * d;
  b.x = C.x - Math.cos(th) * d; b.z = C.z - Math.sin(th) * d;
  a.yaw = Math.atan2(a.x - C.x, a.z - C.z); b.yaw = a.yaw + Math.PI;
  const na = exchange(a, b), nb = exchange(b, a);
  // the child is bred from both genomes with mutation; small parents have small children, large ones large
  const g = breed(a.genome, b.genome, MUT), big = !!(a.large && b.large), form = FORMS[Math.min(4, Math.floor(g[G.form] * 5))];
  if (!big && !SMALL.includes(form)) g[G.form] = formGene(pick(SMALL));
  if (big && SMALL.includes(form)) g[G.form] = formGene(pick(LARGE));
  const ch = spawnCreature(g, C.x, C.z, big ? 1.55 : 0.75);
  ch.large = big; ch.gen = Math.max(a.gen, b.gen) + 1; if (big) ch.life *= 1.4;
  ch.uvOff = pick([a, b]).uvOff;
  const ang = th + Math.PI / 2, dd = rnd(1.5, 2.5) * (big ? 1.5 : 1);
  ch.launch = { t: 0, dur: 0.6, fx: C.x, fz: C.z, tx: C.x + Math.cos(ang) * dd, tz: C.z + Math.sin(ang) * dd, h: 1.6 };
  rustle(0);
  a.energy -= 15; b.energy -= 15;
  a.cocoon = b.cocoon = false;
  endMeeting(m);
  apply(a, na); apply(b, nb);
}
function apply(c, res) {
  if (c.dying || !creatures.includes(c)) return;
  c.genome = res.genome;
  destroyBody(c); buildBody(c); c.pop = 1;
}
function endMeeting(m) {
  if (m.ended) return; m.ended = true;
  const { a, b } = m;
  for (const pc of m.pieces) disposePiece(pc);
  m.pieces = [];
  if (m.cocoonGroup) { scene.remove(m.cocoonGroup); m.cocoonGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); m.cocoonGroup = null; }
  for (const c of [a, b]) { c.meeting = null; c.cocoon = false; c.shake = 0; c.grace = 2; if (c.k < 1 && !c.dying) c.k = Math.max(c.k, 0.02); }
  a.met.set(b.id, simT + 10); b.met.set(a.id, simT + 10);
  const i = meetings.indexOf(m); if (i >= 0) meetings.splice(i, 1);
  if (m.kind === "trade") { apply(a, { genome: m.ga }); apply(b, { genome: m.gb }); }
}
function cancelMeeting(m) { endMeeting(m); }
function startDeath(c) {
  if (c.dying) return;
  if (c.meeting) cancelMeeting(c.meeting);
  c.dying = { t: 0, tilt: rnd(-0.7, 0.7) };
}

const INK = 0x2f2d2a, _Line = THREE.LineBasicMaterial;
// ---------- what the dead leave behind: ruins ----------
// Where a creature dies its sheet lies on the sand for a moment, and a piece of architecture rises out of the
// ground and stays: rubble and column drums from the small ones, a broken wall with arched windows from a
// walker, an octagonal pavilion from a crane, a fluted minaret tier from a rolling star. A star that dies
// beside a minaret adds a narrower tier on top of it, so towers grow storey by storey.
const RUIN_COL = { buff: 0xedc596, sand: 0xe0a877, red: 0xc0653f, deep: 0x9c4b2e, dome: 0x7d5a45 };
const RUIN_CAP = 140;
const ruins = [];
const outlineMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
const voidMat = new THREE.MeshBasicMaterial({ color: 0x0d0805, side: THREE.DoubleSide });
const edgeMat = new _Line({ color: INK, transparent: true, opacity: 0.85 });
// a solid with a thick ink outline (an inverted shell) and its creases inked
function inked(geo, color, crease = 28, line = 0.035) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, flatShading: true }));
  m.castShadow = SHADOWS; m.receiveShadow = true; g.add(m);
  geo.computeBoundingSphere();
  const bs = geo.boundingSphere, s = 1 + line / Math.max(0.15, bs.radius);
  const o = new THREE.Mesh(geo, outlineMat); o.scale.setScalar(s); o.position.copy(bs.center).multiplyScalar(1 - s);
  g.add(o, new THREE.LineSegments(new THREE.EdgesGeometry(geo, crease), edgeMat));
  return g;
}
// knock the corners about so cut stone looks worn
function chip(geo, amt) {
  const a = geo.attributes.position, off = new Map();
  for (let i = 0; i < a.count; i++) {
    const key = `${a.getX(i).toFixed(3)},${a.getY(i).toFixed(3)},${a.getZ(i).toFixed(3)}`;
    if (!off.has(key)) off.set(key, [rnd(-amt, amt), rnd(-amt, amt), rnd(-amt, amt)]);
    const d = off.get(key); a.setXYZ(i, a.getX(i) + d[0], a.getY(i) + d[1], a.getZ(i) + d[2]);
  }
  geo.computeVertexNormals(); return geo;
}
function archPath(p, x, y, w, h) { // an arch-topped opening, clockwise
  const r = w / 2;
  p.moveTo(x - r, y); p.lineTo(x - r, y + h - r); p.absarc(x, y + h - r, r, Math.PI, 0, true); p.lineTo(x + r, y); p.lineTo(x - r, y);
}
function archVoid(w, h) { const s = new THREE.Shape(); archPath(s, 0, 0, w, h); return new THREE.Mesh(new THREE.ShapeGeometry(s, 10), voidMat); }

// a block of stone, chipped
function block(w, h, d, color) { return inked(chip(new THREE.BoxGeometry(w, h, d), Math.min(w, h, d) * 0.12), color); }
// a fallen column drum
function drum(r, h, color) {
  const g = inked(chip(new THREE.CylinderGeometry(r, r * 1.04, h, 12), r * 0.06), color, 40);
  g.rotation.z = Math.PI / 2; g.position.y = r * 0.85; return g;
}
// a heap of rubble
function rubble(s) {
  const g = new THREE.Group(), n = 3 + Math.floor(rnd(0, 4));
  for (let i = 0; i < n; i++) {
    const w = rnd(0.35, 0.8) * s, hh = rnd(0.25, 0.6) * s, d = rnd(0.3, 0.7) * s;
    const b = block(w, hh, d, pick([RUIN_COL.buff, RUIN_COL.sand, RUIN_COL.red]));
    b.position.set(rnd(-0.6, 0.6) * s, hh * rnd(0.2, 0.5), rnd(-0.6, 0.6) * s); b.rotation.set(rnd(-0.4, 0.4), rnd(0, 6.28), rnd(-0.4, 0.4));
    g.add(b);
  }
  if (Math.random() < 0.5) { const d = drum(0.28 * s, 0.6 * s, RUIN_COL.buff); d.position.x += rnd(-0.5, 0.5) * s; d.rotation.y = rnd(0, 6.28); g.add(d); }
  return { g, r: 0.9 * s };
}
// a broken wall: a jagged top, arched windows and sometimes a doorway, all black inside
function wall(s, color) {
  const W = rnd(2.2, 3.4) * s, H = rnd(1.8, 2.8) * s, D = 0.42 * s, sh = new THREE.Shape();
  sh.moveTo(-W / 2, 0); sh.lineTo(W / 2, 0);
  const steps = 7; let y = H * rnd(0.55, 1);
  sh.lineTo(W / 2, y);
  for (let i = steps - 1; i >= 0; i--) { y = Math.max(H * 0.45, Math.min(H, y + rnd(-0.35, 0.35) * H)); sh.lineTo(-W / 2 + W * i / steps + rnd(-0.05, 0.05) * W, y); }
  sh.lineTo(-W / 2, 0);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: D, bevelEnabled: false, curveSegments: 6 });
  geo.translate(0, 0, -D / 2);
  const g = new THREE.Group(), body = inked(chip(geo, 0.03 * s), color, 30);
  g.add(body);
  const openings = [];
  if (Math.random() < 0.6) openings.push([rnd(-0.15, 0.15) * W, 0, W * 0.3, H * 0.62]);
  const nWin = 1 + Math.floor(rnd(0, 3));
  for (let i = 0; i < nWin; i++) openings.push([(i + 0.5) / nWin * W * 0.8 - W * 0.4, H * rnd(0.55, 0.7), W * 0.07, H * 0.14]);
  for (const [x, y0, w, hh] of openings) for (const side of [-1, 1]) {
    if (y0 > 0 && y0 + hh > H * 0.45) continue; // no window through the broken top
    const v = archVoid(w, hh); v.position.set(x, y0, side * (D / 2 + 0.006)); g.add(v);
  }
  // fallen blocks at its foot
  for (let i = 0; i < 3; i++) { const b = block(rnd(0.3, 0.6) * s, rnd(0.25, 0.5) * s, rnd(0.3, 0.5) * s, color); b.position.set(rnd(-0.5, 0.5) * W, 0.12 * s, (Math.random() < 0.5 ? -1 : 1) * rnd(0.4, 0.9) * s); b.rotation.set(rnd(-0.4, 0.4), rnd(0, 6.28), rnd(-0.3, 0.3)); g.add(b); }
  return { g, r: W * 0.5 };
}
// an open pavilion: eight pillars, a deep eave and a dome
function chhatri(s, onTop) {
  const g = new THREE.Group(), R = 0.55 * s;
  if (!onTop) { const base = inked(new THREE.CylinderGeometry(R * 1.15, R * 1.2, 0.18 * s, 8), RUIN_COL.red); base.position.y = 0.09 * s; g.add(base); }
  const y0 = onTop ? 0 : 0.18 * s, ph = 0.6 * s;
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU + Math.PI / 8, p = inked(new THREE.BoxGeometry(0.08 * s, ph, 0.08 * s), RUIN_COL.red);
    p.position.set(Math.cos(a) * R * 0.9, y0 + ph / 2, Math.sin(a) * R * 0.9); g.add(p);
  }
  const eave = inked(new THREE.CylinderGeometry(R * 1.35, R * 1.05, 0.12 * s, 8), RUIN_COL.red); eave.position.y = y0 + ph + 0.06 * s; g.add(eave);
  const drumG = inked(new THREE.CylinderGeometry(R * 0.85, R * 0.85, 0.12 * s, 16), RUIN_COL.buff); drumG.position.y = y0 + ph + 0.18 * s; g.add(drumG);
  const dome = inked(new THREE.SphereGeometry(R * 0.85, 16, 10, 0, TAU, 0, Math.PI / 2), RUIN_COL.dome, 50); dome.position.y = y0 + ph + 0.24 * s; dome.scale.y = 1.15; g.add(dome);
  const fin = inked(new THREE.ConeGeometry(0.05 * s, 0.3 * s, 6), RUIN_COL.deep); fin.position.y = y0 + ph + 0.24 * s + R * 0.98 + 0.15 * s; g.add(fin);
  return { g, r: R * 1.3, top: y0 + ph + 0.24 * s + R };
}
// an octagonal two-storey pavilion with arched niches on every face and a chhatri on the roof
function pavilion(s) {
  const g = new THREE.Group(), R = 1.25 * s, H1 = 1.1 * s, H2 = 0.9 * s;
  const lower = inked(chip(new THREE.CylinderGeometry(R, R * 1.03, H1, 8), 0.02 * s), RUIN_COL.red, 20); lower.position.y = H1 / 2; g.add(lower);
  const band = inked(new THREE.CylinderGeometry(R * 1.02, R * 1.02, 0.1 * s, 8), RUIN_COL.buff); band.position.y = H1 + 0.05 * s; g.add(band);
  const upper = inked(chip(new THREE.CylinderGeometry(R * 0.96, R * 0.98, H2, 8), 0.02 * s), RUIN_COL.red, 20); upper.position.y = H1 + 0.1 * s + H2 / 2; g.add(upper);
  const eave = inked(new THREE.CylinderGeometry(R * 1.18, R * 0.98, 0.14 * s, 8), RUIN_COL.deep); eave.position.y = H1 + 0.1 * s + H2 + 0.07 * s; g.add(eave);
  const apo = R * Math.cos(Math.PI / 8);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU + Math.PI / 8 + Math.PI / 2;
    for (const [y, hh, w] of [[0.08 * s, H1 * 0.78, R * 0.5], [H1 + 0.2 * s, H2 * 0.72, R * 0.42]]) {
      const v = archVoid(w, hh); v.position.set(Math.cos(a) * (apo * (y > H1 ? 0.96 : 1) + 0.008), y, Math.sin(a) * (apo * (y > H1 ? 0.96 : 1) + 0.008));
      v.rotation.y = -a + Math.PI / 2; g.add(v);
    }
  }
  const top = chhatri(s * 0.9, true); top.g.position.y = H1 + 0.1 * s + H2 + 0.14 * s; g.add(top.g);
  return { g, r: R * 1.15 };
}
// one tier of a fluted minaret: alternating round and angular flutes, carved bands, and a corbelled balcony on top
function minarGeo(r0, r1, h) {
  const geo = new THREE.CylinderGeometry(r1, r0, h, 96, 6, true), a = geo.attributes.position;
  for (let i = 0; i < a.count; i++) {
    const x = a.getX(i), z = a.getZ(i), th = Math.atan2(z, x), k = (th / TAU * 24 + 24) % 2;
    const flute = k < 1 ? Math.sin(k * Math.PI) * 0.09 : (1 - Math.abs(k - 1.5) * 2) * 0.07; // round, then pointed
    a.setX(i, x * (1 + flute)); a.setZ(i, z * (1 + flute));
  }
  geo.computeVertexNormals(); return geo;
}
function minarTier(r0, h, color) {
  const r1 = r0 * 0.86, g = new THREE.Group();
  const body = inked(minarGeo(r0, r1, h), color, 60); body.position.y = h / 2; g.add(body);
  for (const f of [0.3, 0.62]) {
    const rr = lerp(r0, r1, f) * 1.07, b = inked(new THREE.CylinderGeometry(rr, rr, h * 0.06, 32), RUIN_COL.buff, 40); b.position.y = h * f; g.add(b);
  }
  const corbel = inked(new THREE.CylinderGeometry(r1 * 1.45, r1 * 1.02, h * 0.16, 24), RUIN_COL.deep, 40); corbel.position.y = h + h * 0.08; g.add(corbel);
  const deck = inked(new THREE.CylinderGeometry(r1 * 1.48, r1 * 1.48, h * 0.04, 24), color, 40); deck.position.y = h + h * 0.18; g.add(deck);
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, p = inked(new THREE.BoxGeometry(r1 * 0.12, h * 0.08, r1 * 0.12), color); p.position.set(Math.cos(a) * r1 * 1.4, h * 0.24, Math.sin(a) * r1 * 1.4); g.add(p); }
  return { g, top: h * 1.2, r1 };
}
function placeRuin(obj, x, z, opts = {}) {
  const g = obj.g;
  const P = opts.parentRuin; // a tier is carried by the minaret it sits on
  g.position.set(P ? 0 : x, 0, P ? 0 : z); g.rotation.y = opts.yaw ?? rnd(0, TAU);
  if (opts.tilt !== false) { g.rotation.x = rnd(-0.06, 0.06); g.rotation.z = rnd(-0.06, 0.06); }
  (P ? P.g : scene).add(g);
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g), h = box.max.y - box.min.y;
  const r = { g, x, z, r: obj.r, h, t: 0, rise: opts.rise ?? h + 0.2, sink: opts.sink ?? rnd(0.02, 0.12) * h, kind: opts.kind, tiers: opts.tiers, topY: opts.topY, r1: opts.r1, base: opts.base ?? 0, parent: P || null };
  g.position.y = r.base - r.rise;
  ruins.push(r);
  if (ruins.filter(q => q.going == null && !q.parent).length > RUIN_CAP) { const old = ruins.find(q => q.going == null && !q.parent); if (old) old.going = 0; }
  return r;
}
// What rises where a creature dies is now one of four pictures, stood upright on the paper like the people:
// a carved marble finial, a three-arched arcade, a tree, a small clay house. (The modelled ruins above are no longer used.)
// Every building is now one part cut from two photographs: an arcade wall, a window bay, a little cupola, a kiosk,
// the top of a domed tomb, the two wings and the great doorway of a gateway, and a minaret. One sheet holds them all.
const PARTS_TEX = new THREE.TextureLoader().load("parts.webp"); PARTS_TEX.encoding = THREE.sRGBEncoding; PARTS_TEX.anisotropy = 4;
const sheet = f => { const t = new THREE.TextureLoader().load(f); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; };
const TREE_TEX = sheet("tree.webp"), OLD_TEX = sheet("build.webp"), RED_MINARET_TEX = sheet("minaret.webp"), OLD_TEX2 = sheet("build2.webp");
const BUILD = { // where each sits on the sheet: u, v, width, height, and its width-to-height
  tree: [0, 0, 1, 1, 0.696, 1], // the tree keeps a picture of its own
  // the earlier pictures, still on their own sheets: the ivory finial, the clay house, the coloured arcade, the red minaret,
  // the broken wall, the battlement and the ruined gateway
  finial: [0.10390625, 0.503125, 0.2921875, 0.49375, 0.592, 2], arcade: [0.503125, 0.503125, 0.49375, 0.3015625, 1.637, 2],
  house: [0.5046875, 0.003125, 0.48984375, 0.49375, 0.992, 2],
  minaret: [0.08203125, 0, 0.83203125, 1, 0.208, 3],
  ruin: [0.00313, 0.50313, 0.49375, 0.26484, 1.864, 4], rampart: [0.50313, 0.50313, 0.49375, 0.41328, 1.195, 4], gate: [0.03672, 0.00313, 0.42656, 0.49375, 0.864, 4],
  domeTop: [0.0, 0.57227, 0.26904, 0.42773, 1.258],
  tower: [0.27197, 0.61133, 0.04346, 0.38867, 0.224],
  iwan: [0.31836, 0.61426, 0.16406, 0.38574, 0.851],
  wingL: [0.48535, 0.6875, 0.10205, 0.3125, 0.653],
  wingR: [0.59033, 0.69336, 0.12354, 0.30664, 0.806],
  arcadeWall: [0.0, 0.26758, 0.2915, 0.29883, 1.951],
  bay: [0.29443, 0.26758, 0.0835, 0.29883, 0.559],
  kiosk: [0.38086, 0.29492, 0.0752, 0.27148, 0.554],
  cupola: [0.45898, 0.49512, 0.04883, 0.07129, 1.37],
};
function picture(kind, height) {
  const [u, v, w, hh, asp, own] = BUILD[kind], wide = height * asp;
  const geo = new THREE.PlaneGeometry(wide, height); geo.translate(0, height / 2, 0);
  const uv = geo.attributes.uv; uv.setXY(0, u, v + hh); uv.setXY(1, u + w, v + hh); uv.setXY(2, u, v); uv.setXY(3, u + w, v);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: [PARTS_TEX, TREE_TEX, OLD_TEX, RED_MINARET_TEX, OLD_TEX2][own || 0], alphaTest: 0.5, side: THREE.DoubleSide }));
  const g = new THREE.Group(); g.add(m);
  return { g, r: Math.min(wide * 0.3, kind === "tower" || kind === "tree" || kind === "minaret" ? 0.5 : 2) };
}
// Buildings keep their distance. If the place a creature fell is too close to one already standing, the new one
// rises at the most open spot a short way off instead, so they spread over the page and don't pile up.
function openSpot(x, z, gap, tall = 3, wide = 3) {
  const clear = (px, pz) => { let m = 1e9; for (const r of ruins) if (!r.parent && r.going == null) m = Math.min(m, Math.hypot(r.x - px, r.z - pz) - r.r); return m; };
  // it must fit on the visible page: room above for its height (heights are drawn up the page) and at the sides for its width
  const B = BOUNDS, side = Math.min(wide / 2 + 0.4, (B.x1 - B.x0) / 2 - 0.5), top = Math.min(B.z0 + Math.max(3, tall - 2), B.z1 - 2);
  const inX = v => Math.max(B.x0 + side, Math.min(B.x1 - side, v)), inZ = v => Math.max(top, Math.min(B.z1 - 1, v));
  x = inX(x); z = inZ(z);
  if (clear(x, z) >= gap) return [x, z];
  let best = [x, z], bc = clear(x, z);
  for (let i = 0; i < 40; i++) {
    const a = rnd(0, TAU), d = gap * (0.6 + 2.4 * (i / 40)), px = inX(x + Math.cos(a) * d), pz = inZ(z + Math.sin(a) * d * 1.3), cl = clear(px, pz);
    if (cl >= gap) return [px, pz];
    if (cl > bc) { bc = cl; best = [px, pz]; }
  }
  return best;
}
function leaveRuin(c) {
  const s = Math.max(0.35, c.p.bulk * c.grow);
  let kind, height;
  const roll = (odds) => { let k = Math.random(); for (const [name, p] of odds) { if ((k -= p) < 0) return name; } return odds[0][0]; };
  const B = CFG.buildings, odds = Object.entries(c.large ? B.fromLarge : B.fromSmall).filter(([k, p]) => BUILD[k] && p > 0), sum = odds.reduce((a, [, p]) => a + p, 0) || 1;
  kind = roll(odds.length ? odds.map(([k, p]) => [k, p / sum]) : [["kiosk", 1]]); // the odds needn't add up to 1: they are shares
  height = rnd(...((c.large ? B.heightLarge : B.heightSmall)[kind] || [3, 4])) * (kind === "cupola" || kind === "finial" ? 0.6 + 0.4 * s : 1);
  const pic = picture(kind, height), [px, pz] = openSpot(c.x, c.z, pic.r + (c.large ? CFG.buildings.gapLarge : CFG.buildings.gapSmall), height, height * BUILD[kind][4]);
  placeRuin(pic, px, pz, { yaw: 0, tilt: false, sink: 0, kind });
  remarkOnBuilding(kind, px, pz);
}
// keep things from walking through a ruin
function pushOutOfRuins(o, pad) {
  for (const r of ruins) {
    if (r.parent || r.going != null) continue;
    const dx = o.x - r.x, dz = o.z - r.z, d = Math.hypot(dx, dz) || 1e-3, R = r.r + pad;
    if (d < R) { o.x = r.x + dx / d * R; o.z = r.z + dz / d * R; }
  }
}
function leaveSheet(c) {
  tileFromDeath(c); return; // a dying creature leaves no building and nothing else: on the green it lays a tile, and a person steps out of it (transitions.js, 4b)
  const sz = (1.5 * c.p.bulk + 0.7) * c.grow;
  const mat = new THREE.MeshStandardMaterial({ color: c.color, map: c.mat.map, side: THREE.DoubleSide, transparent: true });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz), mat);
  sheet.rotation.set(-Math.PI / 2, 0, rnd(0, 6.28)); sheet.position.set(c.x, 0.02, c.z); sheet.receiveShadow = true;
  const hh = sz / 2, pts = [-hh, -hh, hh, hh, -hh, hh, hh, -hh, 0, -hh, 0, hh, -hh, 0, hh, 0];
  for (let i = 0; i < 4; i++) { const a = rnd(0, 6.28), o = rnd(-hh * 0.6, hh * 0.6); pts.push(-hh, o + Math.sin(a) * hh * 0.4, hh, o - Math.sin(a) * hh * 0.4); }
  const lp = []; for (let i = 0; i < pts.length; i += 2) lp.push(pts[i], pts[i + 1], 0.003);
  const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(lp, 3));
  const lineMat = new THREE.LineBasicMaterial({ opacity: 0.8 });
  sheet.add(new THREE.LineSegments(lg, lineMat));
  scene.add(sheet);
  scraps.push({ sheet, mat, lineMat, t: 0 });
  leaveRuin(c);
  rumble();
}
function rumble() { // stone grinding up through sand
  const A = audio(); if (!A) return; const t = A.currentTime + 0.1;
  const src = A.createBufferSource(); src.buffer = noiseBuf;
  const f = A.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 160;
  const g = A.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.25); g.gain.linearRampToValueAtTime(0, t + 1.3);
  src.connect(f).connect(g).connect(A.destination); src.start(t); src.stop(t + 1.4);
}
function disposeRuin(r) {
  scene.remove(r.g);
  (r.parent ? r.parent.g : scene).remove(r.g);
  r.g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== outlineMat && o.material !== voidMat && o.material !== edgeMat) o.material.dispose(); });
}
function updateStains(dt) {
  // ruins rise out of the sand, settle a little low, and (past the cap) the oldest sink away again
  for (let i = ruins.length - 1; i >= 0; i--) {
    const r = ruins[i];
    if (r.going != null) {
      r.going += dt / 2.5; r.g.position.y = r.base - r.sink - r.going * (r.h + 0.3);
      if (r.going >= 1) { disposeRuin(r); ruins.splice(i, 1); for (let k = ruins.length - 1; k >= 0; k--) if (ruins[k].parent === r) ruins.splice(k, 1); i = Math.min(i, ruins.length); }
      continue;
    }
    if (r.t < 1) {
      r.t = Math.min(1, r.t + dt / 1.3);
      const e = 1 - Math.pow(1 - r.t, 3);
      r.g.position.y = r.base - r.sink - r.rise * (1 - e) + (r.parent ? 0 : Math.sin(r.t * 30) * 0.02 * (1 - r.t));
    }
  }
  for (let i = scraps.length - 1; i >= 0; i--) {
    const s = scraps[i]; s.t += dt;
    const o = Math.max(0, Math.min(1, (5 - s.t) / 2));
    s.mat.opacity = o; s.lineMat.opacity = 0.8 * o;
    if (s.t > 5) { scene.remove(s.sheet); s.sheet.traverse(x => x.geometry && x.geometry.dispose()); s.mat.dispose(); s.lineMat.dispose(); scraps.splice(i, 1); }
  }
}
function clearStains() {
  for (const r of ruins) if (!r.parent) disposeRuin(r);
  ruins.length = 0;
  for (const s of scraps) { scene.remove(s.sheet); s.sheet.traverse(x => x.geometry && x.geometry.dispose()); s.mat.dispose(); s.lineMat.dispose(); }
  scraps.length = 0;
}


function stepCreature(c, dt) {
  const p = c.p;
  let paused = false, yOff = 0;
  // death: it crumples, then leaves its unfolded sheet and a patch of its map pasted into the grid
  if (c.dying) {
    c.dying.t += dt;
    if (c.dying.t > 1.3) { leaveSheet(c); removeCreature(c); return; }
    pose(c, true, dt); return;
  }
  c.grace -= dt;
  if (!c.cocoon && !c.forming && !c.launch && c.leaving == null) { c.age += dt; c.energy = Math.max(0, c.energy - dt * 0.6); }
  // old age: the paper yellows and the creases darken
  const life = c.age / c.life;
  c.elderT = life > 0.8 ? Math.min(1, (life - 0.8) / 0.2) : 0;
  c.mat.color.setRGB(lerp(0.96, 0.74, c.elderT), lerp(0.95, 0.69, c.elderT), lerp(0.93, 0.6, c.elderT)); c.mat2.color.copy(c.mat.color);
  c.lineMat.opacity = 0.4 + 0.35 * c.elderT;
  if (c.age > c.life) { startDeath(c); pose(c, true, dt); return; }
  if (c.forming || c.cocoon) paused = true;
  else if (c.leaving != null) { // folds itself away
    c.leaving -= dt / 0.9; c.k = Math.max(0.02, c.leaving);
    if (c.leaving <= 0) { removeCreature(c); return; }
    paused = true;
  } else if (c.launch) { // thrown out of the division, unfolding in the air
    const L = c.launch; L.t += dt / L.dur; const t = Math.min(1, L.t);
    c.x = L.fx + (L.tx - L.fx) * t; c.z = L.fz + (L.tz - L.fz) * t;
    yOff = 4 * L.h * t * (1 - t) + (L.y0 || 0) * (1 - smooth(t)); c.k = Math.max(0.05, smooth(t)); paused = true; // y0: it set off from up on a building's face
    if (L.t >= 1) { c.launch = null; c.k = 1; c.pop = 1; }
  } else {
    c.k = Math.min(1, c.k + dt * 2);
    c.walkT += dt;
    // wander, keep off the cells, stay on the part of the paper you can see
    c.wand += (Math.random() - 0.5) * dt * 3;
    let dx = Math.sin(c.wand), dz = Math.cos(c.wand);
    for (const o of cells) {
      const ox = c.x - o.x, oz = c.z - o.z, d = Math.hypot(ox, oz) || 1e-3, near = o.R * 1.25 + 1;
      if (d < near) { const w = (near - d) * 1.5 / d; dx += ox * w; dz += oz * w; }
    }
    // the birds make for the tallest building within reach and wheel round it
    c.circling = null;
    if (p.form === "floater") {
      let best = null, bh = CFG.creatures.birdsCircleAboveHeight;
      for (const r of ruins) {
        if (r.parent || r.going != null || r.t < 1) continue;
        const hgt = Math.max(r.h || 0, r.topY || 0);
        if (hgt > bh && Math.hypot(r.x - c.x, r.z - c.z) < 40) { bh = hgt; best = r; }
      }
      if (best) {
        const rx = c.x - best.x, rz = c.z - best.z, d = Math.hypot(rx, rz) || 1e-3, ring = best.r + 1.8;
        const turn = c.id % 2 ? 1 : -1, pull = Math.max(-1.5, Math.min(1.5, (ring - d) * 0.9));
        dx = (-rz / d) * turn + (rx / d) * pull + dx * 0.15; dz = (rx / d) * turn + (rz / d) * pull + dz * 0.15;
        c.circling = best; c.circleH = bh;
      }
    }
    const m = 1.2, b = BOUNDS;
    if (c.x < b.x0 + m) dx += (b.x0 + m - c.x); if (c.x > b.x1 - m) dx -= (c.x - b.x1 + m);
    if (c.z < b.z0 + m) dz += (b.z0 + m - c.z); if (c.z > b.z1 - m) dz -= (c.z - b.z1 + m);
    const want = Math.atan2(dx, dz), yaw0 = c.yaw;
    if (TURN[p.form]) c.yaw += angleTo(want, c.yaw) * Math.min(1, dt * TURN[p.form]);
    const v = p.speed * PACE[p.form] * 0.75 * (0.85 + 0.15 * Math.sin(c.walkT * p.gait * 0.5)) * (c.circling ? CFG.creatures.birdCirclingSpeed : p.form === "floater" ? CFG.creatures.birdSpeed : 1); // birds fly, and fly faster round a building
    const px = c.x, pz = c.z;
    if (p.form === "hopper") {
      const h = c.hop; h.t += dt;
      if (h.air) {
        c.x += Math.sin(c.yaw) * h.dist / h.dur * dt; c.z += Math.cos(c.yaw) * h.dist / h.dur * dt;
        if (h.t >= h.dur) { h.air = false; h.t = 0; h.rest = rnd(0.3, 1) * 1.6 / p.speed; }
      } else {
        c.yaw += angleTo(want, c.yaw) * Math.min(1, dt * 4);
        if (h.t >= h.rest) { h.air = true; h.t = 0; h.dur = lerp(0.4, 0.65, p.stride); h.dist = lerp(1.2, 2.6, p.stride) * p.bulk * 0.8; }
      }
    } else if (p.form === "crawler") {
      c.moveDir = c.yaw + Math.sin(c.walkT * p.gait * 0.7) * lerp(0.25, 0.7, p.stride);
      c.x += Math.sin(c.moveDir) * v * dt; c.z += Math.cos(c.moveDir) * v * dt;
    } else { c.x += Math.sin(c.yaw) * v * dt; c.z += Math.cos(c.yaw) * v * dt; }
    if (p.form === "roller") c.rollA += Math.hypot(c.x - px, c.z - pz) / c.rollR;
    c.turnV = (c.yaw - yaw0) / Math.max(dt, 1e-3);
  }
  // the cells shoulder the brood out of their way
  for (const o of cells) {
    const ox = c.x - o.x, oz = c.z - o.z, d = Math.hypot(ox, oz) || 1e-3, r = o.R * 1.05 + 0.35;
    if (d < r && !c.launch && !c.forming && !o.fusing) { c.x = o.x + ox / d * r; c.z = o.z + oz / d * r; }
  }
  if (!c.launch && !c.forming) pushOutOfRuins(c, 0.3 * c.grow);
  if (p.form === "crawler" && (c.trail.length === 0 || Math.hypot(c.x - c.trail[0].x, c.z - c.trail[0].z) > 0.03)) {
    c.trail.unshift({ x: c.x, z: c.z }); if (c.trail.length > 260) c.trail.pop();
  }
  pose(c, paused, dt);
  if (yOff) { // carry the whole pose up into the air, legs and all
    c.body.position.y += yOff;
    for (const L of c.legs) for (const m of [L.thigh, L.shin]) m.matrix.elements[13] += yOff;
    if (c.segs) for (const s of c.segs) s.position.y += yOff;
  }
}

// ---------- touch ----------
const pointers = new Map();
const pick3 = (cx, cy, objs) => { ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); aimRay(ndc.x, ndc.y); return ray.intersectObjects(objs, true)[0]; };
cv.addEventListener("pointerdown", ev => {
  ev.preventDefault(); audio();
  try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
  const rec = { x: ev.clientX, y: ev.clientY, cell: null };
  const hit = pick3(ev.clientX, ev.clientY, [...cells.filter(o => o.held == null && !o.fusing).flatMap(o => o.orb ? [o.disc] : o.figs.filter(m => m.visible)), ...creatures.map(c => c.body), ...ruins.filter(r => r.crackable && r.going == null).map(r => r.g)]);
  if (hit) {
    let o = hit.object; while (o && !o.userData.cell && !o.userData.creature) o = o.parent;
    if (o == null && hit.object.userData.ruin) { crackBuilding(hit.object.userData.ruin, hit.point); pointers.set(ev.pointerId, rec); return; } // a tap cracks a building open
    if (o && o.userData.cell && !o.userData.cell.orb) popPerson(o.userData.cell); // people aren't squeezed: a touch pops them
    else if (o && o.userData.cell) { const cell = o.userData.cell; cell.held = ev.pointerId; rec.cell = cell; squeezeStart(cell); buzz(8); }
    else if (o && o.userData.creature) { const c = o.userData.creature; if (!c.launch && c.leaving == null && !c.meeting && !c.dying) { c.launch = { t: 0, dur: 0.5, fx: c.x, fz: c.z, tx: c.x, tz: c.z, h: 1.4 }; rustle(0); } }
  }
  pointers.set(ev.pointerId, rec);
});
cv.addEventListener("pointermove", ev => { const r = pointers.get(ev.pointerId); if (r) { r.x = ev.clientX; r.y = ev.clientY; } });
function release(id) {
  const r = pointers.get(id); pointers.delete(id);
  if (!r || !r.cell) return;
  const o = r.cell; o.held = null; squeezeStop(o);
  if (!cells.includes(o)) return;
  if (o.p >= 1.75) divide(o);
  else { o.svx += 3 * o.p + 1; o.svy -= 3 * o.p + 1; }
}
cv.addEventListener("pointerup", ev => release(ev.pointerId));
cv.addEventListener("pointercancel", ev => release(ev.pointerId));
cv.addEventListener("contextmenu", ev => ev.preventDefault());
let keyCell = null;
cv.addEventListener("keydown", ev => {
  if ((ev.key === " " || ev.key === "Enter") && !keyCell && !ev.repeat) {
    ev.preventDefault(); audio();
    keyCell = cells.filter(o => o.held == null && !o.fusing && o.orb)[0] || null;
    if (!keyCell) { const p = cells.filter(o => !o.fusing && !o.orb)[0]; if (p) popPerson(p); }
    if (keyCell) { keyCell.held = "key"; pointers.set("key", { cell: keyCell }); squeezeStart(keyCell); }
  }
});
cv.addEventListener("keyup", ev => { if ((ev.key === " " || ev.key === "Enter") && keyCell) { keyCell = null; release("key"); } });

// ---------- the map: the tissue has become a map of Delhi. A square is cut from it, folds up into a creature that walks
// off, and the map slides away, leaving the green painted paper ----------
const MAP_STAGES = ["map", "cut", "lift", "slide"];
const DELHI_TEX = new THREE.TextureLoader().load("delhi.jpg"); DELHI_TEX.encoding = THREE.sRGBEncoding; DELHI_TEX.anisotropy = 4;
let mapBeast = null;
function makeMapBeast(sx, sy, sizePx) {
  // a walker folded from the map itself, standing where the square was cut
  const ndcX = sx / innerWidth * 2 - 1, ndcY = -(sy / innerHeight * 2 - 1), p = floorAt(ndcX, ndcY) || new THREE.Vector3();
  const g = randomGenome(); g[G.form] = 0.1; g[G.legs] = rnd(0.55, 0.95); g[G.wings] = rnd(0.5, 1); g[G.neck] = rnd(0.4, 0.8); g[G.crumple] = rnd(0.2, 0.45);
  const c = { id: 7777, genome: g, age: 0, walkT: 0, k: 0.01, x: p.x, z: p.z, yaw: Math.PI / 2, moveDir: Math.PI / 2, turnV: 0, bank: 0, lunge: 0, shake: 0,
    dying: null, elderT: 0, grow: 1, pop: 0, alt: null, leaving: null, launch: null, wand: 0, hop: { air: false, t: 0, rest: 0.5, dur: 0.5, dist: 0 }, rollA: 0, trail: [], trailD: 0, uvOff: [0.2, 0.3] };
  buildBody(c);
  for (const m of [c.mat, c.mat2]) { m.map = DELHI_TEX; m.needsUpdate = true; }
  c.kTo = sizePx * (2 * camHH / FR.h) / (c.p.bulk * 2.1); // as wide as the square it was cut from
  return c;
}
function updateMapStage(dt) {
  const u = microMat.uniforms, t = micro.t, R = Math.min(FR.w, FR.h);
  u.mode.value = 2; u.k.value = 1; u.tissueA.value = 1; u.bgA.value = 1;
  if (micro.phase === "map") {
    u.cutP.value = 0; u.hole.value = 0; u.lift.value = 0; u.mapOff.value = 0;
    micro.cut = { x: FR.x + FR.w * rnd(0.42, 0.58), y: FR.y + FR.h * rnd(0.5, 0.62), r: R * 0.17, a: rnd(-0.35, 0.35) };
    if (t > (reduced ? 0.3 : 1.1)) { micro.phase = "cut"; micro.t = 0; }
  } else if (micro.phase === "cut") {
    const T = reduced ? 0.6 : 2; u.cutP.value = ease(Math.min(1, t / T));
    if (t > T + 0.25) { micro.phase = "lift"; micro.t = 0; u.hole.value = 1; mapBeast = makeMapBeast(micro.cut.x, micro.cut.y, micro.cut.r * 2); rustle(); buzz(10); }
  } else if (micro.phase === "lift") {
    const T = reduced ? 0.6 : 1.7, s2 = Math.min(1, t / T); u.lift.value = s2;
    if (mapBeast) mapBeast.k = Math.max(0.01, mapBeast.kTo * smooth((s2 - 0.3) / 0.7));
    if (t > T) { micro.phase = "slide"; micro.t = 0; }
  } else if (micro.phase === "slide") {
    const T = reduced ? 0.6 : 1.6; u.lift.value = 1; u.mapOff.value = ease(Math.min(1, t / T)) * FR.h * 1.08;
    if (t > T) { micro.phase = "done"; FR.kind = "arch"; showArch(); enterWait = 1.9; }
  }
  u.cutC.value.set(micro.cut.x, micro.cut.y); u.cutR.value = micro.cut.r; u.cutA.value = micro.cut.a;
}
// the map creature walks off to the right, out of the frame, and is gone
function updateMapBeast(dt) {
  const c = mapBeast; if (!c) return;
  if (micro.phase === "slide" || micro.phase === "done") { c.walkT += dt; c.x += dt * c.k * c.p.speed * 0.9; }
  pose(c, micro.phase === "lift", dt);
  const [sx] = toScreen(new THREE.Vector3(c.x - c.p.bulk * 2 * c.k, 0, c.z));
  if (sx > FR.x + FR.w + 20) { destroyBody(c); mapBeast = null; }
}
// the top of the page: a blue and gold floral border with a pointed arch cut in it, which slides down into the frame
const FLORAL = new Image(); FLORAL.src = "floral.jpg";
function showArch() {
  const t = frameTarget("arch"), d = Math.min(2, devicePixelRatio || 1), W = Math.round(t.w * d), H = Math.round(t.h * d);
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const x = cv.getContext("2d");
  if (FLORAL.complete && FLORAL.naturalWidth) {
    const bw = W, bh = W * FLORAL.naturalHeight / FLORAL.naturalWidth;
    for (let y = 0, i = 0; y < H * 0.5; y += bh, i++) { x.save(); if (i % 2) { x.translate(0, y + bh); x.scale(1, -1); x.drawImage(FLORAL, 0, 0, bw, bh); } else x.drawImage(FLORAL, 0, y, bw, bh); x.restore(); }
  } else { x.fillStyle = "#1f2f55"; x.fillRect(0, 0, W, H * 0.5); }
  x.globalCompositeOperation = "destination-out";
  x.beginPath(); x.moveTo(-2, H * 0.36);
  x.bezierCurveTo(W * 0.03, H * 0.24, W * 0.27, H * 0.2, W * 0.5, H * 0.09);
  x.bezierCurveTo(W * 0.73, H * 0.2, W * 0.97, H * 0.24, W + 2, H * 0.36);
  x.lineTo(W + 2, H + 2); x.lineTo(-2, H + 2); x.closePath(); x.fill();
  archEl.style.backgroundImage = `url(${cv.toDataURL("image/png")})`;
  requestAnimationFrame(() => archEl.classList.add("in"));
}
let enterWait = 0.7, walkedIn = 0;
function walkIn() {
  const b = BOUNDS, first = walkedIn === 0, R = CFG.people.firstSize;
  const z = first ? arrival.zP : (b.z0 + b.z1) / 2 + rnd(-1.5, 1.5);
  const o = makeCell(b.x0 - R * 1.6, z, R, Math.floor(rnd(0, MAPS.length)));
  o.walking = true; o.wand = 0; o.walkT = rnd(3.2, 4.2); o.vx = R * 2.4; o.dir = 1; enterWait = 1.5;
  if (first) { o.arriving = true; o.walkT = 1e9; o.hi = true; arrival.person = o; arrival.stage = "walk"; arrival.t = 0; } // keeps walking until the middle
  walkedIn++;
}
// ---------- the arrival: a close view, a line drawn, then the pull-back ----------
// The paper is first seen from very close, so close that one ordinary person, walking in from the left, nearly fills
// the screen. When he reaches the middle, a meandering line is drawn down the paper from top to bottom (it will
// become a stream). Once it is drawn, tapping him pulls the camera back until he is an ordinary size on the page,
// and the line is seen running on, far past where the screen first ended.
const arrival = { stage: "off", t: 0, person: null, z0: 1, cz0: 0, zP: 0.4, stream: null };
function frameArrival() {
  // camera for the close view: he fills `firstWalkerFills` of the screen's height, feet near the bottom, centred
  const R = CFG.people.firstSize;
  introCX = 0; introCZ = 0; introZoom = 1; fitCamera();
  const span1 = BOUNDS.z1 - BOUNDS.z0;
  arrival.z0 = Math.max(0.03, Math.min(1, FIG_H * R / (Math.min(CFG.people.firstWalkerFills, 0.7) * span1))); // head below the arch, as in the painting
  introZoom = arrival.z0; fitCamera();
  const hh = camHH, cz = -0.12 * hh, spanS = 1.58 * hh;
  introCZ = arrival.zP + 0.05 * spanS - (cz + 0.78 * hh); arrival.cz0 = introCZ; fitCamera();
  arrival.stage = "waiting"; arrival.t = 0;
}
// the rupture: the paper tears from top to bottom and the tear is water, painted blue. It is a ribbon on the paper that
// opens down the page as it is drawn, with torn, uneven edges, and widens into a river as the view pulls back
const WATER_TEX = new THREE.TextureLoader().load("water.jpg"); WATER_TEX.wrapS = WATER_TEX.wrapT = THREE.MirroredRepeatWrapping;
const streamMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide,
  uniforms: { drawn: { value: 0 }, wid: { value: 1 }, water: { value: WATER_TEX } },
  vertexShader: `attribute float s; attribute float side; attribute float along; attribute float wv; attribute vec2 nrm; uniform float wid;
    varying float vS; varying float vSide; varying float vAlong;
    void main(){ vS = s; vSide = side; vAlong = along; vec3 p = position; p.xz += nrm * side * wid * 0.5 * wv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
  fragmentShader: `uniform float drawn, wid; uniform sampler2D water; varying float vS; varying float vSide; varying float vAlong;
    float hash(float n){ return fract(sin(n * 127.1) * 43758.5453); }
    float vn(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(hash(i), hash(i + 1.0), f); }
    void main(){
      if (vS > drawn) discard;
      float k = vAlong / max(wid, 0.001), sd = vSide > 0.0 ? 3.7 : 11.3;
      float tip = clamp((drawn - vS) * 14.0, 0.0, 1.0);                       // the tear narrows to a point where it is still running
      float e = abs(vSide) / max(tip, 0.02) + (vn(k * 1.7 + sd) - 0.5) * 0.28 + (vn(k * 9.0 + sd) - 0.5) * 0.08;
      float a = 1.0 - smoothstep(0.84, 0.9, e);
      if (a <= 0.0) discard;
      vec3 c = texture2D(water, vec2(vSide * 0.5 + 0.5, k * 0.25)).rgb;
      c = mix(c, vec3(0.93, 0.92, 0.86), (1.0 - smoothstep(0.76, 0.86, e)) * smoothstep(0.7, 0.84, e) * 0.35); // a pale torn fibre at the edge
      gl_FragColor = vec4(c, a);
    }`,
});
function buildStream() {
  if (arrival.stream) { scene.remove(arrival.stream); arrival.stream.geometry.dispose(); }
  const hh = camHH, hw = camHW, centreZ = -0.12 * hh + introCZ, zTop = centreZ - hh * 0.95, zBot = centreZ + hh * 0.8, ph = [rnd(0, TAU), rnd(0, TAU), rnd(0, TAU), rnd(0, TAU)], span = 2 * hh;
  // it leans gently across the close view, and runs on in long slow curves across the whole page beyond it
  const xAt = z => hw * (0.08 * Math.sin(z / span * 5.2 + ph[0]) + 0.03 * Math.sin(z / span * 14 + ph[1])) + 3.2 * Math.sin(z * 0.055 + ph[2]) + 1.4 * Math.sin(z * 0.13 + ph[3]) - 3.2 * Math.sin(arrival.zP * 0.055 + ph[2]) - 1.4 * Math.sin(arrival.zP * 0.13 + ph[3]) - hw * (0.08 * Math.sin(arrival.zP / span * 5.2 + ph[0]) + 0.03 * Math.sin(arrival.zP / span * 14 + ph[1]));
  const pts = [], step = Math.min(0.08, span / 160);
  for (let z = -90; z <= 90; z += z > zTop - 1 && z < zBot + 1 ? step : 0.25) pts.push([xAt(z), z]);
  const pos = [], ss = [], side = [], idx = [], nrm = [], along = [], wv = []; let L = 0;
  pts.forEach(([x, z], i) => {
    const [x0, z0] = pts[Math.max(0, i - 1)], [x1, z1] = pts[Math.min(pts.length - 1, i + 1)], tx = x1 - x0, tz = z1 - z0, tl = Math.hypot(tx, tz) || 1;
    if (i) L += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
    const nx = -tz / tl, nz = tx / tl, w = 0.8 + 0.4 * vnoise1(z * 0.9);
    const s = Math.max(0, Math.min(1, (z - zTop) / (zBot - zTop)));
    pos.push(x, 0.011, z, x, 0.011, z); nrm.push(nx, nz, nx, nz); ss.push(s, s); side.push(1, -1); along.push(L, L); wv.push(w, w);
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("s", new THREE.Float32BufferAttribute(ss, 1)); g.setAttribute("side", new THREE.Float32BufferAttribute(side, 1));
  g.setAttribute("nrm", new THREE.Float32BufferAttribute(nrm, 2)); g.setAttribute("along", new THREE.Float32BufferAttribute(along, 1)); g.setAttribute("wv", new THREE.Float32BufferAttribute(wv, 1)); g.setIndex(idx);
  arrival.stream = new THREE.Mesh(g, streamMat); arrival.stream.renderOrder = 1; arrival.stream.frustumCulled = false; scene.add(arrival.stream);
  streamMat.uniforms.drawn.value = 0; streamMat.uniforms.wid.value = 0.2 * hw;
}
const vnoise1 = x => { const i = Math.floor(x), f = x - i, h = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }; const u = f * f * (3 - 2 * f); return h(i) * (1 - u) + h(i + 1) * u; };
// the green page has buildings on it already: a great doorway beside where the person will stop, a minaret off to the left
const archRuins = [];
function placeArchitecture() {
  const h = FIG_H * CFG.people.firstSize, z = arrival.zP;
  for (const [kind, hk, xk, dz] of [["iwan", 0.95, 0.56, 0.3], ["minaret", 1.1, -0.66, 0.9]]) {
    if (!BUILD[kind]) continue;
    const pic = picture(kind, h * hk);
    placeRuin(pic, camHW * xk, z - pic.r - dz, { yaw: 0, tilt: false, sink: 0, kind });
    archRuins.push(ruins[ruins.length - 1]);
  }
}
function updateArrival(dt) {
  if (arrival.stage === "off" || arrival.stage === "free") return;
  arrival.t += dt;
  const o = arrival.person;
  if (arrival.stage === "walk" && o && !o.walking) { arrival.stage = "ready"; arrival.t = 0; hint("tap him"); }
  if (arrival.stage === "pull") {
    const T = reduced ? 1 : 3.6, e = ease(Math.min(1, arrival.t / T));
    introZoom = Math.exp(Math.log(arrival.z0) * (1 - e)); introCZ = arrival.cz0 * (1 - e); introCX = 0; fitCamera();
    if (o && cells.includes(o) && e > 0.45) o.hi = false;
    if (arrival.t >= T) {
      arrival.stage = "free"; introZoom = 1; introCZ = introCX = 0; fitCamera();
      if (o && cells.includes(o)) { o.hi = false; o.arriving = false; o.walkT = rnd(1, 3); }
      hint("tap a person to pop them in two");
    }
  }
}
function arrivalTap(o) { // a tap on the person while the arrival is under way steps the view back to the whole page
  if (arrival.stage === "ready" && o === arrival.person) { hint(""); arrival.stage = "pull"; arrival.t = 0; audio(); }
  return arrival.stage !== "free" && arrival.stage !== "off";
}

// ---------- every frame: the people, the creatures and the world (called from main.js) ----------
function updateEnvironment(dt) {
  for (const o of [...cells]) {
    o.age += dt;
    if (o.held != null) {
      o.p = Math.min(2, o.p + dt / 0.65);
      if (o.p >= 1 && !o.crossed) { o.crossed = true; buzz(12); }
      if (o.p >= 2 && (o.wait += dt) > 1.4) { for (const [id, r] of pointers) if (r.cell === o) pointers.delete(id); o.held = null; divide(o); continue; }
      squeezeUpdate(o);
    } else { o.p = Math.max(0, o.p - dt * 3.5); o.crossed = false; o.wait = 0; }
    o.svx += (-(o.sx - 1) * 170 - o.svx * 8) * dt; o.sx += o.svx * dt;
    o.svy += (-(o.sy - 1) * 170 - o.svy * 8) * dt; o.sy += o.svy * dt;
    o.vx *= Math.exp(-dt * 3); o.vz *= Math.exp(-dt * 3);
    if (o.fusing) continue;
    // they stroll about, mostly side to side, and stop now and then
    if (o.arriving && o.walking && o.x > -o.R * 0.55) { o.walking = false; o.walkT = 1e9; o.arriving = false; } // the first one stops in the middle and waits
    if ((o.walkT -= dt) < 0) { o.walking = !o.walking; o.walkT = o.walking ? rnd(2, 6) : rnd(0.8, 3); o.wand = o.giant ? (Math.random() < 0.5 ? 0 : Math.PI) : rnd(0, TAU); } // any direction, so they don't all keep to one line
    // once there are four of them, each walks toward its three nearest neighbours, and the four gather
    const others = o.orb ? [] : cells.filter(k => k !== o && !k.orb && !k.fusing);
    if (others.length >= Math.max(2, FUSE_N - 1) && o.held == null && o.p < 0.01) {
      const near = others.sort((a, b) => Math.hypot(a.x - o.x, a.z - o.z) - Math.hypot(b.x - o.x, b.z - o.z)).slice(0, Math.max(2, FUSE_N - 1));
      const gx = near.reduce((s, k) => s + k.x, 0) / near.length - o.x, gz = near.reduce((s, k) => s + k.z, 0) / near.length - o.z, gd = Math.hypot(gx, gz);
      if (gd > o.R * 0.5) { o.vx += gx / gd * CFG.people.gatherPull * o.R * dt; o.vz += gz / gd * CFG.people.gatherPull * o.R * dt; }
    } else if (o.walking && !o.orb && o.held == null && o.p < 0.01) { o.vx += Math.cos(o.wand) * CFG.people.stroll * o.R * dt; o.vz += Math.sin(o.wand) * CFG.people.stroll * o.R * dt; }
    if (o.held == null) { o.x += o.vx * dt; o.z += o.vz * dt; pushOutOfRuins(o, o.R * 0.6); }
    const b = BOUNDS, m = o.giant ? Math.min(o.R * 0.9, (b.x1 - b.x0) * 0.3) : o.R * 0.9;
    if (!microOn() && !o.arriving && arrival.stage !== "draw" && arrival.stage !== "ready" && arrival.stage !== "pull") {
    if (o.x < b.x0 + m) o.vx += (b.x0 + m - o.x) * 14 * dt; if (o.x > b.x1 - m) o.vx -= (o.x - b.x1 + m) * 14 * dt;
    if (!o.giant) { if (o.z < b.z0 + m) o.vz += (b.z0 + m - o.z) * 14 * dt; if (o.z > b.z1 - m) o.vz -= (o.z - b.z1 + m) * 14 * dt; }
    }
  }
  for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) {
    const a = cells[i], c = cells[j]; if (a.fusing || c.fusing) continue;
    const dx = c.x - a.x, dz = c.z - a.z, d = Math.hypot(dx, dz) || 0.01, min = (a.R + c.R) * 1.08;
    if (d < min) { const f = (min - d) * 10 * dt / d; if (a.held == null) { a.vx -= dx * f; a.vz -= dz * f; } if (c.held == null) { c.vx += dx * f; c.vz += dz * f; } }
    // with a few cells about, they are drawn to each other and start to clump
    else if (cells.length >= FUSE_N && d < (a.R + c.R) * 3.2) {
      const f = 1.8 * dt / d; if (a.held == null) { a.vx += dx * f; a.vz += dz * f; } if (c.held == null) { c.vx -= dx * f; c.vz -= dz * f; }
    }
  }
  for (const c of creatures) if (c.large && !c.forming) for (const o of cells) {
    if (o.fusing) continue;
    const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz) || 0.01, r = o.R + 1.4 * c.p.bulk;
    if (d < r) { o.vx += dx / d * (r - d) * 6 * dt; o.vz += dz / d * (r - d) * 6 * dt; }
  }
  updateClumps(dt); updateFusions(dt);
  const zt = zoomFor(cells.length + 2 * creatures.filter(k => k.large).length);
  if (Math.abs(zt - zoom) > 0.001) { zoom += (zt - zoom) * Math.min(1, dt * (reduced ? 4 : 1.1)); fitCamera(); }
  // whenever nobody is left on the paper (at the start, or once the last four have gone into a large creature),
  // a person walks in from the left
  if (cells.length === 0 && fusions.length === 0 && !microOn()) { if ((enterWait -= dt) <= 0) walkIn(); }
  updateInk(dt); updateCaptions(dt); updateTalk(dt);
  for (const o of cells) updateCellMesh(o, simT);
  for (const c of [...creatures]) stepCreature(c, dt);
  for (const m of [...meetings]) if (!m.ended) updateMeeting(m, dt);
  for (let i = 0; i < creatures.length; i++) for (let j = i + 1; j < creatures.length; j++) checkMeeting(creatures[i], creatures[j]);
  updateStains(dt);
}
// the pencil overlay for the world: burst lines, and the "Squish" note over a cell being squeezed
function drawEnvironmentOverlay(dt) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const B = bursts[i]; B.t += dt; const g = smooth(B.t / 0.28), a = Math.max(0, 1 - B.t / 1.1);
    if (a <= 0) { bursts.splice(i, 1); continue; }
    for (let k = 0; k < 11; k++) {
      const an = k / 11 * TAU + hn(k, B.seed, 1) * 0.3, r0 = B.r * (1.15 + 0.2 * hn(k, B.seed, 2)), r1 = r0 + B.r * (0.8 + 0.5 * hn(k, B.seed, 3)) * g;
      pline(B.x + Math.cos(an) * r0, B.y + Math.sin(an) * r0, B.x + Math.cos(an) * r1, B.y + Math.sin(an) * r1, B.seed + k, 1.3, 0.6 * a);
    }
  }
  for (const o of cells) {
    if (o.p <= 0.2) continue;
    const sh = shapeOf(o), a = Math.min(1, (o.p - 0.2) * 3);
    const top = new THREE.Vector3(o.x, o.R * sh.ys * (o.orb ? 2.3 : FIG_H), o.z).addScaledVector(camU, o.R * 0.3).addScaledVector(camR, o.R * sh.xs * 0.55);
    let [lx, ly] = toScreen(top); const fs = Math.max(22, Math.min(34, U * 0.07));
    lx = Math.min(innerWidth - 70, Math.max(70, lx + 30)); ly = Math.max(fs + 50, ly - fs);
    const jx = reduced ? 0 : hn(boil, o.seed, 1) * 1.5 * o.p, jy = reduced ? 0 : hn(boil, o.seed, 2) * 1.5 * o.p;
    octx.font = `italic 500 ${Math.round(fs * 0.9)}px "Cormorant Garamond", Garamond, Georgia, serif`; octx.textAlign = "center"; octx.textBaseline = "middle";
    octx.fillStyle = `rgba(52,53,58,${0.8 * a})`; octx.fillText(o.p > 1.75 ? "let go" : "Squish", lx + jx, ly + jy);
    const tw = octx.measureText("Squish").width / 2 + 8;
    pline(lx - tw - 10, ly - 4, lx - tw, ly + 1, o.seed + 21, 1.1, 0.7 * a); pline(lx - tw - 10, ly + 6, lx - tw, ly + 1, o.seed + 22, 1.1, 0.7 * a);
    pline(lx + tw + 10, ly - 4, lx + tw, ly + 1, o.seed + 23, 1.1, 0.7 * a); pline(lx + tw + 10, ly + 6, lx + tw, ly + 1, o.seed + 24, 1.1, 0.7 * a);
  }
}

// ---------- its part of the screen shader (put together in shader.js) ----------
const ENV_UNIFORMS = {
  mapOff: { value: 0 },
  cutC: { value: new THREE.Vector2() },
  cutR: { value: 1 },
  cutA: { value: 0 },
  cutP: { value: 0 },
  hole: { value: 0 },
  lift: { value: 0 },
};
const GLSL_ENV_MAP = `      if (mode == 2) {
        // the map of Delhi. A square is cut from it with a dashed scissor line; the piece lifts, turns and folds away to
        // nothing; then the whole map slides down out of the frame
        vec2 q = sp - vec2(0.0, mapOff), cq = cutC + vec2(0.0, mapOff);
        float inMap = step(win.y, q.y) * step(q.y, win.y + win.w);
        vec3 c = mapAt(q); float A = inMap;
        vec2 lq = rot2(sp - cq, cutA); float sd = max(abs(lq.x), abs(lq.y)) - cutR;
        if (hole > 0.5 && sd < 0.0) A = 0.0;
        float tt = (atan(lq.y, lq.x) + 3.14159) / 6.28318, nd = floor(cutR * 0.55);
        float on = (1.0 - smoothstep(0.9, 2.0, abs(sd))) * step(tt, cutP) * step(0.42, fract(tt * nd)) * (1.0 - hole);
        c = mix(c, vec3(0.16, 0.12, 0.09), on * 0.9);
        if (lift > 0.0 && lift < 1.0) {
          float sc = mix(1.05, 0.02, smoothstep(0.2, 1.0, lift)), turn = lift * 1.4, up = 14.0 * smoothstep(0.0, 0.3, lift);
          vec2 pc = cutC + vec2(0.0, -up);
          vec2 pq = rot2(sp - pc, cutA + turn) / sc; float psd = max(abs(pq.x), abs(pq.y)) - cutR;
          vec2 sq = rot2(sp - pc - vec2(8.0, 16.0) * sc, cutA + turn) / sc; float ssd = max(abs(sq.x), abs(sq.y)) - cutR;
          float fade = 1.0 - smoothstep(0.7, 1.0, lift);
          if (ssd < 0.0) { if (A > 0.5) c *= 1.0 - 0.3 * fade; else { c = vec3(0.12, 0.1, 0.08); A = 0.32 * fade; } }
          if (psd < 0.0) { c = mapAt(cutC + rot2(pq, -cutA)) * 0.97; A = fade; }
        }
        gl_FragColor = vec4(c, A);
        return;
      }`;
