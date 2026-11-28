// ====================================================================================================================
// JALI SEQUENCE: after the grey, each press lays a big torn piece of carved stone jali. Presses 1-4 build the card
// up left to right (your panel Layer_1, the old warm jali, Humayun's tomb, your panel Layer_2) until it is all jali.
// Presses 5-8: the whole camera glides on right, the cells that went off the left come round on the right, and one more
// torn piece goes down at the frontier each press. The knuckle-crack plays on every press.
//
// Comes from: transitions.js, 2 ("cells -> jali": jaliReady() says when the presses belong here).
// Hands over to: transitions.js, 4 ("jali -> environment": presses 9 and 10, once jaliPress() says the jali is done).
// ====================================================================================================================
// the pictures the growing culture turns into, one after another: the map of Delhi, then two carved stone jalis
const JALI1_TEX = new THREE.TextureLoader().load("jali1.jpg"), JALI2_TEX = new THREE.TextureLoader().load("jali2.jpg");
// the jali panels for the last press, side by side on one sheet; more can be added to the sheet later
const JALI_N = 2, /* more panels: widen the sheet and raise this */ JALI_PANELS = new THREE.TextureLoader().load("jalipanels.jpg"); JALI_PANELS.encoding = THREE.LinearEncoding;

const JALI_PRESSES = 8; // the last press that belongs to the jali; the next ones are the transition's (transitions.js, 4)
// the camera: the tissue point at the middle of the card is (cx + pan, cy); pan grows as the camera moves on right
const panPx = (p = micro.jPan || 0, z = micro.zk || 1) => p * FR.w / z;
// where the camera should be, in card widths: still for presses 1-4, then on right to keep each new piece's frontier in
// sight (presses 5-8), then wherever the transition wants it (envPanTarget() in transitions.js)
const panTarget = () => { const st = micro.jStage || 0; return st <= 4 ? 0 : st <= JALI_PRESSES ? 0.65 + 0.42 * (st - 5) : envPanTarget(st); };
// as the camera moves on: the cells now gone off the left (under the jali) come round to fill the strip about to come in
// on the right, and the tiling settles round them
function bringCellsRound() {
  const z = zoomTarget(), W = FR.w / z, L = FR.x + FR.w / 2 + panPx(panTarget(), z) - W / 2;
  for (const c of micro.cells) { if (c.tx >= L) continue; while (c.tx < L) c.tx += W; c.x = c.tx; c.ty += rnd(-0.04, 0.04) * W; c.y = c.ty; }
  micro.relax = 3.5; micro.relaxTick = 0;
}
// how much further back the view sits once the jali opens (used by zoomTarget() in cell-sequence.js)
const jaliZoom = () => (micro.jaliT >= 0 ? 0.86 : 1); // and back a little more as the jali opens

// back to the start (called from seedTiling() in cell-sequence.js)
function resetJali() { micro.jaliT = -1; micro.jStage = 0; micro.jPan = 0; micro.cutups = []; microMat.uniforms.pcN.value = 0; }

// every frame while the tissue is up (called from updateMicro() in cell-sequence.js)
function updateJali(dt, u) {
  if (micro.jaliT >= 0) { micro.jaliT += dt; u.jaliT.value = 1; u.jStage.value = micro.jStage;
      // the whole camera glides to where it should be
      micro.jPan = (micro.jPan || 0) + (panTarget() - (micro.jPan || 0)) * (1 - Math.exp(-dt * 2.4)); u.jPan.value = micro.jPan;
      u.jN.value = Math.min(4, Math.max(0, micro.jStage - 4));          // how many of the moving-on pieces are down
      u.jaliSweep.value = micro.jStage >= 4 ? ease(Math.min(1, (micro.jaliT - micro.sweepAt) / 1.6)) : 0; u.jaliS.value = 1.15 - 0.15 * smooth((micro.jaliT - 0.6) / 3.2);
      u.jaliR.value = 0.42 * Math.min(FR.w, FR.h) / micro.zk; u.jaliI.value = micro.jaliI;
      u.crackC.value.forEach((v, i) => { const c = (micro.crackCells || [])[i]; if (c) v.set(c.x, c.y); else v.set(-1e5, -1e5); }); }
  else u.jaliT.value = 0;
}

// a press, once the grey has come (called from microPointer() in cell-sequence.js)
function jaliPress(ev) {
  if ((micro.jStage || 0) >= JALI_PRESSES) return false;   // the jali is done: the press is the transition's (transitions.js, 4)
  // four presses: four big torn pieces of jali, left to right, until the card is all jali; then presses 5-8 move on right
  // and lay one more piece at the frontier
  micro.jStage = (micro.jStage || 0) + 1; if (micro.jaliT < 0) micro.jaliT = 0;
  if (micro.jStage > 4) bringCellsRound();
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
};
const GLSL_JALI = `      if (jaliT > 0.0) {
        // after the grey: four presses, four big torn pieces of jali, built up left to right until the card is all jali.
        // 1 the left third, 2 the wedge beside it, 3 the lower right, 4 the top right. Each is there at once
        float H = win.w, px = 1.0 / H, Ac = win.z / win.w;
        vec2 q = (sp - win.xy) / win.zw;                                        // 0..1 across the card, y down
        vec2 h = (sp - win.xy) / H;                                             // in card heights
        float inCard = step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
        float wx = q.x + jPan;                                                  // across the jali, in card widths: the card plus how far the view has moved right
        // drawn bottom to top: 4, 2, 3, 1. From your two panels (1 and 4), the old jali (2) and Humayun's tomb (3)
        for (int k = 0; k < 4; k++) {
          int i = k == 0 ? 3 : k == 1 ? 1 : k == 2 ? 2 : 0;
          if (float(i) >= jStage) continue;
          float fi = float(i), f, x0, y0, sc, src; vec2 o;
          if (i == 0) { f = (wx - (0.315 - 0.13 * smoothstep(0.42, 1.0, q.y))) * Ac; x0 = 0.0; y0 = 0.0; sc = 0.97; src = 0.0; o = vec2(0.015, 0.015); }
          else if (i == 1) { f = (wx - (0.6 - 0.27 * smoothstep(0.38, 1.0, q.y))) * Ac + (vnoise(h * 3.2 + 5.0) - 0.5) * 0.09; x0 = 0.27; y0 = 0.0; sc = 0.8; src = 4.0; o = vec2(0.14, 0.12); }
          else if (i == 2) { float t = clamp((wx - 0.12) / 0.8, 0.0, 1.0); f = 0.32 + 0.68 * pow(1.0 - t, 1.6) - q.y; x0 = 0.12; y0 = 0.3; sc = 0.4; src = 2.0; o = vec2(0.05, 0.2); }
          else { f = (0.53 - wx) * Ac; x0 = 0.5; y0 = 0.0; sc = 0.72; src = 1.0; o = vec2(0.04, 0.04); }
          if (i >= 2) f = max(f, (wx - 1.03 - 0.02 * sin(q.y * 4.0 + fi)) * Ac);   // the card's first right edge, torn too, now the camera moves on
          // a torn paper edge: a slow wander, a ragged middle, and fine fibres
          float w = (vnoise(h * 5.0 + fi * 13.1) - 0.5) * 0.035 + (vnoise(h * 34.0 + fi * 7.3) - 0.5) * 0.008 + (vnoise(h * 150.0 + fi * 3.7) - 0.5) * 0.003;
          float sd = f + w;
          float inP = (1.0 - smoothstep(-px, px, sd)) * inCard;
          vec2 lp = vec2((wx - x0) * Ac, q.y - y0);                            // from the piece's corner, in card heights
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
        // presses 5-8: the view moves on right and one more torn piece goes down at the frontier, the cells beyond it
        for (int m = 0; m < 4; m++) {
          float n = jN - 4.0 + float(m);
          if (n < 0.0) continue;
          float hs = fract(sin(n * 12.9898 + 3.1) * 43758.5), hs2 = fract(sin(n * 78.233 + 1.7) * 43758.5);
          float L = 0.9 + 0.42 * n + (hs - 0.5) * 0.1 * (q.y - 0.5) * 2.0 + 0.03 * sin(q.y * 3.0 + n);
          float Rr = 0.9 + 0.42 * n + 0.6 + (hs2 - 0.5) * 0.12 * (q.y - 0.5) * 2.0 + 0.04 * sin(q.y * 2.3 + n * 1.7);
          float f = max(L - wx, wx - Rr) * Ac;
          float w = (vnoise(h * 5.0 + n * 13.1 + 40.0) - 0.5) * 0.035 + (vnoise(h * 34.0 + n * 7.3) - 0.5) * 0.008 + (vnoise(h * 150.0 + n * 3.7) - 0.5) * 0.003;
          float sd = f + w;
          float inP = (1.0 - smoothstep(-px, px, sd)) * inCard;
          float src = mod(n + 2.0, 4.0);                                        // the old jali, Humayun's tomb, panel 1, panel 2, ...
          float srcT = src < 0.5 ? 4.0 : src < 1.5 ? 2.0 : src < 2.5 ? 0.0 : 1.0;
          float asp = srcT < 1.5 ? 0.625 : srcT < 2.5 ? 830.0 / 1380.0 : 1074.0 / 1500.0;
          vec2 lp = vec2((wx - (0.9 + 0.42 * n - 0.06)) * Ac, q.y);
          vec2 uv = vec2(0.04 + 0.05 * hs, 0.04 + 0.1 * hs2) + lp * 0.55 / vec2(asp, 1.0);
          uv = 1.0 - abs(1.0 - mod(uv, 2.0));
          vec3 jc;
          if (srcT < 0.5) jc = texture2D(jali1, vec2(clamp(uv.x, 0.003, 0.997) / ${JALI_N}.0, 1.0 - uv.y)).rgb;
          else if (srcT < 1.5) jc = texture2D(jali1, vec2((1.0 + clamp(uv.x, 0.003, 0.997)) / ${JALI_N}.0, 1.0 - uv.y)).rgb;
          else if (srcT < 2.5) jc = texture2D(jaliFull, vec2(uv.x, 1.0 - uv.y)).rgb;
          else jc = texture2D(jali2, vec2(uv.x, 1.0 - uv.y)).rgb;
          jc = mix(jc, vec3(0.88), 0.3 * smoothstep(-0.004, -0.001, sd));
          c = mix(c, jc, inP);
        }
      }`;
