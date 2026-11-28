// ====================================================================================================================
// JALI SEQUENCE: after the grey, each press lays a big torn piece of carved stone jali. Presses 1-4 build the card
// up left to right (your panel Layer_1, the old warm jali, Humayun's tomb, your panel Layer_2) until it is all jali.
// Presses 5-10: the first four don't move the camera; from here each press lays one band of small torn cut-outs and
// moves the camera on right, a little further each time (the steps grow, so the movement builds up). Each band goes over
// the newly seen part (and a way back over the last); its cut-outs are smaller and their jali finer, so it all closes
// in, press by press. The screen stays full. Press 11: the jali is gone, and the rock juts in from the left of the view,
// on black. The knuckle-crack plays on every press.
//
// Comes from: transitions.js, 2 ("cells -> jali": jaliReady() says when the presses belong here).
// Hands over to: transitions.js, 4 ("jali -> environment": the presses after the rock, once jaliPress() says the jali is done; off for now).
// ====================================================================================================================
// the pictures the growing culture turns into, one after another: the map of Delhi, then two carved stone jalis
const JALI1_TEX = new THREE.TextureLoader().load("jali1.jpg"), JALI2_TEX = new THREE.TextureLoader().load("jali2.jpg");
// the jali panels for the last press, side by side on one sheet; more can be added to the sheet later
const JALI_N = 2, /* more panels: widen the sheet and raise this */ JALI_PANELS = new THREE.TextureLoader().load("jalipanels.jpg"); JALI_PANELS.encoding = THREE.LinearEncoding;

const JALI_PRESSES = 11; // 4 big pieces + one press per band (FINE) + the rock: the last press that belongs to the jali (the rock); the next ones are the transition's (transitions.js, 4)
// presses 5-10: small torn cut-outs of 103x, your sharpest jali (the softer ones, Layer_83x and the arches, are left out
// until there are sharper copies; the 2x2 sheet still holds them: cells 1 and 2). Per press: cell, which jali on the
// sheet; asp, its photo's width to height; px, its height in pixels on the sheet (a cut-out never shows it larger than
// that, so nothing goes soft); rows, how many cut-outs fill the card's height (more = smaller); win, how much of its
// photo's height one cut-out shows at least (more = finer jali)
const JALI_FINE_TEX = new THREE.TextureLoader().load("jalifine.jpg"), JALI_ROCK_TEX = new THREE.TextureLoader().load("rock.png");
const FINE = [
  { cell: 0, asp: 1275 / 1332, px: 1024, rows: 3,   win: 0.4 },
  { cell: 0, asp: 1275 / 1332, px: 1024, rows: 3.5, win: 0.5 },
  { cell: 0, asp: 1275 / 1332, px: 1024, rows: 4,   win: 0.6 },
  { cell: 0, asp: 1275 / 1332, px: 1024, rows: 5,   win: 0.7 },
  { cell: 0, asp: 1275 / 1332, px: 1024, rows: 6,   win: 0.8 },
  { cell: 0, asp: 1275 / 1332, px: 1024, rows: 7,   win: 0.9 },
];
// the camera, in card widths: how far each band's press moves it on (growing: the movement builds up), then the rock's
const JALI_STEPS = [0.12, 0.18, 0.27, 0.4, 0.58, 0.84], ROCK_STEP = 0; // the rock comes in where the camera is: no black first
const JALI_PANS = JALI_STEPS.reduce((a, d) => (a.push((a.length ? a[a.length - 1] : 0) + d), a), []), ROCK_PAN = JALI_PANS[JALI_PANS.length - 1] + ROCK_STEP;
// press 11: the rock (ROCKPNG, cleaned of its faint frame and light edge, with a clear 8px margin), jutting in from the
// left edge of the view, its tip into the picture: 0.78 card heights tall, its foot near the bottom, at least a fifth of
// it past the edge (on a narrow phone card, more: its tip ends 0.6 across). In card widths from the jali's start
function rockRect() { const Ac = FR.w / FR.h, h = 0.78, w = h * (452 / 396) / Ac, end = Math.min(0.6, 0.8 * w); return { x0: ROCK_PAN + end - w, top: 0.9 - h, w, h }; }
const rockEnd = () => { const r = rockRect(); return r.x0 + r.w; };
// each press's band: from a way back over the last band to just past the right of its view (the last one to past the
// rock's view), the card's full height
function jaliClusters() {
  return JALI_PANS.map((P, n) => ({ x0: Math.min(P + 0.2, n ? JALI_PANS[n - 1] + 1.0 : 0.95), x1: P + 1.06, y0: -0.04, y1: 1.04 }));
}
// the camera: the tissue point at the middle of the card is (cx + pan, cy); pan grows as the camera moves on right
const panPx = (p = micro.jPan || 0, z = micro.zk || 1) => p * FR.w / z;
// where the camera should be, in card widths: still for presses 1-4, then on right to keep each new piece's frontier in
// sight (presses 5-10), then wherever the transition wants it (envPanTarget() in transitions.js)
const panTarget = () => {
  const st = micro.jStage || 0;
  if (st <= 4) return 0;
  if (st < JALI_PRESSES) return JALI_PANS[st - 5];
  if (st === JALI_PRESSES) return ROCK_PAN;

  return envPanTarget(st);
};
// once the four jali pieces cover the card, the cells are gone for good: nothing is worked out for them after that, and
// wherever the jali (and what follows) does not cover, the background is black
const cellsGone = () => micro.jaliT >= 0 && (micro.jStage || 0) >= 4;
// how much further back the view sits once the jali opens (used by zoomTarget() in cell-sequence.js)
const jaliZoom = () => (micro.jaliT >= 0 ? 0.86 : 1); // and back a little more as the jali opens

// back to the start (called from seedTiling() in cell-sequence.js)
function resetJali() { micro.jaliT = -1; micro.jStage = 0; micro.jPan = 0; micro.cutups = []; microMat.uniforms.pcN.value = 0; }

// every frame while the tissue is up (called from updateMicro() in cell-sequence.js)
function updateJali(dt, u) {
  if (micro.jaliT >= 0) { micro.jaliT += dt; u.jaliT.value = 1; u.jStage.value = micro.jStage;
      // the whole camera glides to where it should be
      micro.jPan = (micro.jPan || 0) + (panTarget() - (micro.jPan || 0)) * (1 - Math.exp(-dt * 2.4)); u.jPan.value = micro.jPan;
      u.jCam.value.set(0.5 + micro.jPan, 0.5, 1); // the jali moves with the camera (it only moves on once the green comes)
      // each press's cut-outs: a grid of square cells (in card heights) over its cluster's box
      const Ac = FR.w / FR.h, vs = jaliClusters();
      FINE.forEach((f, n) => { const B = vs[n], gh = 1 / f.rows, gw = gh / Ac;
        u.jFineR.value[n].set(B.x0, B.y0, gw, gh); u.jFineN.value[n].set(Math.ceil((B.x1 - B.x0) / gw), Math.ceil((B.y1 - B.y0) / gh)); });
      const r = rockRect(); u.jRock.value.set(r.x0 - ROCK_PAN, r.top, r.w, r.h); // across the view, not the jali: it is there at once, wherever the camera is
      u.jN.value = Math.min(FINE.length + 1, Math.max(0, micro.jStage - 4)); // how many bands are down (one more: the rock)
      u.jaliSweep.value = micro.jStage >= 4 ? ease(Math.min(1, (micro.jaliT - micro.sweepAt) / 1.6)) : 0; u.jaliS.value = 1.15 - 0.15 * smooth((micro.jaliT - 0.6) / 3.2);
      u.jaliR.value = 0.42 * Math.min(FR.w, FR.h) / micro.zk; u.jaliI.value = micro.jaliI;
      u.crackC.value.forEach((v, i) => { const c = (micro.crackCells || [])[i]; if (c) v.set(c.x, c.y); else v.set(-1e5, -1e5); }); }
  else u.jaliT.value = 0;
}

// a press, once the grey has come (called from microPointer() in cell-sequence.js)
function jaliPress(ev) {
  if ((micro.jStage || 0) >= JALI_PRESSES) return false;   // the jali is done: the press is the transition's (transitions.js, 4)
  // four presses: four big torn pieces of jali, left to right, until the card is all jali (and the cells are gone); then
  // presses 5-10 each lay a finer band and move the camera on, further each time; press 11 the rock
  micro.jStage = (micro.jStage || 0) + 1; if (micro.jaliT < 0) micro.jaliT = 0;
  if (!playSound(CRACK, 0.6)) pop(); // the stone cracking open
  buzz([12, 40, 20]);
  return true;
}

// ---------- its part of the screen shader (put together in shader.js) ----------
const JALI_UNIFORMS = {
  jali2: { value: JALI2_TEX },
  jaliOld: { value: JALI1_TEX },
  pcN: { value: 0 },
  jPan: { value: 0 },
  jN: { value: 0 },
  pcR: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
  pcA: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
  pcS: { value: new Array(16).fill(0.5) },
  jaliT: { value: 0 },
  jaliS: { value: 0.7 },
  jaliR: { value: 100 },
  jaliI: { value: 0 },
  jaliSweep: { value: 0 },
  jStage: { value: 0 },
  jaliFull: { value: new THREE.TextureLoader().load("jalifull.jpg") },
  jali1: { value: JALI_PANELS },
  jaliP: { value: new THREE.Vector2() },
  crackP: { value: Array.from({ length: 8 }, () => new THREE.Vector2()) },
  crackC: { value: Array.from({ length: 5 }, () => new THREE.Vector2(-1e5, -1e5)) },
  jaliPs: { value: new THREE.Vector2() },
  jaliFine: { value: JALI_FINE_TEX },
  jCam: { value: new THREE.Vector3(0.5, 0.5, 1) },
  jFineR: { value: Array.from({ length: FINE.length }, () => new THREE.Vector4()) },
  jFineN: { value: Array.from({ length: FINE.length }, () => new THREE.Vector2()) },
  jRock: { value: new THREE.Vector4() },
  jaliRock: { value: JALI_ROCK_TEX },
};
const g4 = v => v.toFixed(4);
const FINE_GLSL = FINE.map((p, i) => `${i ? "else " : ""}if (m == ${i}) { cell = ${g4(p.cell)}; asp = ${g4(p.asp)}; ppx = ${g4(p.px)}; wf = ${g4(p.win)}; R = jFineR[${i}]; N = jFineN[${i}]; }`).join("\n          ");
const GLSL_JALI = `      if (jaliT > 0.0) {
        // after the grey: four presses, four big torn pieces of jali, built up left to right until the card is all jali.
        // 1 the left third, 2 the wedge beside it, 3 the lower right, 4 the top right. Each is there at once
        float H = win.w, px = 1.0 / (H * jCam.z), Ac = win.z / win.w;          // px: a screen pixel, in the jali's card heights
        vec2 q = (sp - win.xy) / win.zw;                                        // 0..1 across the card, y down
        float inCard = step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
        // where this pixel is on the jali: in card widths across and card heights down, through its zooming camera
        float wx = jCam.x + (q.x - 0.5) / jCam.z, wy = jCam.y + (q.y - 0.5) / jCam.z;
        vec2 h = vec2(wx * Ac, wy);                                             // the same, in card heights both ways
        // drawn bottom to top: 4, 2, 3, 1. From your two panels (1 and 4), the old jali (2) and Humayun's tomb (3)
        for (int k = 0; k < 4; k++) {
          int i = k == 0 ? 3 : k == 1 ? 1 : k == 2 ? 2 : 0;
          if (float(i) >= jStage) continue;
          float fi = float(i), f, x0, y0, sc, src; vec2 o;
          if (i == 0) { f = (wx - (0.315 - 0.13 * smoothstep(0.42, 1.0, wy))) * Ac; x0 = 0.0; y0 = 0.0; sc = 0.97; src = 0.0; o = vec2(0.015, 0.015); }
          else if (i == 1) { f = (wx - (0.6 - 0.27 * smoothstep(0.38, 1.0, wy))) * Ac + (vnoise(h * 3.2 + 5.0) - 0.5) * 0.09; x0 = 0.27; y0 = 0.0; sc = 0.8; src = 4.0; o = vec2(0.14, 0.12); }
          else if (i == 2) { float t = clamp((wx - 0.12) / 0.8, 0.0, 1.0); f = 0.32 + 0.68 * pow(1.0 - t, 1.6) - wy; x0 = 0.12; y0 = 0.3; sc = 0.4; src = 2.0; o = vec2(0.05, 0.2); }
          else { f = (0.53 - wx) * Ac; x0 = 0.5; y0 = 0.0; sc = 0.72; src = 1.0; o = vec2(0.04, 0.04); }
          if (i >= 2) f = max(f, (wx - 1.03 - 0.02 * sin(wy * 4.0 + fi)) * Ac);   // the card's first right edge, torn too, now the camera moves on
          // a torn paper edge: a slow wander, a ragged middle, and fine fibres
          float w = (vnoise(h * 5.0 + fi * 13.1) - 0.5) * 0.035 + (vnoise(h * 34.0 + fi * 7.3) - 0.5) * 0.008 + (vnoise(h * 150.0 + fi * 3.7) - 0.5) * 0.003;
          float sd = f + w;
          float inP = (1.0 - smoothstep(-px, px, sd)) * inCard;
          vec2 lp = vec2((wx - x0) * Ac, wy - y0);                            // from the piece's corner, in card heights
          float asp = src < 1.5 ? 0.625 : src < 2.5 ? 830.0 / 1380.0 : src < 3.5 ? 1093.0 / 1500.0 : 1074.0 / 1500.0;
          vec2 uv = o + lp * sc / vec2(asp, 1.0);
          uv = 1.0 - abs(1.0 - mod(uv, 2.0));                                   // mirrored, should a piece run past its photo
          vec3 jc;
          if (src < 0.5) jc = texture2D(jali1, vec2(clamp(uv.x, 0.003, 0.997) / ${JALI_N}.0, 1.0 - uv.y)).rgb;
          else if (src < 1.5) jc = texture2D(jali1, vec2((1.0 + clamp(uv.x, 0.003, 0.997)) / ${JALI_N}.0, 1.0 - uv.y)).rgb;
          else if (src < 2.5) jc = texture2D(jaliFull, vec2(uv.x, 1.0 - uv.y)).rgb;
          else if (src < 3.5) jc = texture2D(jaliOld, vec2(uv.x, 1.0 - uv.y)).rgb;
          else jc = texture2D(jali2, vec2(uv.x, 1.0 - uv.y)).rgb;
          jc = mix(jc, vec3(0.88), 0.3 * smoothstep(-0.004, -0.001, sd));     // a pale lip where it tore
          c = mix(c, jc, inP);
        }
        // presses 5-10: each press lays its cluster of small torn cut-outs on a loose grid over its box; each is its own patch
        // of one photo, never repeated, turned a little. Only the nine nearest grid places are looked at
        for (int m = 0; m < ${FINE.length}; m++) {
          float n = float(m);
          if (n >= jN) break;
          float cell, asp, ppx, wf; vec4 R; vec2 N;
          ${FINE_GLSL}
          vec2 g = (vec2(wx, wy) - R.xy) / R.zw;                               // in grid cells
          vec2 gi = floor(g);
          for (int dj = -1; dj <= 1; dj++) for (int di = -1; di <= 1; di++) {
            vec2 cc = gi + vec2(float(di), float(dj));
            if (cc.x < 0.0 || cc.y < 0.0 || cc.x >= N.x || cc.y >= N.y) continue;
            float sd0 = n * 131.0 + cc.y * 17.0 + cc.x;
            float h1 = fract(sin(sd0 * 12.9898 + 3.1) * 43758.5), h2 = fract(sin(sd0 * 78.233 + 1.7) * 43758.5), h3 = fract(sin(sd0 * 39.346 + 7.9) * 43758.5);
            float h4 = fract(sin(sd0 * 11.135 + 5.3) * 43758.5), h5 = fract(sin(sd0 * 63.719 + 2.2) * 43758.5), h6 = fract(sin(sd0 * 27.41 + 9.4) * 43758.5);
            float a = R.w;                                                      // a grid cell, in card heights
            // (the blob reaches at most about 1.3 cells from its centre, so the nine nearest places are enough)
            vec2 ctr = (R.xy + (cc + 0.5 + (vec2(h1, h2) - 0.5) * 0.24) * R.zw) * vec2(Ac, 1.0);
            vec2 hs = a * vec2(0.82 + 0.18 * h3, 0.82 + 0.18 * h4);            // its rough half-width and half-height: it overlaps its neighbours
            vec2 p = rot2(h - ctr, (h5 - 0.5) * 1.2);
            // an organic, torn shape: a rounded blob, its outline wandering slowly, then raggedly, then in fine fibres
            vec2 pa = p / a;
            float w = (vnoise(pa * 1.4 + sd0 * 3.7) - 0.5) * 0.55 + (vnoise(pa * 4.5 + sd0) - 0.5) * 0.14 + (vnoise(pa * 40.0 + sd0 * 1.3) - 0.5) * 0.025;
            float sd = (length(p / hs) - 1.0 + w) * a;
            float inP = (1.0 - smoothstep(-px, px, sd)) * inCard;
            if (inP <= 0.0) continue;
            // its patch of the photo (in photo heights), turned with it; kept clear of the photo's own edges and frame, and
            // never shown larger than the photo's own pixels (the patch takes in more of the photo instead: finer jali)
            vec2 hb = hs * 1.35;                                                // the blob's reach
            float wpx = 2.0 * hb.y * H * dpr / ppx;                             // the share of the photo's height its pixels need
            float s = min(min(max(wf, wpx) / (2.0 * hb.y), 0.86 / (2.0 * hb.y)), (0.86 * asp) / (2.0 * hb.x));
            vec2 o = vec2(0.07 * asp + h6 * max(0.0, 0.86 * asp - 2.0 * hb.x * s), 0.07 + h1 * max(0.0, 0.86 - 2.0 * hb.y * s));
            vec2 uv = clamp((o + (p + hb) * s) / vec2(asp, 1.0), 0.003, 0.997);
            vec2 cl = vec2(mod(cell, 2.0), floor(cell / 2.0)) * 0.5;
            // sampled at a level of detail worked out here, not from neighbouring pixels (which may belong to another cut-out,
            // and that drew fine lines along the grid)
            float lod = log2(max(1e-4, s * 1024.0 / (H * dpr)));
            vec3 jc = texture2DLodEXT(jaliFine, vec2(cl.x + uv.x * 0.5, 1.0 - (cl.y + uv.y * 0.5)), lod).rgb;
            c = mix(c, jc, inP);
          }
        }
        // press 11: the jali goes, and the rock juts in from the left on black
        if (jN > ${FINE.length}.5) {
          c = mix(c, vec3(0.02, 0.016, 0.015), inCard);
          vec2 ru = vec2((q.x - jRock.x) / jRock.z, (q.y - jRock.y) / jRock.w);
          if (ru.x >= 0.0 && ru.x <= 1.0 && ru.y >= 0.0 && ru.y <= 1.0) { vec2 rt = (ru * vec2(452.0, 396.0) + 8.0) / vec2(468.0, 412.0); vec4 t = texture2D(jaliRock, vec2(rt.x, 1.0 - rt.y)); c = mix(c, t.rgb, t.a * inCard); }
        }
      }`;
