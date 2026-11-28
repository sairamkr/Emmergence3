// ====================================================================================================================
// CELL SEQUENCE: one torn cell of an old map of Delhi on black; press and hold to split it; every touch then sets
// off a chain of splits that ripples outward, the view pulls back further with each touch, and the organic Voronoi
// tissue grows until the card is full. Each cell keeps its own fixed patch of one of twelve maps.
//
// Hands over to: transitions.js ("start -> cells" after the first split; "cells -> jali" once the card is full).
// ====================================================================================================================
// ---------- the opening: under the microscope ----------
// Before there is any paper, there is only a slide. A reaction-diffusion pattern creeps in from the edges and gathers
// into one cell. Squeezing a cell splits it; the cells keep dividing and pack into a tissue culture. When the tissue
// has filled the screen, the view pulls back, powers-of-ten style: the whole culture shrinks into the circle, and the
// paper world fades in around it. Everything is drawn by one full-screen shader, in screen pixels.
const MICRO_MAX = 56;
const micro = { phase: "done", t: 0, cells: [], held: null, hideOrb: false, seed: rnd(0, 40), cover: 0, check: 0, waitZoom: 0, z0: 1, squeezed: false };
const microCellsA = Array.from({ length: MICRO_MAX }, () => new THREE.Vector4()), microCellsB = Array.from({ length: MICRO_MAX }, () => new THREE.Vector4());
const HEAD_TEX = new THREE.TextureLoader().load("head.png");
// the map of Delhi the cells are cut from: upscaled to an exact 2048 square (the shader keeps its real proportions), so no
// phone has to shrink it to a power of two, and sampled with mipmaps and anisotropy so it stays crisp at every size
const DELHI_PLAIN = new THREE.TextureLoader().load("delhi.jpg"); DELHI_PLAIN.anisotropy = 8;
const DELHI1950 = new THREE.TextureLoader().load("mapatlas.jpg"); DELHI1950.anisotropy = 8; // eleven more maps of Delhi, one sheet
const N_MAPS = 12;
// the maps in a colour chain: from the 1893 plate, each next one is the remaining map nearest it in colour (worked out once
// from the images, in Lab, by mean and spread): 1893, 1911 Durbar, Oliver sheets, the 1848 district maps, … 1950, 1933
const MAP_CHAIN = [0, 2, 7, 5, 6, 9, 10, 3, 11, 4, 1, 8];
const nextMap = m => MAP_CHAIN[(MAP_CHAIN.indexOf(m) + 1) % MAP_CHAIN.length];
const cellMapsTex = new THREE.TextureLoader().load("cellmaps.jpg");

// ---------- its part of the screen shader (put together in shader.js) ----------
const CELL_UNIFORMS = {
  n: { value: 0 },
  A: { value: microCellsA },
  B: { value: microCellsB },
  rin: { value: 0 },
  rout: { value: 0 },
  rim: { value: 0 },
  maps: { value: cellMapsTex },
  cellR: { value: 100 },
  fillAmt: { value: 0 },
  torn: { value: 1 },
  delhi1950: { value: DELHI1950 },
  headT: { value: HEAD_TEX },
  zoomL: { value: new THREE.Vector4(1, 1, 1, 1) },
  wrap: { value: 0 },
};
const GLSL_CELL_COLOUR = `    vec3 cellInside(vec2 p, vec2 q, float dd, vec4 ct, vec4 bt, float aa){
      // a Voronoi cell, tinted like a patch of an old coloured map: beige paper, pale green, pale blue, a faded pink
      float h = fract(bt.x * 17.13);
      vec3 tone = h < 0.42 ? vec3(0.86, 0.82, 0.70) : h < 0.64 ? vec3(0.78, 0.81, 0.64) : h < 0.86 ? vec3(0.73, 0.81, 0.85) : vec3(0.87, 0.66, 0.66);
      float g = vnoise(p / 1.8) * 0.45 + vnoise(p * vec2(0.05, 0.9) + bt.x) * 0.3 + vnoise(p / 25.0 + bt.x) * 0.25;
      vec3 col = tone * (0.93 + 0.1 * g);
      col *= 1.0 - 0.07 * smoothstep(0.55, 1.0, dd);                           // a touch darker toward the walls
      return col;
    }
`;
const GLSL_CELL_PAPER = `    // silver: the cell walls, a cool grey with a little sheen and grain
    vec3 silver(vec2 p){ float g = 0.6 + 0.22 * vnoise(p / 7.0) + 0.1 * sin(p.x * 0.045 + p.y * 0.03) + 0.06 * vnoise(p * 0.8); return vec3(0.96, 0.975, 1.0) * g; }
    // the background: the two jali photographs, in regions cut by a soft mask. As more of the culture fills the screen the
    // mask's threshold moves, so the regions shift and change shape; a silver seam runs where they meet
    vec3 paper(vec2 sp){ return bgCol; }   // behind the cells: black at first, white once the first cell has split
    vec3 paperOld(vec2 sp){
      // the mask flows: its field is warped by a second, slowly drifting field, so the regions creep, bulge, split and merge
      vec2 q = sp + 70.0 * vec2(vnoise(sp / 300.0 + vec2(tm * 0.07, seed)) - 0.5, vnoise(sp / 300.0 + vec2(seed, -tm * 0.06)) - 0.5);
      float m = vnoise(q / 240.0 + seed + vec2(tm * 0.035, -tm * 0.025)) * 0.6 + vnoise(q / 90.0 + seed * 1.7 - vec2(tm * 0.05, tm * 0.04)) * 0.3 + vnoise(q / 30.0 + seed * 0.3 + tm * 0.08) * 0.1;
      float th = 0.38 + 0.24 * fillAmt + 0.11 * sin(tm * 0.33 + seed) + 0.04 * sin(tm * 0.9), w = fwidth(m) * 1.2 + 0.002;
      // each photograph drifts and breathes a little, so the stone itself seems to move behind the cells
      vec2 da = vec2(sin(tm * 0.11), cos(tm * 0.09)) * 0.03 * res, db = vec2(cos(tm * 0.08 + 1.0), sin(tm * 0.1 + 2.0)) * 0.03 * res;
      vec3 a = texture2D(jali1, cover(sp + da, 1093.0 / 1500.0, 1.08 + 0.05 * sin(tm * 0.13))).rgb, b = texture2D(jali2, cover(sp + db, 1074.0 / 1500.0, 1.08 + 0.05 * cos(tm * 0.12))).rgb;
      vec3 c = mix(a, b, smoothstep(th - w, th + w, m));
      return mix(c, silver(sp), (1.0 - smoothstep(w, w * 3.0, abs(m - th))) * 0.9);
    }`;
const GLSL_CELL_CARD = `      if (mode == 1 && (sp.x < win.x || sp.y < win.y || sp.x > win.x + win.z || sp.y > win.y + win.w)) { gl_FragColor = vec4(vec3(0.541), 1.0); return; } // the page round the card`;
const GLSL_CELL_INTRO = `      if (mode == 0) {
        // the pattern arrives from the edges as a ring that closes in, then draws together into one cell
        float wob = (vnoise(p / 38.0 + seed) - 0.5) * 46.0 + (vnoise(p / 9.0) - 0.5) * 10.0;
        float d = distance(p, centre) + wob;
        float m = smoothstep(rin - 14.0, rin + 14.0, d) * (1.0 - smoothstep(rout - 10.0, rout + 10.0, d));
        float front = min(abs(d - rin), abs(d - rout)) / 60.0;
        float th = mix(0.97, 0.7, clamp(front, 0.0, 1.0));
        if (m > 0.0) { col = mix(col, texture2D(delhi, cover(sp, 1080.0 / 1438.0, 1.0)).rgb, m * rim); lc = vec3(0.82, 0.8, 0.76); ink = lines((p - centre) / tile + seed * 0.37, th) * m * (1.0 - rim); }`;
const GLSL_CELL_TISSUE = `      } else if (jaliT > 0.0 && jStage > 3.5) {
        // the four jali pieces cover the card: the cells are gone for good, and nothing is worked out for them any more.
        // Wherever the jali or what follows does not cover, it is black
        col = vec3(0.02, 0.016, 0.015);
      } else {
        // the tissue is a Voronoi diagram: each point belongs to the nearest cell centre (a squeezed cell stretched along
        // its squeeze). Each cell is drawn pulled in from its walls, its corners rounded and its edge a little wobbly, so
        // black shows between them, and through each one shows part of one of the two jali photographs, chosen at random
        float d1 = 1e5; vec4 ct = vec4(0.0), bt = vec4(0.0);
        for (int i = 0; i < ${MICRO_MAX}; i++) {
          if (i >= n) break;
          vec2 sq = A[i].zw / (0.5 * (A[i].z + A[i].w));
          float d = length((p - A[i].xy) / sq) - B[i].z;   // B.z: the cell's weight, which grows it or swells it
          if (d < d1) { d1 = d; ct = A[i]; bt = B[i]; }
        }
        cellB = bt; cellC = ct.xy; cellM = 0.5 * (ct.z + ct.w);
        float fillG = 0.0, inReal = 0.0;
        if (d1 < 1e4) {
          float mr = 0.5 * (ct.z + ct.w), kr = max(4.0, 0.2 * mr), px = 1.0 / k;
          // how far inside the cell this point is: a smooth minimum of its distances to the walls with every neighbour and to
          // the cell's own reach, so the corners come out rounded (kr is the corner radius)
          // the big cell (several cells merged, kind 0 or 1) fills out to its walls with the rest; a map cell (kind 2) is
          // also held in to its own reach, so it comes out rounded with black round it
          bool big = bt.w < 1.5;
          float reach = min(mr * 2.3, 0.36 * min(win.z, win.w) / k);                    // never more than a blob: the first cell sits in the middle
          float acc = big ? 0.0 : exp(-(reach - d1) / kr);
          for (int j = 0; j < ${MICRO_MAX}; j++) {
            if (j >= n) break;
            if (big && B[j].w < 1.5) continue;                                       // no wall inside the big cell
            vec2 o = A[j].xy - ct.xy; float L = length(o);
            if (L < 0.5) continue;
            if (0.5 * L - length(p - ct.xy) - 0.5 * abs(bt.z - B[j].z) > 14.0 * kr) continue;   // too far to shape this wall at all (its share would be under a millionth)
            acc += exp(-(0.5 * L - dot(p - ct.xy, o / L) + 0.5 * (bt.z - B[j].z)) / kr);
          }
          float edge = -kr * log(max(acc, 1e-30));
          // a displaced edge: the outline pushed in and out by noise fixed to the cell (so it travels with the cell and never
          // swims), in lobes, bays and a fine tear, the more so the larger the cell, like a piece torn from a map
          float sz = min(n == 1 ? 1e5 : mr * 1.3, 0.36 * min(win.z, win.w) / k);
          vec2 lq = (p - ct.xy) / sz;
          float dsp = (vnoise(lq * 1.5 + bt.x * 7.0) - 0.5) * 0.95 + (vnoise(lq * 3.6 + bt.x * 3.0) - 0.5) * 0.4 + (vnoise(lq * 11.0 + bt.x) - 0.5) * 0.09;
          edge += dsp * sz * mix(0.06, 0.62, torn);   // torn only while it is the one first cell; after that, plain organic Voronoi
          float gap = 3.5 + 2.5 * vnoise(p / 14.0 + bt.x * 5.0);                   // the black between cells, a little uneven
          inReal = smoothstep(gap, gap + px * 1.2, edge);
          // each cell is a window: onto one of the two jalis, or (the map cells) onto the map of Delhi; the walls are silver
          // the map is fixed to the cell: each cell shows its own patch (centred at bt.y, bt.w - 2), at a fixed scale, and the
          // patch moves with the cell, so nothing slides behind it
          // twelve maps: the 1893 plate on its own (index 0), and eleven more on one 4 x 3 sheet of 3:4 tiles (index 1-11).
          // bt.w = 2 + 2 * index + v, where v is where on its map this cell's patch sits
          float mi = floor((bt.w - 2.0) * 0.5), mv = bt.w - 2.0 - 2.0 * mi;
          float asp = mi < 0.5 ? 1080.0 / 1438.0 : 0.75;
          vec2 mpd = (p - ct.xy) / (2.6 * min(win.z, win.w));
          vec2 muv = clamp(vec2(bt.y, mv) + mpd * vec2(1.0, asp), 0.01, 0.99);
          float ti = mi - 1.0, tc = mod(ti, 4.0), tr = floor(ti / 4.0);
          vec3 img = mi > 0.5 ? texture2D(delhi1950, vec2((tc + muv.x) / 4.0, 1.0 - (tr + muv.y) / 3.0)).rgb
                   : bt.w > 1.5 ? texture2D(delhi, vec2(muv.x, 1.0 - muv.y)).rgb
                   : bt.w > 0.5 ? texture2D(jali2, cover(sp, 1074.0 / 1500.0, 1.0)).rgb : texture2D(jali1, cover(sp, 1093.0 / 1500.0, 1.0)).rgb;
          img *= 0.8 + 0.2 * smoothstep(gap, gap + 0.3 * mr, edge);              // a soft shade in from the edge, so each reads as a cell
          col = mix(col, silver(p - ct.xy) * (0.85 + 0.15 * smoothstep(0.0, gap, edge)), smoothstep(-px * 1.2, 0.0, edge));
          col = mix(col, img, inReal);
          cellIn = inReal;
        }
        if (fillG > 0.0 && inReal < 1.0) {
          // beyond the culture you grew: more tissue, never the same twice. Cells scattered on a jittered grid
          // (a Worley pattern), each with its own map patch, beans, threads and nucleus from its own random seed
          float g = cellR * 1.55;
          vec2 ip = floor(p / g), best = vec2(0.0), bid = vec2(0.0); float e1 = 1e5;
          for (int oy = -1; oy <= 1; oy++) for (int ox = -1; ox <= 1; ox++) {
            vec2 id = ip + vec2(float(ox), float(oy));
            vec2 pt = (id + 0.15 + 0.7 * vec2(hash(id + 3.1), hash(id + 7.7))) * g;
            float e = distance(p, pt);
            if (e < e1) { e1 = e; best = pt; bid = id; }
          }
          float R = cellR * 1.05, sd = hash(bid) * 40.0 + 100.0;
          vec4 pc = vec4(best, R, R), pb = vec4(sd, hash(bid + 1.7) * 6.2832, 0.9 + 0.3 * hash(bid + 5.3), 0.0);
          vec3 pcol = cellInside(p, rot2((p - best) / R, pb.y), min(e1 / R, 0.8), pc, pb, 0.9 / (k * R));
          col = mix(col, pcol, fillG * (1.0 - inReal));
        }
      }`;

const microOn = () => micro.phase !== "done";
function startMicro() {
  document.body.classList.add("dark");
  makeBugAtlas(); bugGeo.instanceCount = 0;
  FR.kind = "cell"; FR.grow = 0; updateFrame(0, true); archEl.classList.remove("in"); if (mapBeast) { destroyBody(mapBeast); mapBeast = null; }
  micro.cut = { x: 0, y: 0, r: 1, a: 0 }; arrival.twins = null;
  micro.layers = { t: [-1, -1, -1, -1] }; microMat.uniforms.fillAmt.value = 0; microMat.uniforms.rev.value.set(0, 0, 0, 0);
  micro.phase = "tissue"; micro.t = 0; micro.cells.length = 0; micro.held = null; micro.hideOrb = true; micro.cover = 0; micro.waitZoom = 0; micro.squeezed = false;
  micro.seed = rnd(0, 40); microMat.uniforms.wrap.value = 0; introZoom = 1; introCX = introCZ = 0; fitCamera(); hint(""); microMat.uniforms.dissolve.value = -1; walkedIn = 0; enterWait = 0.7; seedTiling(); hint("press and hold");
  arrival.stage = "off"; arrival.person = null; if (arrival.stream) { scene.remove(arrival.stream); arrival.stream.geometry.dispose(); arrival.stream = null; }
}
const halfDiag = () => Math.hypot(FR.w, FR.h) / 2;
function microCell(x, y, r, rt, kind = 0) { const c = { x, y, tx: x, ty: y, r, rt, vx: 0, vy: 0, u: 0, seed: rnd(0, 9), next: rnd(2.2, 4.5), dotA: 0, dots: 0, rot: rnd(0, TAU), nucS: 1, chains: null, kind, pu: rnd(0.25, 0.75), pv: rnd(0.25, 0.75) }; micro.cells.push(c); return c; }
// the opening tiling: seeds spread evenly over the screen by best-candidate sampling; each cell shows part of one of the two
// jalis, chosen at random, and the largest cell shows the map
const ZOOM_OUT = 0.55;
// how far back the view is: none for the first cell; pulled back once it splits; then from the third touch on, a little
// further with every touch, and the tissue spreads to fill the wider view
// (the jali sequence pulls back a little further once the jali opens: jaliZoom() in jali-sequence.js)
const zoomTarget = () => (micro.cells.length > 1 ? Math.max(0.28, ZOOM_OUT * Math.pow(0.84, Math.max(0, (micro.touches || 0) - 2))) : 1) * jaliZoom();
// a point on the screen, in the tissue's own coordinates (the view may be pulled back)
// (the pan comes from the jali sequence: panPx() in jali-sequence.js)
const toTissue = (x, y) => { const cx = FR.x + FR.w / 2, cy = FR.y + FR.h / 2, z = micro.zk || 1; return [cx + panPx() + (x - cx) / z, cy + (y - cy) / z]; };
// the area the tissue spreads over: the window, as large as it will be once the view has pulled back
function tissueRect() { const z = zoomTarget(), cx = FR.x + FR.w / 2 + panPx(panTarget(), z), cy = FR.y + FR.h / 2; return { x: cx - FR.w / 2 / z, y: cy - FR.h / 2 / z, w: FR.w / z, h: FR.h / z }; }
function seedTiling() { // one cell to begin with: the map, filling the screen
  micro.zk = 1; micro.white = 0; micro.torn = 1; micro.pending = []; micro.chains = []; micro.touches = 0; resetCellsToJali(); resetJali(); resetJaliToEnvironment(); document.body.classList.add("dark");
  micro.cells.length = 0; micro.bigTurn = Math.floor(Math.random() * 2); const c0 = microCell(FR.x + FR.w / 2, FR.y + FR.h / 2, 1, 1, 2); c0.pu = 0.47; c0.pv = 0.6; fitRadii(); // the first shows the walled city
}
function seedTilingMany() {
  const W = innerWidth, H = innerHeight, n = Math.max(16, Math.min(40, Math.round(W * H / 12000))), pts = [];
  for (let i = 0; i < n; i++) {
    let best = null, bd = -1;
    for (let k = 0; k < 14; k++) {
      const x = rnd(0, W), y = rnd(0, H); let d = 1e9;
      for (const p of pts) d = Math.min(d, Math.hypot(p.x - x, p.y - y));
      d = Math.min(d, 1.6 * Math.min(x, W - x, y, H - y) + 40); // keep seeds a little in from the edges
      if (d > bd) { bd = d; best = { x, y }; }
    }
    pts.push(best);
  }
  micro.cells.length = 0;
  for (const p of pts) microCell(p.x, p.y, 1, 1, Math.random() < 0.5 ? 0 : 1);
  fitRadii();
  // the largest cell, measured by counting a grid of points nearest to each seed
  const area = new Array(micro.cells.length).fill(0);
  for (let y = 4; y < H; y += 8) for (let x = 4; x < W; x += 8) { let bi = 0, bd = 1e9; micro.cells.forEach((c, i) => { const d = (c.x - x) ** 2 + (c.y - y) ** 2; if (d < bd) { bd = d; bi = i; } }); area[bi]++; }
  micro.cells[area.indexOf(Math.max(...area))].kind = 2;
}
// after every split, a new big cell: a few neighbouring cells merged into one that covers about half the screen and shows
// a jali (the two take turns); every other cell is a map cell on the black
function regroup() {
  const cs = micro.cells, W = innerWidth, H = innerHeight;
  for (const c of cs) c.kind = 2;
  if (cs.length < 2) return;
  const area = new Array(cs.length).fill(0); let all = 0;
  for (let y = 6; y < H; y += 12) for (let x = 6; x < W; x += 12) { let bi = 0, bd = 1e9; cs.forEach((c, i) => { const d = (c.tx - x) ** 2 + (c.ty - y) ** 2; if (d < bd) { bd = d; bi = i; } }); area[bi]++; all++; }
  // grow outward from a random cell, nearest centres first, until the group covers half the screen (at least two cells, and
  // three or four when there are enough), always leaving some map
  const start = cs[Math.floor(Math.random() * cs.length)], order = cs.map((c, i) => i).sort((a, b) => Math.hypot(cs[a].tx - start.tx, cs[a].ty - start.ty) - Math.hypot(cs[b].tx - start.tx, cs[b].ty - start.ty));
  const want = Math.min(cs.length - 1, cs.length >= 6 ? 3 : 1), kind = (micro.bigTurn = (micro.bigTurn || 0) + 1) % 2;
  let got = 0, n = 0;
  for (const i of order) { if (n >= cs.length - 1) break; if (n >= want && got >= all * 0.45) break; if (n >= 1 && got + area[i] > all * 0.62) continue; cs[i].kind = kind; got += area[i]; n++; }
}
// one step of Lloyd relaxation: every centre moves partway toward the middle of the area it owns, so the tiling evens out
function relaxSeeds() {
  const R0 = tissueRect(), cs = micro.cells, X0 = R0.x, Y0 = R0.y, W = R0.w, H = R0.h, sx = new Float32Array(cs.length), sy = new Float32Array(cs.length), sn = new Float32Array(cs.length);
  for (let y = Y0 + 6; y < Y0 + H; y += 12) for (let x = X0 + 6; x < X0 + W; x += 12) { let bi = 0, bd = 1e9; for (let i = 0; i < cs.length; i++) { const d = (cs[i].tx - x) ** 2 + (cs[i].ty - y) ** 2; if (d < bd) { bd = d; bi = i; } } sx[bi] += x; sy[bi] += y; sn[bi]++; }
  cs.forEach((c, i) => { if (sn[i]) { c.tx += (sx[i] / sn[i] - c.tx) * 0.5; c.ty += (sy[i] / sn[i] - c.ty) * 0.5; } });
  fitRadii();
}
// each cell's size: half the distance to its nearest neighbour (sets its corner rounding and squeeze)
function fitRadii() {
  for (const c of micro.cells) { let d = 1e9; for (const o of micro.cells) if (o !== c) d = Math.min(d, Math.hypot(o.tx - c.tx, o.ty - c.ty)); c.r = c.rt = Math.max(12, Math.min(d * 0.5, 0.42 * Math.min(tissueRect().w, tissueRect().h))); }
}
// a map cell divides: two map cells where it was, and the nearest jali cell is taken into the map, so the map spreads
function mapDivide(c, a = rnd(0, TAU)) {
  const dx = Math.cos(a), dy = Math.sin(a), r = c.r, i = micro.cells.indexOf(c); let made = null;
  if (i < 0) return;
  if (micro.cells.length < MICRO_MAX) {
    // the new cell goes in the roomiest part of the old one (points it owns, as far from every centre as possible),
    // and the old centre steps to the middle of what it keeps, so the tiling stays even
    const W = innerWidth, H = innerHeight, own = (x, y) => { let b = null, bd = 1e9; for (const o of micro.cells) { const d = Math.hypot(o.tx - x, o.ty - y); if (d < bd) { bd = d; b = o; } } return b; };
    let best = null, bs = -1;
    for (let t = 0; t < 60; t++) {
      const x = rnd(0, W), y = rnd(0, H); if (own(x, y) !== c) continue;
      let m = 1e9; for (const o of micro.cells) m = Math.min(m, Math.hypot(o.tx - x, o.ty - y));
      m = Math.min(m, 1.4 * Math.min(x, W - x, y, H - y) + 30);
      if (m > bs) { bs = m; best = [x, y]; }
    }
    best = [c.tx + dx * r * 0.55, c.ty + dy * r * 0.55]; // split along a random line through the cell; relaxation does the rest
    const k = made = microCell(c.x, c.y, r, r, 2); k.w = -r * 1.1; k.wv = 0; c.wv = (c.wv || 0) + r * 3.5; // the new one grows in; the old one jolts k.tx = best[0]; k.ty = best[1]; k.seed = c.seed + rnd(0.3, 0.7);
    // the two halves show neighbouring parts of the map, as if the piece had been cut in two
    // the new cell keeps its parent's map, or opens onto another at random; the first split always changes map
    k.map = c.map || 0; if (micro.cells.length === 2 || Math.random() < 0.5) { k.map = (k.map + 1 + Math.floor(Math.random() * (N_MAPS - 1))) % N_MAPS; k.pu = rnd(0.2, 0.8); k.pv = rnd(0.2, 0.8); } // the new cell may open onto the other map
    const dp = 0.07; if (k.map === (c.map || 0)) { k.pu = Math.min(0.9, Math.max(0.1, c.pu + dx * dp)); k.pv = Math.min(0.9, Math.max(0.1, c.pv + dy * dp)); c.pu = Math.min(0.9, Math.max(0.1, c.pu - dx * dp)); c.pv = Math.min(0.9, Math.max(0.1, c.pv - dy * dp)); }
    c.tx -= dx * r * 0.55; c.ty -= dy * r * 0.55;
    micro.relax = 3.5; micro.relaxTick = 0;
  }
  fitRadii();
  if (micro.held === c) micro.held = null;
  return made;
}
function microDivide(c, ax = null) {
  if (micro.cells.length >= MICRO_MAX) return;
  const a = ax ?? rnd(0, TAU), dx = Math.cos(a), dy = Math.sin(a), r = c.r * 0.74, i = micro.cells.indexOf(c);
  if (i >= 0) micro.cells.splice(i, 1);
  const k1 = microCell(c.x - dx * r * 0.6, c.y - dy * r * 0.6, r, c.rt), k2 = microCell(c.x + dx * r * 0.6, c.y + dy * r * 0.6, r, c.rt);
  k1.vx = -dx * 120; k1.vy = -dy * 120; k2.vx = dx * 120; k2.vy = dy * 120; k2.seed = c.seed + rnd(0.3, 0.7); k1.seed = c.seed;
  // each daughter gets the whole set of creature chains, the two sets turned half a turn from each other, and a red dot at its far pole
  k1.chains = k2.chains = c.chains; k1.rot = c.rot + Math.PI; k2.rot = c.rot; k1.dotA = a + Math.PI; k2.dotA = a; k1.dots = k2.dots = 1;
  if (micro.held === c) micro.held = null;
}
function microAt(x, y) { // the cell whose seed is nearest: the Voronoi cell under the finger
  let best = null, bd = 1e9;
  for (const c of micro.cells) { const d = Math.hypot(x - c.x, y - c.y) - (c.w || 0); if (d < bd) { bd = d; best = c; } }
  return best;
}
function updateMicro(dt) {
  if (!microOn()) return;
  // the shader works in screen points; the culture lives inside the frame's window
  const SW = innerWidth, SH = innerHeight, X0 = FR.x, Y0 = FR.y, W = FR.w, H = FR.h, cx = X0 + W / 2, cy = Y0 + H / 2, U0 = Math.min(W, H), u = microMat.uniforms;
  micro.t += dt; u.tm.value += dt;
  // if the window changed shape or size, carry the tissue with it: every cell moves and scales with the frame
  const lf = micro.lastFR;
  if (lf && (lf.x !== FR.x || lf.y !== FR.y || lf.w !== FR.w || lf.h !== FR.h)) {
    const sx = FR.w / lf.w, sy = FR.h / lf.h, sr = Math.min(sx, sy), ocx = lf.x + lf.w / 2, ocy = lf.y + lf.h / 2;
    for (const c of micro.cells) { for (const [a, b] of [["x", "y"], ["tx", "ty"]]) { c[a] = cx + (c[a] - ocx) * sx; c[b] = cy + (c[b] - ocy) * sy; } c.r *= sr; c.rt *= sr; c.w = (c.w || 0) * sr; }
  }
  micro.lastFR = { x: FR.x, y: FR.y, w: FR.w, h: FR.h };
  u.res.value.set(SW, SH); u.win.value.set(X0, Y0, W, H);
  if (MAP_STAGES.includes(micro.phase)) return updateMapStage(dt); u.dpr.value = renderer.getPixelRatio(); u.seed.value = micro.seed; u.centre.value.set(cx, cy);
  u.cellR.value = micro.cells.length ? micro.cells.reduce((t, c) => t + c.r, 0) / micro.cells.length : U0 * 0.24; // new tissue matches the culture's cells
  u.tile.value = Math.max(600, U0 * 2.4);
  if (micro.phase === "intro") { micro.phase = "tissue"; return; }
  if (micro.phase === "intro-old") {
    const T = reduced ? 0.6 : 1, t = micro.t, R0 = U0 * 0.3, D = halfDiag() * 1.25;
    const a = smooth(Math.min(1, t / (2.4 * T))), b = smooth(Math.max(0, Math.min(1, (t - 1.5 * T) / (2.2 * T))));
    u.mode.value = 0; u.rin.value = D * (1 - a) - 30 * a; u.rout.value = D + (R0 - D) * b; u.rim.value = smooth(Math.max(0, (t - 2.6 * T) / (1.1 * T)));
    u.orbC.value.set(cx, cy); u.orbR.value = 1e5; u.k.value = 1; u.tissueA.value = 1; u.bgA.value = 1;
    if (t > 3.8 * T) { micro.phase = "tissue"; micro.t = 0; const c0 = microCell(cx, cy, R0, U0 * 0.24); c0.seed = micro.seed * 0.37; c0.nucS = 1.35; if (CELL_BUGS) c0.chains = microChains(); c0.rot = rnd(-0.4, 0.4); micro.bugA = 0; hint("press and hold the cell"); }
    return;
  }
  // the tiling is soft: each cell has a weight on a spring (a new cell grows in from nothing, a split cell wobbles like jelly,
  // the cell under a finger swells a little), and after a split the centres relax toward the middles of their cells
  const cs = micro.cells, P = micro.ptr;
  if (!cellsGone()) { // once the four jali pieces cover the card the cells are gone: no more swelling, settling or moving
    let under = null;
    if (P && P.on) { let bd = 1e9; for (const c of cs) { const d = Math.hypot(c.x - P.x, c.y - P.y) - (c.w || 0); if (d < bd) { bd = d; under = c; } } }
    for (const c of cs) {
      const target = c === under ? c.r * (P.down ? 0.22 : 0.1) : 0;
      c.wv = (c.wv || 0) + ((target - (c.w || 0)) * 70 - c.wv * 9) * dt; c.w = (c.w || 0) + c.wv * dt;
    }
    if ((micro.relax -= dt) > 0 && (micro.relaxTick -= dt) <= 0) { micro.relaxTick = 0.12; relaxSeeds(); }
    for (const c of cs) {
      if (c === micro.held) { c.u = Math.min(1, c.u + dt / 0.75); if (c.u >= 1) { microSplit(c); break; } }
      else c.u = Math.max(0, c.u - dt * 4);
      const k = 1 - Math.exp(-dt * 7); c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k;
    }
    cs.forEach((c, i) => { microCellsA[i].set(c.x, c.y, c.r * (1 + 0.25 * c.u), c.r * (1 - 0.2 * c.u)); microCellsB[i].set(c.seed, c.pu, c.w || 0, 2 + 2 * (c.map || 0) + c.pv); });
  }
  u.mode.value = 1; u.n.value = cs.length;
  if (micro.phase === "tissue") {
    runChains(dt);
    updateCellsToJali(dt, u, cs);          // TRANSITION cells -> jali: the grey fade once the card is full (transitions.js)
    updateJali(dt, u);                     // JALI SEQUENCE (jali-sequence.js)
    updateJaliToEnvironment(dt, u);        // TRANSITION jali -> environment: presses 9-10, the D chime, black to white (transitions.js)
    micro.zk += (zoomTarget() - micro.zk) * (1 - Math.exp(-dt * 1.4)); // the view eases to how far back it should be
    updateStartToCells(dt, u, cs);         // TRANSITION start -> cells: white ground, plain cells (transitions.js)
    u.orbC.value.set(cx, cy); u.orbR.value = 1e5; u.k.value = micro.zk; u.tissueA.value = 1; u.bgA.value = 1; u.centre.value.set(cx + panPx(), cy);
    updateCellsToEnvironment(dt, u, cs);   // TRANSITION cells -> environment, switched off (transitions.js)
    return;
  }
  updatePullBack(dt, u, cs, cx, cy);       // TRANSITION cells -> environment, the old pull-back (transitions.js)
}
// every touch sets off a chain: the cell divides, then the cell it just made divides, and the cell beside it further out,
// and so on for a few generations, rippling outward from the finger and dying away, so you can see what your touch did
const CHAIN_MAX = 6, CHAIN_STEP = 0.36;
function microSplit(c, axis = rnd(0, TAU), auto = false) {
  const first = micro.cells.length === 1;
  const k = mapDivide(c, axis); micro.squeezed = true;
  if (first && !auto) chimeFirst();
  else if (!auto && (micro.touches || 0) === 1) { if (!playSound(0)) pop(); } // the second touch: glass knock 1
  else pop();
  if (auto) return k;
  buzz([10, 30, 14]);
  // the chains grow with each touch: the first two splits stand alone, the third carries one step further, the fourth two, …
  micro.touches = (micro.touches || 0) + 1;
  const chain = { ox: c.tx, oy: c.ty, done: new Set([c, k]) };
  queueNext(chain, c, k, Math.min(Math.max(0, micro.touches - 2), CHAIN_MAX)); // the first two touches are single splits
  hint(micro.cells.length < 4 ? "tap a cell" : "");
  return k;
}
// the next in a chain: the cell just made, and the nearest neighbour lying further out from where the chain began
function queueNext(chain, from, made, depth) {
  if (depth <= 0) return;
  const next = [];
  if (made) next.push(made);
  const d0 = Math.hypot(from.tx - chain.ox, from.ty - chain.oy);
  const near = micro.cells.filter(o => !chain.done.has(o) && Math.hypot(o.tx - chain.ox, o.ty - chain.oy) >= d0)
    .sort((a, b) => Math.hypot(a.tx - from.tx, a.ty - from.ty) - Math.hypot(b.tx - from.tx, b.ty - from.ty))[0];
  if (near) { chain.done.add(near); next.push(near); }
  for (const o of next) (micro.pending = micro.pending || []).push({ chain, cell: o, depth: depth - 1, t: CHAIN_STEP * (reduced ? 1.6 : 1) });
}
function runChains(dt) {
  const P = micro.pending; if (!P || !P.length) return;
  for (let i = P.length - 1; i >= 0; i--) {
    const e = P[i]; if ((e.t -= dt) > 0) continue;
    P.splice(i, 1);
    if (!micro.cells.includes(e.cell) || micro.cells.length >= MICRO_MAX) continue;
    // each split points away from where the chain began, so the ripple reads as moving outward
    const k = microSplit(e.cell, Math.atan2(e.cell.ty - e.chain.oy, e.cell.tx - e.chain.ox) + rnd(-0.5, 0.5), true);
    if (k) e.chain.done.add(k);
    queueNext(e.chain, e.cell, k, e.depth);
  }
}
// touches go to the microscope while it is up
function microPointer(ev) {
  if (!microOn() || ev.target !== cv || envPeopleOn()) return; // once people are on the green tiles, taps go to them (environment)
  ev.stopImmediatePropagation(); ev.preventDefault();
  micro.ptr = micro.ptr || { x: 0, y: 0, on: false, down: false };
  if (ev.type === "pointermove" || ev.type === "pointerdown") { [micro.ptr.x, micro.ptr.y] = toTissue(ev.clientX, ev.clientY); micro.ptr.on = true; }
  if (ev.type === "pointerdown") micro.ptr.down = true;
  if (ev.type === "pointerup" || ev.type === "pointercancel") { micro.ptr.down = false; if (ev.pointerType !== "mouse") micro.ptr.on = false; }
  if (ev.type === "pointerdown" && micro.phase === "tissue" && jaliReady()) { if (!jaliPress(ev)) jaliToEnvironmentPress(ev); return; } // once grey: the JALI SEQUENCE (presses 1-8), then TRANSITION 4 (9-10)
  if (ev.type === "pointerdown") { if (micro.phase !== "tissue") return;
    if (ev.clientX < FR.x || ev.clientY < FR.y || ev.clientX > FR.x + FR.w || ev.clientY > FR.y + FR.h) return; // a tap on the black round the picture
    const c = microAt(...toTissue(ev.clientX, ev.clientY)); if (c) { if (micro.squeezed) microSplit(c, rnd(0, TAU)); else { micro.held = c; micro.heldId = ev.pointerId; buzz(8); } } audio(); }
  else if ((ev.type === "pointerup" || ev.type === "pointercancel") && ev.pointerId === micro.heldId) micro.held = null;
}
for (const t of ["pointerdown", "pointerup", "pointercancel", "pointermove"]) addEventListener(t, microPointer, true);
