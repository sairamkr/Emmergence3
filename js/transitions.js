// ====================================================================================================================
// TRANSITIONS: the joins between the sequences, each on its own so it can be changed without touching the
// sequences either side.
//
//   1. start -> cells        after the first split the ground turns from black to white and the torn edge goes
//   2. cells -> jali         once the card is full: the D chime, the fade to grey, and the moment presses go to the jali
//   3. cells -> environment  the green page coming through, and the old pull-back to the map (SWITCHED OFF)
//   4. jali -> environment   press 10, after the rock: a green tile of the olive paper flush against the rock's end, on
//                            the black. Taps then split the green tiles; the second split takes the camera on until the
//                            rock is gone, zooms out, then plays the D chime and turns the black white. The tiles fill
//                            one row of four; then a person walks in and taps pop people in two; each creature that
//                            dies lays a green tile and a person steps out of it (4b)
// ====================================================================================================================

// ---------- 1. start -> cells ----------
// after the first split: the view pulls back, the ground turns white, and the torn edge gives way to plain cells
// (the pull-back itself is micro.zk easing to zoomTarget(), in updateMicro())
function updateStartToCells(dt, u, cs) {
    const split = cs.length > 1, e = 1 - Math.exp(-dt * 2.4);
    micro.white += ((split ? 1 : 0) - micro.white) * e; micro.torn += ((split ? 0 : 1) - micro.torn) * (1 - Math.exp(-dt * 3));
    u.torn.value = micro.torn; u.bgCol.value.setRGB(lerp(0.02, 0.985, micro.white), lerp(0.016, 0.98, micro.white), lerp(0.015, 0.97, micro.white));
    document.body.classList.toggle("dark", micro.white < 0.5 || u.gray.value > 0.5);
}

// ---------- 2. cells -> jali ----------
function resetCellsToJali() { micro.grayT = 0; }
function updateCellsToJali(dt, u, cs) {
    // the end: once the page is full and the last chain has settled, everything fades to grey over a few seconds
    const full = cs.length >= MICRO_MAX - 2 && !(micro.pending && micro.pending.length);
    if (full) { const was = micro.grayT || 0; micro.grayT = was + dt; if (was < 0.25 && micro.grayT >= 0.25) chimeFirst(); } // the D chime again as the fade begins
    u.gray.value = full ? smooth(Math.min(1, Math.max(0, (micro.grayT - 0.25) / 1.1))) : 0;
}
// presses go to the jali once the grey has mostly come in
const jaliReady = () => microMat.uniforms.gray.value > 0.6;

// ---------- 3. cells -> environment (switched off: GO_ON is false) ----------
const LAYER_AT = [1e9, 1e9, 1e9, 28]; // only the last is used now: at 28 cells the green page comes through // how many cells it takes for each next picture to come through: map, jali, jali, the green page cellMapsTex.minFilter = THREE.LinearMipmapLinearFilter; cellMapsTex.anisotropy = 4;
function updateCellsToEnvironment(dt, u, cs) {
    // when the map has taken over (or most of the tiling), the green page comes through by reaction diffusion
    const L = micro.layers, maps = cs.filter(c => c.kind === 2).length, jalis = cs.length - maps;
    const GO_ON = false; // the step on to the green page is switched off for now: the tiling stays
    if (GO_ON && L.t[3] < 0 && (maps >= LAYER_AT[3] || jalis === 0)) { L.t[3] = 0; frameArrival(); introZoom = arrival.z0; fitCamera(); hint(""); }
    if (L.t[3] >= 0) L.t[3] += dt;
    const T = reduced ? 0.8 : 2.8, pr = L.t[3] < 0 ? 0 : Math.min(1, L.t[3] / T);
    u.rev.value.set(0, 0, 0, pr);
    if (L.t[3] > T + 0.2) { document.body.classList.remove("dark"); micro.phase = "done"; micro.held = null; enterWait = 0.4; u.rev.value.set(0, 0, 0, 0); }
}
function updatePullBack(dt, u, cs, cx, cy) {
  // the culture has filled the screen: the view pulls back and back, the cells shrink to a fine grain, and that grain
  // is the paper; the paper (already there underneath, seen from very close) pulls back with it and takes over
  const T = reduced ? 1.5 : 5.2, s = Math.min(1, micro.t / T), e = ease(s);
  u.orbC.value.set(cx, cy); u.orbR.value = 1e5; u.wrap.value = 1 + smooth(s / 0.18);
  u.k.value = Math.exp(Math.log(0.045) * e); u.tissueA.value = 1; u.bgA.value = 1;
  u.dissolve.value = -0.12 + 1.24 * smooth((s - 0.5) / 0.5);
  layBugs(cs, true); // again, now the pull-back for this frame is known
  introZoom = arrival.z0 * Math.exp(Math.log(0.25) * (1 - e)); fitCamera();
  if (s >= 1) { micro.phase = "map"; micro.t = 0; u.dissolve.value = -1; u.wrap.value = 0; introZoom = arrival.z0; fitCamera(); }
}

// ---------- 4. jali -> environment ----------
// Once the jali is done (press 11, the rock), the next press lays a tile of the olive painted paper (the environment's
// ground), low down and flush against the rock's end, on the black. From then on a tap splits a green tile: a new tile,
// cut from another part of the paper, slides out flush beside it. The second split sends the camera on right until the
// rock is out of view, then it zooms out, and then the D chime plays and the black turns white.
// (The green-washed jali strip and the carved pillar that used to stand between are gone.)
const ENV_OLIVE_TEX = new THREE.TextureLoader().load("green.jpg");
// for now the piece ends at the rock: presses after it do nothing, and the green tiles (and the environment after them)
// don't come. Set this to true to bring them back
const ENV_AFTER_ROCK = false;
const ENV_PRESSES = JALI_PRESSES + 1; // the last press of the transition; after this, presses split the green tiles
const TILE_MAX = 24, TILE_GAP = 0; // the most green tiles, and the gap between them (in card heights): flush
// the green tiles fill one row of four first. Once all four are down (and the white has come), a person walks in onto
// them, and from then on taps pop the people in two, as in the environment. After that the green only grows where
// creatures die: each death lays a tile there, and a person steps out of it (tileFromDeath)
const BLOCK_COLS = 4, BLOCK_ROWS = [0], BLOCK_N = BLOCK_COLS * BLOCK_ROWS.length;
const inBlock = (i, j) => i >= 0 && i < BLOCK_COLS && BLOCK_ROWS.includes(j);
// a green tile 0.56 card-heights wide and
// 0.4 high. In card widths, measured from the jali card's left edge (the last jali piece ends near 2.76), so they come
// out the same on a wide card or a tall phone one. They start just past the rock (for now: they come after it)
function envStrips() { const Ac = FR.w / FR.h; return { x0: rockEnd() - 0.004, gw: 0, cw: 0, ow: 0.56 / Ac }; } // x0: the rock's end (no strip or pillar now: gw, cw 0)
const pillarEdge = () => /* now the rock's end */ { const s = envStrips(); return s.x0 + s.gw + s.cw; };
// where the camera goes: press 10 the rock's end and the green tile; after the second split, on until the rock has gone
// off the left (and further as it zooms out, so it stays gone)
function envPanTarget(stage) {
  const s = envStrips();
  if (micro.envMoveOn) return pillarEdge() + 0.03 - 0.5 + 0.5 / (micro.envZ || 1);
  return s.x0 + s.ow - 0.92; // the rock's end and the first tile in view
}
function resetJaliToEnvironment() { micro.envWhite = 0; micro.envChimed = false; micro.tiles = []; micro.envSplits = 0; micro.envMoveOn = false; micro.envZoomGo = false; micro.envZ = 1; micro.envCy = 0.5; micro.envPeople = false; }
function jaliToEnvironmentPress(ev) {
  if (!ENV_AFTER_ROCK) return;
  if ((micro.jStage || 0) >= ENV_PRESSES) return greenTileTap(ev);
  micro.jStage = (micro.jStage || 0) + 1;
  if (micro.jStage === ENV_PRESSES) micro.tiles = [{ i: 0, j: 0, fi: 0, fj: 0, t: 1, u0: 0, v0: 0, sc: 1 }]; // the first green tile
  else if (!playSound(CRACK, 0.6)) pop();
  buzz([12, 40, 20]);
}
// a green tile's place: tiles sit on a grid running right (i) and up or down (j) from the first one, against the rock
function tileSlot(i, j) { const s = envStrips(); return { x: pillarEdge() + i * s.ow, y: 0.6 + j * 0.4 }; }
// a tap on the screen, in the same units as the tiles (card widths across, card heights down)
function envWorld(cx, cy) { const Z = micro.envZ || 1; return { x: (micro.jPan || 0) + 0.5 + ((cx - FR.x) / FR.w - 0.5) / Z, y: (micro.envCy || 0.5) + ((cy - FR.y) / FR.h - 0.5) / Z }; }
function greenTileTap(ev) {
  const T = micro.tiles; if (!T.length || T.length >= TILE_MAX) return;
  // the tile under the finger, or the nearest one
  const w = envWorld(ev.clientX, ev.clientY), s = envStrips();
  let tile = null, bd = 1e9;
  for (const t of T) { const p = tileSlot(t.i, t.j), d = Math.hypot((p.x + s.ow / 2 - w.x) * FR.w / FR.h, p.y + 0.2 - w.y); if (d < bd) { bd = d; tile = t; } }
  // where the new one goes: the nearest free place in the row of four (never back into the rock)
  if (T.length >= BLOCK_N) return;
  const taken = new Set(T.map(t => t.i + "," + t.j)); let spot = null, sd = 1e9;
  for (let i = 0; i < BLOCK_COLS; i++) for (const j of BLOCK_ROWS) if (!taken.has(i + "," + j)) {
    const d = Math.abs(i - tile.i) + Math.abs(j - tile.j) + Math.random() * 0.5; if (d < sd) { sd = d; spot = [i, j]; }
  }
  if (!spot) return;
  const sc = rnd(0.6, 0.8); // its patch of the paper, kept inside the photo
  T.push({ i: spot[0], j: spot[1], fi: tile.i, fj: tile.j, t: 0, u0: rnd(0, 1 - sc), v0: rnd(0, 1 - 0.52 * sc), sc });
  micro.envSplits = (micro.envSplits || 0) + 1;
  if (micro.envSplits === 2) micro.envMoveOn = true;   // the second split: on right, then out, then white
  pop(); buzz([10, 30, 14]);
}
// ---------- 4b. people on the green ----------
// When the row of four is down and the white has come, the environment's people are drawn over the tiles. The paper
// world is pinned to the tiles (its middle at the first tile, a person a little shorter than a tile is tall), so as the
// view zooms out to fit the green, people stay where they stand on it. They are kept on the green.
const envPeopleOn = () => !!micro.envPeople;
const tileToScreen = (wx, wy) => { const Z = micro.envZ || 1; return [FR.x + ((wx - (micro.jPan || 0) - 0.5) * Z + 0.5) * FR.w, FR.y + ((wy - (micro.envCy || 0.5)) * Z + 0.5) * FR.h]; };
const screenToTile = (sx, sy) => { const Z = micro.envZ || 1; return [(micro.jPan || 0) + 0.5 + ((sx - FR.x) / FR.w - 0.5) / Z, (micro.envCy || 0.5) + ((sy - FR.y) / FR.h - 0.5) / Z]; };
const groundAt = (sx, sy) => floorAt(sx / innerWidth * 2 - 1, -(sy / innerHeight) * 2 + 1);
function tilesBox() { // the green, in tile units: x across in card widths, y down in card heights
  const s = envStrips(); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const t of micro.tiles) { const p = tileSlot(t.i, t.j); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x + s.ow); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y + 0.4); }
  return { x0, x1, y0, y1 };
}
function framePeopleOnTiles() {
  const R = CFG.people.firstSize, s = envStrips(), tileH = 0.4 * (micro.envZ || 1) * FR.h;
  // size: a person 0.84 of a tile's height
  for (let k = 0; k < 2; k++) {
    const a = toScreen(new THREE.Vector3(0, 0, 0)), b = toScreen(new THREE.Vector3(0, 1, 0)), unit = Math.abs(a[1] - b[1]);
    introZoom *= FIG_H * R * unit / (0.84 * tileH); fitCamera();
  }
  // place: the paper world's middle sits at the first tile's middle
  const [ax, ay] = tileToScreen(pillarEdge() + s.ow / 2, 0.8), g = groundAt(ax, ay);
  if (g) { introCX -= g.x; introCZ -= g.z; fitCamera(); }
  // their ground: the green
  const bx = tilesBox(), [sx0, sy0] = tileToScreen(bx.x0, bx.y0), [sx1, sy1] = tileToScreen(bx.x1, bx.y1), p0 = groundAt(sx0, sy0), p1 = groundAt(sx1, sy1);
  if (p0 && p1) Object.assign(BOUNDS, { x0: Math.min(p0.x, p1.x), x1: Math.max(p0.x, p1.x), z0: Math.min(p0.z, p1.z), z1: Math.max(p0.z, p1.z) });
  // the sun follows the green, so the creatures' shadows are worked out wherever they are on it
  const cx = (BOUNDS.x0 + BOUNDS.x1) / 2, cz = (BOUNDS.z0 + BOUNDS.z1) / 2, half = Math.max(BOUNDS.x1 - BOUNDS.x0, BOUNDS.z1 - BOUNDS.z0) / 2 + 14;
  sun.target.position.set(cx, 0, cz); sun.position.set(cx - 9, 22, cz - 4); sun.target.updateMatrixWorld();
  const sc = sun.shadow.camera; if (Math.abs(sc.right - half) > 0.5) { Object.assign(sc, { left: -half, right: half, top: half, bottom: -half }); sc.updateProjectionMatrix(); }
  shadowCatcher.position.set(cx, 0.004, cz); shadowCatcher.scale.set(half * 2.4, half * 2.4, 1);
}
function startPeopleOnTiles() {
  micro.envPeople = true; framePeopleOnTiles();
  const b = BOUNDS, R = CFG.people.firstSize, x = b.x0 - R * 1.6;
  const o = makeCell(x, (b.z0 + b.z1) / 2 + (b.z1 - b.z0) * 0.12, R, Math.floor(rnd(0, MAPS.length)));
  o.walking = true; o.wand = 0; o.vx = R * 2.4; o.dir = 1; o.walkT = ((b.x0 + b.x1) / 2 - x) / (R * 0.9); // walks in from the left to the middle
  hint("tap a person to pop them in two");
}
// a creature has died here: a green tile is laid where it fell (or the nearest free place), and a person steps out of it
function tileFromDeath(c) {
  if (!envPeopleOn() || micro.tiles.length >= TILE_MAX) return;
  const s = envStrips(), [sx, sy] = toScreen(new THREE.Vector3(c.x, 0, c.z)), [wx, wy] = screenToTile(sx, sy);
  const i0 = Math.floor((wx - pillarEdge()) / s.ow), j0 = Math.floor((wy - 0.6) / 0.4);
  const taken = new Set(micro.tiles.map(t => t.i + "," + t.j)); let spot = null, sd = 1e9;
  for (let i = Math.max(0, i0 - 6); i <= i0 + 6; i++) for (let j = j0 - 6; j <= j0 + 6; j++) if (!taken.has(i + "," + j)) {
    const d = Math.hypot(i - i0, (j - j0) * 0.7) + Math.random() * 0.3; if (d < sd) { sd = d; spot = [i, j]; }
  }
  if (!spot) return;
  const sc = rnd(0.6, 0.8);
  micro.tiles.push({ i: spot[0], j: spot[1], fi: spot[0], fj: spot[1], t: 1, u0: rnd(0, 1 - sc), v0: rnd(0, 1 - 0.52 * sc), sc, born: 0 });
  // the person, from the middle of the new tile
  const p = tileSlot(spot[0], spot[1]), [px, py] = tileToScreen(p.x + s.ow / 2, p.y + 0.3), g = groundAt(px, py);
  if (g) { const o = makeCell(g.x, g.z, CFG.people.firstSize, c.tile ?? Math.floor(rnd(0, MAPS.length))); o.onGreen = true; o.sx = 0.6; o.sy = 1.4; }
  pop(); buzz([10, 20, 10]);
}
// every frame once they are on: the camera kept pinned, and everyone kept on the green (once they have stepped onto it)
function updatePeopleOnTiles(dt) {
  framePeopleOnTiles();
  const b = BOUNDS;
  for (const o of cells) {
    if (o.fusing) continue;
    const m = o.giant ? Math.min(o.R * 0.9, (b.x1 - b.x0) * 0.3) : o.R * 0.9;
    if (!o.onGreen) { if (o.x > b.x0 + m) o.onGreen = true; else continue; }
    if (o.x < b.x0 + m) o.vx += (b.x0 + m - o.x) * 14 * dt; if (o.x > b.x1 - m) o.vx -= (o.x - b.x1 + m) * 14 * dt;
    if (o.z < b.z0 + m) o.vz += (b.z0 + m - o.z) * 14 * dt; if (o.z > b.z1 - m) o.vz -= (o.z - b.z1 + m) * 14 * dt;
  }
}
// drawn over the tiles: the screen shader first, then the paper world without its ground, kept inside the card
function renderPeopleOnTiles() {
  renderer.setRenderTarget(null); renderer.autoClear = true; renderer.clear(); layerMicro();
  const bg = scene.background; scene.background = null; floor.visible = false; shadowCatcher.visible = true; // creature shadows on the tiles
  renderer.autoClear = false; renderer.clearDepth();
  renderer.setScissorTest(true); renderer.setScissor(FR.x, innerHeight - FR.y - FR.h, FR.w, FR.h);
  renderer.render(scene, camera);
  renderer.setScissorTest(false); renderer.autoClear = true; floor.visible = true; shadowCatcher.visible = false; scene.background = bg;
}

// how far out the view has to be to keep every tile in sight, the rock just off the left
function envFitZoom() {
  const s = envStrips(); let x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const t of micro.tiles) { const p = tileSlot(t.i, t.j); x1 = Math.max(x1, p.x + s.ow); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y + 0.4); }
  return Math.max(0.2, Math.min(0.62, 1 / (x1 - pillarEdge() + 0.12), 1 / (y1 - y0 + 0.2)));
}
// every frame while the tissue is up: tiles sliding out; after the second split the camera on right, then out, then the
// D chime and the black turning white
function updateJaliToEnvironment(dt, u) {
  const s = envStrips(); u.jStrip.value.set(s.gw, s.cw, s.ow, s.x0);
  const T = micro.tiles || [];
  if (micro.envMoveOn) {
    if (!micro.envZoomGo && Math.abs(panTarget() - (micro.jPan || 0)) < 0.03) micro.envZoomGo = true;   // the rock is out of view
    if (micro.envZoomGo) {
      const Zt = envFitZoom(); let y0 = 1e9, y1 = -1e9;
      for (const t of T) { const p = tileSlot(t.i, t.j); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y + 0.4); }
      const k = 1 - Math.exp(-dt * 1.6);
      micro.envZ += (Zt - micro.envZ) * k; micro.envCy += ((y0 + y1) / 2 - micro.envCy) * k;
      if (Math.abs(micro.envZ - Zt) < 0.02 || micro.envWhite > 0) {                         // zoomed out: the D chime, and the black turns white
        if (!micro.envChimed) { micro.envChimed = true; chimeFirst(); }
        micro.envWhite = Math.min(1, (micro.envWhite || 0) + dt / 1.2);
      }
    }
  }
  u.envWhite.value = smooth(micro.envWhite || 0); u.envView.value.set(micro.envZ || 1, micro.envCy || 0.5);
  const gx = TILE_GAP * FR.h / FR.w;
  T.forEach((t, n) => {
    t.t = Math.min(1, t.t + dt / 0.35);
    const a = tileSlot(t.fi, t.fj), b = tileSlot(t.i, t.j), e = ease(t.t), x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e;
    u.envTiles.value[n].set(x, y + TILE_GAP, s.ow - gx, 0.4 - TILE_GAP);
    u.envTileUV.value[n].set(t.u0, t.v0, t.sc, 0);
  });
  u.envTileN.value = T.length;
  // the row of four down, slid home, zoomed and white: send in a person
  if (!micro.envPeople && T.length >= BLOCK_N && T.every(t => t.t >= 1) && micro.envWhite >= 1) startPeopleOnTiles();
  if (micro.envPeople) updatePeopleOnTiles(dt);
}

// ---------- their parts of the screen shader (put together in shader.js) ----------
const TRANSITION_UNIFORMS = {
  gray: { value: 0 },
  rev: { value: new THREE.Vector4() },
  dissolve: { value: -1 },
  envOlive: { value: ENV_OLIVE_TEX },
  jStrip: { value: new THREE.Vector4() },
  envWhite: { value: 0 },
  envView: { value: new THREE.Vector2(1, 0.5) },
  envTileN: { value: 0 },
  envTiles: { value: Array.from({ length: TILE_MAX }, () => new THREE.Vector4()) },
  envTileUV: { value: Array.from({ length: TILE_MAX }, () => new THREE.Vector4()) },
};
const GLSL_TO_ENV_FRONT = `    // a reaction-diffusion front: from its own starting place it spreads across the screen; just ahead of it the new
    // picture comes through only along the pattern's fingers, and the pattern's contour is inked at the edge
    vec3 front(vec2 sp, float pr, float sd){
      if (pr <= 0.0) return vec3(0.0);
      if (pr >= 1.0) return vec3(1.0, 0.0, 0.0);
      vec2 o = res * vec2(0.5 + 0.32 * sin(sd * 2.1), 0.5 + 0.32 * cos(sd * 1.7));
      float d = length(sp - o) / length(res) + (vnoise(sp / 110.0 + sd) - 0.5) * 0.22 + (vnoise(sp / 30.0 + sd * 2.0) - 0.5) * 0.06;
      float f = pr * 1.42 - 0.16;
      vec2 q = sp / (tile * 0.45) + sd * 0.37;
      float rd = lines(q, 0.5), iso = lines(q, 0.44) - lines(q, 0.56);
      float ahead = smoothstep(f + 0.2, f + 0.02, d);
      float m = max(smoothstep(f + 0.015, f - 0.03, d), rd * ahead);
      float band = ahead * smoothstep(f - 0.08, f + 0.01, d);
      return vec3(m, iso * band, band);
    }`;
const GLSL_TO_ENV_REVEAL = `      if (mode == 1 && rev.w > 0.0) {
        vec3 f4 = front(sp, rev.w, 3.9);
        a = max(a * (1.0 - f4.x), f4.y * 0.85); c = mix(c, INK, f4.y);         // and at last the green page beneath
      }
      if (dissolve > -0.5) {
        float n2 = vnoise(sp / 170.0 + seed) * 0.5 + vnoise(sp / 60.0 + seed * 1.7) * 0.3 + vnoise(sp / 16.0) * 0.2;
        float b = smoothstep(dissolve - 0.35, dissolve + 0.35, n2);
        c = mix(mapAt(sp) * (0.96 + 0.08 * n2), c, b);
      }`;
const GLSL_CELLS_TO_JALI_GREY = `      if (!(jaliT > 0.0 && jStage > 3.5)) c = mix(c, mix(vec3(0.78), vec3(0.075), cellIn), gray); // at the end: the space between the cells fades to the jali's stone, the cells to the dark of its openings`;
const GLSL_JALI_TO_ENV = `      if (jaliT > 0.0 && jStage > ${JALI_PRESSES}.5) {
        // past the rock's end: black (white later). Press 10 on: the green tiles, the first flush against the rock, low
        // down. Straight edges, as if cut with a blade. envView: how far out the camera has zoomed, and where it looks up
        // or down
        float Ac = win.z / win.w, Z = envView.x;
        vec2 q = (sp - win.xy) / win.zw;                                        // 0..1 across the card, y down
        float inCard = step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
        float wx = jPan + 0.5 + (q.x - 0.5) / Z;                                // in card widths from the jali card's left edge
        float wy = envView.y + (q.y - 0.5) / Z;                                 // in card heights from the card's top
        float x0 = jStrip.w, gw = jStrip.x, cw = jStrip.y, ow = jStrip.z, xe = x0 + gw + cw;   // xe: the rock's end (gw, cw are 0 now)
        if (wx >= xe) c = mix(c, mix(vec3(0.02, 0.016, 0.015), vec3(0.985, 0.98, 0.97), envWhite), inCard);
        float inH = step(0.0, wy) * step(wy, 1.0);
        for (int i = 0; i < ${TILE_MAX}; i++) {
          if (float(i) >= envTileN) break;
          vec4 r = envTiles[i], tu = envTileUV[i];                              // r: the tile (x, y, w, h); tu: its patch of the paper
          if (wx >= r.x && wx < r.x + r.z && wy >= r.y && wy < r.y + r.w) {
            float s = ow * Ac;                                                  // a tile's width, in card heights
            vec2 ouv = tu.xy + vec2((wx - r.x) * Ac, wy - r.y) / s * vec2(1.0, 1.0 / 1.4) * tu.z;   // the photo is about 1.4 wide to 1 high
            c = mix(c, texture2D(envOlive, vec2(ouv.x, 1.0 - ouv.y)).rgb, inCard);
          }
        }
      }`;
