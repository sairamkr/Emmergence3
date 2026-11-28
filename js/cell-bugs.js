// ====================================================================================================================
// CELL SEQUENCE, part 2: creatures curled inside the cells (the old cover look). SWITCHED OFF (CELL_BUGS is false).
// In a file of its own because its material shares uniforms with the screen shader, so it has to come after shader.js.
// ====================================================================================================================
// ---------- creatures curled inside the cells ----------
// Folded creatures lie inside each cell head to tail in short curved chains, like chromosomes. They are drawn from an
// atlas: a few dozen creatures folded once at the start and photographed from above, each facing right.
const BUG_COLS = 8, BUG_ROWS = 4, BUG_TILE = 256, BUG_N = BUG_COLS * BUG_ROWS;
const bugAtlas = new THREE.WebGLRenderTarget(BUG_COLS * BUG_TILE, BUG_ROWS * BUG_TILE, { minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true });
let bugAtlasMade = false;
const CELL_BUGS = false; // creatures curled in the cells (the cover look); off while the cells are map-paper discs
function makeBugAtlas() {
  if (bugAtlasMade || !CELL_BUGS) return; bugAtlasMade = true;
  const st = new THREE.Scene(); st.add(new THREE.HemisphereLight(0xffffff, 0x8a857c, 0.75));
  const sl = new THREE.DirectionalLight(0xffffff, 0.7); sl.position.set(-3, 8, 4); st.add(sl);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const cc = new THREE.Color(); renderer.getClearColor(cc); const ca = renderer.getClearAlpha(), ac = renderer.autoClear;
  renderer.setRenderTarget(bugAtlas); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.autoClear = false;
  const forms = ["crawler", "crawler", "crawler", "walker", "walker", "floater", "hopper", "hopper", "roller", "crawler"];
  for (let i = 0; i < BUG_N; i++) {
    const g = randomGenome(), form = forms[i % forms.length];
    g[G.form] = (["walker", "floater", "crawler", "hopper", "roller"].indexOf(form) + 0.5) / 5; g[G.wings] = rnd(0.2, 1);
    const c = { id: 9000 + i, genome: g, age: 0, walkT: rnd(0, 10), k: 1, x: 0, z: 0, yaw: Math.PI / 2, moveDir: Math.PI / 2, turnV: 0, bank: 0, lunge: 0, shake: 0,
      dying: null, elderT: 0, grow: 1, pop: 0, alt: null, leaving: null, launch: null, wand: 0, hop: { air: false, t: 0, rest: 0.5, dur: 0.5, dist: 0 }, rollA: rnd(0, 6), trail: [], trailD: 0, uvOff: [Math.random(), Math.random()] };
    buildBody(c);
    if (c.p.form === "crawler") { // curled round, nose toward tail, like a sleeping cat
      const R = Math.max(0.25, c.segs.length * c.segSpacing / (1.65 * Math.PI)); c.trail.length = 0;
      for (let j = 0; j < 140; j++) { const a = -Math.PI / 2 - j * 0.05 / R; c.trail.push({ x: R * Math.cos(a), z: R + R * Math.sin(a) }); }
    }
    pose(c, true, 0.016); pose(c, true, 0.016);
    const parts = [c.body, ...(c.segGroup ? [c.segGroup] : []), ...c.legs.flatMap(L => [L.thigh, L.shin])];
    for (const o of parts) st.add(o);
    const box = new THREE.Box3(); for (const o of parts) box.expandByObject(o);
    const sph = box.getBoundingSphere(new THREE.Sphere()), R = sph.radius * 1.04;
    cam.left = -R; cam.right = R; cam.top = R; cam.bottom = -R; cam.updateProjectionMatrix();
    cam.position.copy(sph.center).add(new THREE.Vector3(0, 0.82, 0.57).multiplyScalar(R * 4)); cam.up.set(0, 1, 0); cam.lookAt(sph.center);
    cam.near = R; cam.far = R * 8; cam.updateMatrixWorld();
    // then tighten to what the camera actually sees, so every creature fills its tile
    let ex = 0; const v = new THREE.Vector3();
    for (const o of parts) o.traverse(m => { if (!m.geometry) return; const pa = m.geometry.attributes.position; m.updateMatrixWorld(); for (let q = 0; q < pa.count; q += 1) { v.fromBufferAttribute(pa, q).applyMatrix4(m.matrixWorld).applyMatrix4(cam.matrixWorldInverse); ex = Math.max(ex, Math.abs(v.x), Math.abs(v.y)); } });
    const E = Math.max(0.05, ex * 1.06); cam.left = -E; cam.right = E; cam.top = E; cam.bottom = -E; cam.updateProjectionMatrix();
    bugAtlas.viewport.set((i % BUG_COLS) * BUG_TILE, Math.floor(i / BUG_COLS) * BUG_TILE, BUG_TILE, BUG_TILE);
    renderer.setRenderTarget(bugAtlas); renderer.render(st, cam);
    for (const o of parts) st.remove(o);
    destroyBody(c);
  }
  bugAtlas.viewport.set(0, 0, BUG_COLS * BUG_TILE, BUG_ROWS * BUG_TILE);
  renderer.setRenderTarget(null); renderer.setClearColor(cc, ca); renderer.autoClear = ac;
}
// a cell's chromosomes: two or three S-shaped chains, three to five creatures each, in the cell's own unit circle
function microChains() {
  const n = Math.random() < 0.55 ? 2 : 3, chains = [], phi0 = rnd(0, TAU);
  for (let k = 0; k < n; k++) {
    const phi = phi0 + k * TAU / n + rnd(-0.3, 0.3), th = phi + Math.PI / 2 + rnd(-0.5, 0.5), sgn = Math.random() < 0.5 ? 1 : -1;
    const ox = 0.33 * Math.cos(phi), oy = 0.33 * Math.sin(phi), ct = Math.cos(th), st = Math.sin(th);
    const L = n === 2 ? 0.5 : 0.42, P = (x, y) => [ox + x * ct - y * st, oy + x * st + y * ct];
    const pts = [P(-L, 0), P(-L * 0.35, 0.3 * sgn), P(L * 0.35, -0.3 * sgn), P(L, 0)];
    const m = n === 2 ? 3 + (Math.random() < 0.4) : 2 + (Math.random() < 0.5), bugs = [];
    for (let i = 0; i < m; i++) bugs.push({ t: (i + 0.5) / m, tile: Math.floor(Math.random() * BUG_N), size: rnd(0.27, 0.33) * (n === 2 ? 1 : 0.9), flip: Math.random() < 0.5 ? 1 : -1, ph: rnd(0, TAU) });
    chains.push({ pts, bugs, dir: Math.random() < 0.5 ? 1 : -1 });
  }
  return chains;
}
const bez = (P, t) => { const u = 1 - t; return [0, 1].map(k => u * u * u * P[0][k] + 3 * u * u * t * P[1][k] + 3 * u * t * t * P[2][k] + t * t * t * P[3][k]); };
const bezD = (P, t) => { const u = 1 - t; return [0, 1].map(k => 3 * u * u * (P[1][k] - P[0][k]) + 6 * u * t * (P[2][k] - P[1][k]) + 3 * t * t * (P[3][k] - P[2][k])); };
const BUG_MAX = 56 * 9 * 25;
const bugGeo = new THREE.InstancedBufferGeometry(); bugGeo.copy(new THREE.PlaneGeometry(1, 1));
const bugPos = new Float32Array(BUG_MAX * 2), bugRot = new Float32Array(BUG_MAX * 2), bugTex = new Float32Array(BUG_MAX * 2);
bugGeo.setAttribute("iPos", new THREE.InstancedBufferAttribute(bugPos, 2).setUsage(THREE.DynamicDrawUsage));
bugGeo.setAttribute("iRot", new THREE.InstancedBufferAttribute(bugRot, 2).setUsage(THREE.DynamicDrawUsage)); // angle, size
bugGeo.setAttribute("iTex", new THREE.InstancedBufferAttribute(bugTex, 2).setUsage(THREE.DynamicDrawUsage)); // tile, flip
bugGeo.instanceCount = 0;
const bugMat = new THREE.ShaderMaterial({
  transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
  uniforms: { atlas: { value: bugAtlas.texture }, res: microMat.uniforms.res, dpr: microMat.uniforms.dpr, centre: microMat.uniforms.centre, orbC: microMat.uniforms.orbC, k: microMat.uniforms.k,
    tissueA: microMat.uniforms.tissueA, dissolve: microMat.uniforms.dissolve, seed: microMat.uniforms.seed, alpha: { value: 0 } },
  vertexShader: `attribute vec2 iPos; attribute vec2 iRot; attribute vec2 iTex; uniform vec2 res, centre, orbC; uniform float k; varying vec2 vUv;
    void main(){
      vec2 c = position.xy * vec2(1.0, iTex.y), q = vec2(c.x, -c.y) * iRot.y;          // screen points: y runs down the page
      float cs = cos(iRot.x), sn = sin(iRot.x);
      vec2 p = iPos + vec2(q.x * cs - q.y * sn, q.x * sn + q.y * cs);
      vec2 sp = orbC + (p - centre) * k;
      float col = mod(iTex.x, ${BUG_COLS}.0), row = floor(iTex.x / ${BUG_COLS}.0);
      vUv = (vec2(col, row) + position.xy + 0.5) / vec2(${BUG_COLS}.0, ${BUG_ROWS}.0);
      gl_Position = vec4(sp.x / res.x * 2.0 - 1.0, 1.0 - sp.y / res.y * 2.0, 0.0, 1.0);
    }`,
  fragmentShader: `uniform sampler2D atlas; uniform vec2 res; uniform float dpr, tissueA, dissolve, seed, alpha; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
    void main(){
      vec4 t = texture2D(atlas, vUv);
      if (t.a < 0.01) discard;
      vec3 c = pow(t.rgb / t.a, vec3(1.0 / 2.2));                                  // the atlas holds linear light; the screen wants sRGB
      float a = t.a * alpha * tissueA;
      if (dissolve > -0.5) {
        vec2 sp = vec2(gl_FragCoord.x / dpr, res.y - gl_FragCoord.y / dpr);
        float n2 = vnoise(sp / 170.0 + seed) * 0.5 + vnoise(sp / 60.0 + seed * 1.7) * 0.3 + vnoise(sp / 16.0) * 0.2;
        a *= smoothstep(dissolve - 0.07, dissolve + 0.07, n2);
      }
      gl_FragColor = vec4(c, a);
    }`,
});
const bugScene = new THREE.Scene(); { const m = new THREE.Mesh(bugGeo, bugMat); m.frustumCulled = false; bugScene.add(m); }
function layBugs(cs, wrapped) {
  if (!CELL_BUGS) { bugGeo.instanceCount = 0; return; }
  let n = 0; const W = innerWidth, H = innerHeight, now = performance.now() / 1000;
  // pulled back, the culture repeats; the creatures repeat with it until they are too small to see, then fade
  const k = microMat.uniforms.k.value, fade = wrapped ? smooth((k - 0.25) / 0.15) : 1, copies = [];
  const ri = wrapped && fade > 0 ? Math.min(2, Math.ceil(0.5 / k + 0.5) - 1) : 0;
  for (let i = -ri; i <= ri; i++) for (let j = -ri; j <= ri; j++) copies.push([i * W, j * H]);
  for (const c of cs) {
    if (!c.chains) continue;
    const sx = c.r * (1 + 0.35 * c.u), sy = c.r * (1 - 0.3 * c.u), cr = Math.cos(c.rot), sr = Math.sin(c.rot);
    for (const ch of c.chains) for (const b of ch.bugs) {
      const [lx, ly] = bez(ch.pts, b.t), [tx, ty] = bezD(ch.pts, b.t);
      const x = c.x + (lx * cr - ly * sr) * sx, y = c.y + (lx * sr + ly * cr) * sy;
      const ang = Math.atan2(tx * sr + ty * cr, tx * cr - ty * sr) + (ch.dir < 0 ? Math.PI : 0) + Math.sin(now * 0.9 + b.ph) * 0.06;
      const size = b.size * c.r * 1.9 * (1 + 0.025 * Math.sin(now * 1.3 + b.ph)); // a slow breath
      for (const [ox, oy] of copies) {
        if (n >= BUG_MAX) break;
        bugPos[n * 2] = x + ox; bugPos[n * 2 + 1] = y + oy; bugRot[n * 2] = ang; bugRot[n * 2 + 1] = size; bugTex[n * 2] = b.tile; bugTex[n * 2 + 1] = b.flip; n++;
      }
    }
  }
  bugGeo.instanceCount = fade > 0 ? n : 0; bugMat.uniforms.alpha.value = (micro.bugA || 0) * fade;
  for (const k of ["iPos", "iRot", "iTex"]) bugGeo.attributes[k].needsUpdate = true;
}
