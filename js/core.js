// ====================================================================================================================
// CORE: settings, small helpers, the three.js scene, the frame (card) and camera, painting to the screen, the pencil
// overlay, sound and the buttons. Shared by every sequence; nothing here belongs to one sequence alone.
//
// Load order (index.html): core, environment-sequence, cell-sequence, jali-sequence, transitions, shader, cell-bugs,
//   ui, main.
// The files share one scope: a name made at the top of one file can be used in the others.
// ====================================================================================================================
// ---------- settings: every number worth tuning lives here, and the "edit" panel changes them while the page runs ----------
// The panel shows this as JSON. Changes are kept in this browser only; "copy" gives the JSON to bake back in here.
const DEFAULTS = {
  circle: { size: 1.9, spin: 0.6 },
  people: { firstWalkerFills: 0.86, firstSize: 1.2, shrinkEachSplit: 0.86, smallestSize: 0.85, stroll: 2.6, gatherPull: 3, gatherAtCount: 4, popIntoLargeSeconds: 0.7 },
  creatures: {
    firstLivesSeconds: [3, 6], laterLivesSeconds: [14, 34], shortLivesFor: 4, lengthenOver: 30, largeLivesAtLeastSeconds: [28, 46],
    birdChance: 0.6, birdSpeed: 1.6, birdCirclingSpeed: 2.8, birdsCircleAboveHeight: 0.9,
  },
  buildings: { gapLarge: 6 }, // how much room a building keeps around it
  watercolour: { strength: 1, wobble: 1, bleed: 1, edges: 1, granulation: 1, wash: 1 },
  ink: { patternSize: 14, lineThickness: 0.5, reachCircle: 3, reachPerson: 1.3, reachPerSize: 1, holdSeconds: 3, fadeSeconds: 11, colour: "#3b2413" },
  text: { chance: 0.4, staySeconds: 14, fadeSeconds: 1.8, width: 10.5, colour: "#2c1c10", lines: ["Placeholder line"] }, // (the older line written on the ground; no longer shown)
  speech: { onSplit: 0.55, onBuilding: 0.75, replyChance: 0.6, idleEverySeconds: [9, 16], typingLettersPerSecond: 28, staySeconds: 4.2, atOnce: 2 },
  dialogue: {
    split: [ // someone newly squeezed out of the circle
      "One moment I was a pattern. Now I have knees.",
      "Squeezed out again. It never gets less surprising.",
      "Somebody pressed, and here we are.",
      "Was I always two?",
      "Mind the edge, I’ve only just arrived.",
    ],
    pop: [ // a person popped into two
      "Oh! There’s another of me.",
      "I felt that. Did you feel that?",
      "We keep multiplying and nobody asks why.",
      "Half of me would like a word with the other half.",
      "Again? I’d barely settled into being one.",
    ],
    reply: [
      "Don’t look at me, I just got here.",
      "It feels quite… reassuring.",
      "Same as last time, I think.",
      "Let’s not make a habit of it.",
      "Hm. He was right, this is better.",
    ],
    gather: [ // four people drawing together
      "Four of us. You know what that means.",
      "Come closer. It’s nearly time.",
      "I had rather hoped to stay a person.",
      "Hold still. This is where we stop being us.",
    ],
    large: [ // the large creature, just made
      "We were four. I am one. The arithmetic is unkind.",
      "Much better. So many legs.",
      "I remember being several people.",
      "Nobody mention the popping.",
    ],
    churn: [ // idle thoughts about the whole business
      "Everything here turns into something else.",
      "Split, gather, pop, build. Then again.",
      "The buildings are only us, later.",
      "Nothing is wasted here. It’s a little alarming.",
      "I was a circle once. Then a crowd. Soon, architecture.",
      "Do you ever feel you’re being stirred?",
    ],
    buildings: { // said by whoever is nearest when one rises
      tree: ["A tree. Something here finally intends to stay.", "It grew out of a frog. I try not to think about it.", "Shade! On paper!"],
      finial: ["A very small monument. Somebody very small has died.", "Carved marble, for a caterpillar. Imagine."],
      house: ["A house with nobody in it. Give it a minute.", "Clay walls. Somebody was thinking of the rain."],
      arcade: ["Three arches and nowhere to go through them.", "I shall walk under it and feel important."],
      minaret: ["Red stone, and a spike on top. Somebody meant business.", "Tall enough to see where we all end up.", "The birds will be unbearable about this."],
      ruin: ["It arrived already ruined. We do things quickly here.", "Broken on the first day. Efficient."],
      rampart: ["A wall. Against what? Us?", "Battlements. Somebody is expecting company."],
      gate: ["A gate with nothing on either side.", "After you. No, after you."],
      cupola: ["A little hat for a building that isn’t there yet.", "Somebody tiny left a roof."],
      kiosk: ["A pavilion for one. Very exclusive.", "Columns, a cap, and nowhere to sit."],
      bay: ["A window with no room behind it.", "One arch. It’s a start."],
      arcadeWall: ["Three arches and nowhere to go through them.", "A wall of doorways. Pick one."],
      wingL: ["Half a gate. The other half is somebody else’s problem.", "That piece belongs to something bigger."],
      wingR: ["The right-hand side of something. Where’s the rest?", "Arches stacked like shelves. Very tidy."],
      tower: ["Now that is how you leave a place.", "Tall enough to see where we all end up.", "The birds will be unbearable about this."],
      iwan: ["A great doorway, and the door’s gone missing.", "Big enough to walk through grandly. Watch me."],
      domeTop: ["A dome. Somebody large is resting under there.", "Four little towers keeping watch over nothing.", "It sits on the ground as if the building sank."],
    },
    aboutCreature: { // a person, looking at a creature
      hopper: ["That frog is made of a map. It knows where it’s going.", "Good frog. Precious frog."],
      crawler: ["It has more legs than plans.", "Lovely caterpillar. Don’t fold yourself on my account."],
      floater: ["Show-off. Some of us walk.", "It was four of us once. Now look at it."],
      walker: ["That one used to be people. Be polite.", "So that’s what becomes of a crowd."],
      roller: ["It rolls. I don’t ask where.", "A star that can’t keep still. I sympathise."],
    },
    aboutPerson: [ // a creature, looking at a person
      "They hatched me and walked off.",
      "Chequered head. Says nothing useful.",
      "Careful. One touch and there are two of that.",
      "The tall ones pop. I’ve seen it.",
    ],
    aboutOther: [ // one person to another
      "You look exactly like me. It’s rude.",
      "Stand still, I’m counting us.",
      "If we reach four, you know what happens.",
      "Keep your distance. I like being singular.",
    ],
  },
  reveal: { delay: 0.2, duration: 1.8, letterFade: 0.7, edgeRaggedness: 0.6, startScale: 1.25, riseFrom: 0.3 },
};
const CFG_KEY = "squish-settings-v15";
const clone = v => JSON.parse(JSON.stringify(v));
// take only what matches the shape of the defaults, so a half-edited or older JSON can never break the page
function fit(def, val) {
  if (Array.isArray(def)) return Array.isArray(val) && val.length && val.every(x => typeof x === typeof def[0]) ? (typeof def[0] === "number" ? val.slice(0, def.length === 2 ? 2 : 99).map(Number) : val.slice()) : clone(def);
  if (def && typeof def === "object") { const o = {}; for (const k in def) o[k] = fit(def[k], val && typeof val === "object" ? val[k] : undefined); return o; }
  return typeof val === typeof def && (typeof val !== "number" || isFinite(val)) ? val : def;
}
let CFG = clone(DEFAULTS);
try { const saved = localStorage.getItem(CFG_KEY); if (saved) CFG = fit(DEFAULTS, JSON.parse(saved)); } catch (e) {}
const DISSOLVE = CFG.reveal; // (the settings panel edits this object in place)
const GENES = [
  ["legs", "Leg pairs"], ["bulk", "Bulk"], ["stride", "Leg length"], ["tone", "Second map"], ["speed", "Pace"],
  ["aggr", "Aggression"], ["neck", "Neck"], ["wings", "Wings"], ["crumple", "Crumple"], ["print", "Main map"], ["life", "Longevity"], ["form", "Form"],
];
const G = Object.fromEntries(GENES.map((g, i) => [g[0], i]));
const rnd = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp01 = v => Math.min(1, Math.max(0, v));
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
function smooth(t) { return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t); }
// ---------- scene ----------
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const TAU = Math.PI * 2;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
const SHADOWS = false; // shadows for the people, the circle and the buildings; the creatures always cast one
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const stageEl = document.getElementById("stage"); stageEl.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const PAPER = 0xdbc490; scene.background = new THREE.Color(PAPER);
// An oblique view, as in a miniature painting: the ground lies flat like a plan and heights are drawn straight up
// the page, with no vanishing point. (A camera looking straight down, with heights slid up the screen.)
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, 300); camera.up.set(0, 0, -1);
const CAM_H = 120, RISE = 1; // RISE: how far up the page one unit of height is drawn
const UPRIGHT = new THREE.Matrix4().set(1, 0, 0, 0, 0, 1, 1 / RISE, 0, 0, 0, 1, 0, 0, 0, 0, 1); // leans a cell back so the oblique view shows it round
const hemi = new THREE.HemisphereLight(0xffffff, 0x8a857c, 0.6); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 0.68);
sun.position.set(-9, 22, -4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 90 }); sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0005; scene.add(sun, sun.target);
// a soft studio for the cell walls to catch highlights from
let ENV = null;
{
  const pm = new THREE.PMREMGenerator(renderer), env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), new THREE.MeshBasicMaterial({ color: 0x9a968e, side: THREE.BackSide })));
  const panel = (w, h, x, y, z, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); m.material.color.setScalar(k); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
  panel(14, 8, -6, 13, -4, 6); panel(6, 10, 13, 4, 6, 2.5); panel(20, 4, 0, -12, 0, 0.8);
  ENV = pm.fromScene(env, 0.04).texture; // only the cell walls reflect it; the paper stays matt
}


// ---------- the frame: a window in a mount, in screen points; the world is fitted inside it ----------
// portrait for the first cell, opening wider as the tissue grows; the map's own shape; portrait again for the arch and
// the person; and, once he has split in two, the red-bordered landscape page the rest is played on
const FR = { x: 0, y: 0, w: 1, h: 1, kind: "cell", grow: 0, land: 0 };
const LAND_B = [70 / 1552, 60 / 1552, 72 / 1552, 74 / 1552]; // red border widths (top, right, bottom, left) as shares of the inner width
function frameTarget(kind) {
  // the card on the site's page: 3:2 on a laptop or desktop, with the Back button in the left margin; 2:3 (tall) on a phone held
  // upright, with Back above it. As large as fits in what is left of the page, centred there
  { const W = innerWidth, H = innerHeight, phone = Math.min(W, H) < 600, tall = phone && H >= W, A = tall ? 2 / 3 : 3 / 2;
    const mx = tall ? 8 : phone ? 120 : Math.max(150, W * 0.113), top = tall ? 76 : phone ? 12 : Math.max(24, H * 0.12), bot = tall ? 20 : phone ? 12 : Math.max(24, H * 0.085);
    const aw = W - 2 * mx, ah = H - top - bot, w = Math.min(aw, ah * A), h = w / A; return { x: (W - w) / 2, y: top + (ah - h) / 2, w, h }; }
  const W = innerWidth, H = innerHeight, m = 0.045 * Math.min(W, H) + 6;
  const fit = (a, bw = 0, bh = 0) => { let w = Math.min(W - 2 * m, (H - 2 * m) * a); w = Math.min(w, (W - 2 * m) / (1 + bw)); let h = w / a; if (h * (1 + bh) > H - 2 * m) { h = (H - 2 * m) / (1 + bh); w = h * a; } return { x: (W - w) / 2, y: (H - h) / 2, w, h }; };
  if (kind === "land") { const r = fit(1552 / 1242, LAND_B[1] + LAND_B[3], (LAND_B[0] + LAND_B[2]) * 1552 / 1242); return r; }
  if (kind === "map") return fit(392 / 640);
  const p = fit(0.707);
  if (kind === "cell") { const g = FR.grow, f = { x: m * 0.5, y: m * 0.5, w: W - m, h: H - m }; return { x: p.x + (f.x - p.x) * g, y: p.y + (f.y - p.y) * g, w: p.w + (f.w - p.w) * g, h: p.h + (f.h - p.h) * g }; }
  return p;
}
const siteEl = document.getElementById("site");
document.getElementById("back").addEventListener("click", e => { if (history.length > 1 && document.referrer) { e.preventDefault(); history.back(); } });
const winEl = document.getElementById("win"), archEl = document.getElementById("arch"), fernEl = document.getElementById("ferns");
function updateFrame(dt, snap) {
  const t = frameTarget(FR.kind), k = snap ? 1 : 1 - Math.exp(-dt * 2.6);
  for (const key of ["x", "y", "w", "h"]) FR[key] += (t[key] - FR[key]) * k;
  FR.land += ((FR.kind === "land" ? 1 : 0) - FR.land) * (snap ? 1 : 1 - Math.exp(-dt * 2));
  const b = LAND_B.map(v => v * FR.w * FR.land); // the red border grows out round the picture as it turns landscape
  winEl.classList.toggle("land", FR.land > 0.01);
  { // the Back button and the label: beside the card on a wide screen, above it on a tall one
    const tall = FR.h > FR.w; siteEl.classList.toggle("side", !tall);
    if (tall) Object.assign(siteEl.style, { left: FR.x + 6 + "px", top: Math.max(8, FR.y - 56) + "px", right: "", transform: "" });
    else Object.assign(siteEl.style, { left: Math.max(8, FR.x - 32) + "px", top: FR.y + 2 + "px", transform: "translateX(-100%)" });
  }
  Object.assign(fernEl.style, { left: FR.x + "px", top: FR.y + FR.h * 0.78 + "px", width: FR.w + "px", height: FR.h * 0.22 + "px", opacity: FR.land.toFixed(3) });
  Object.assign(winEl.style, { left: FR.x - b[3] + "px", top: FR.y - b[0] + "px", width: FR.w + b[1] + b[3] + "px", height: FR.h + b[0] + b[2] + "px", borderWidth: b.map(v => v.toFixed(1) + "px").join(" ") });
}
// ---------- camera fit and the part of the floor on screen ----------
const BOUNDS = { x0: -6, x1: 6, z0: -8, z1: 8 };
const camR = new THREE.Vector3(), camU = new THREE.Vector3(), camF = new THREE.Vector3();
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const rayFar = new THREE.Vector3();
function aimRay(nx, ny) { ray.ray.origin.set(nx, ny, -1).unproject(camera); rayFar.set(nx, ny, 1).unproject(camera); ray.ray.direction.copy(rayFar).sub(ray.ray.origin).normalize(); ray.camera = camera; }
function floorAt(nx, ny) { aimRay(nx, ny); const p = new THREE.Vector3(); return ray.ray.intersectPlane(floorPlane, p) ? p : null; }
// the camera pulls back as the colony grows: not at all for the first cell, then a little more with every division
let zoom = 1, introZoom = 1, introCX = 0, introCZ = 0; // the intro* values belong to the opening pull-back
const zoomFor = n => n <= 1 ? 1 : 1 + 0.3 * Math.sqrt(n - 1);
const slide = new THREE.Matrix4();
const standM = new THREE.Matrix4();
function standUp(obj) { obj.updateMatrix(); obj.matrix.premultiply(standM.copy(UPRIGHT).setPosition(0, -obj.position.z / RISE, 0)); obj.matrixAutoUpdate = false; obj.matrixWorldNeedsUpdate = true; }
let camHH = 1, camHW = 1;
function fitCamera() {
  // the view is fitted to the frame's window, not the whole screen; the mount hides the rest
  const W = innerWidth, H = innerHeight, aspect = FR.w / FR.h;
  const hh = 1.15 * zoom * introZoom * Math.max(6.8 / Math.min(aspect, 1.6), 8.5), hw = hh * aspect, cz = -0.12 * hh;
  const upp = 2 * hh / FR.h, wcx = FR.x + FR.w / 2, wcy = FR.y + FR.h / 2;
  camera.left = -wcx * upp; camera.right = (W - wcx) * upp; camera.top = wcy * upp; camera.bottom = -(H - wcy) * upp; camHH = hh; camHW = hw;
  camera.position.set(introCX, CAM_H, cz + introCZ); camera.lookAt(introCX, 0, cz + introCZ); camera.updateProjectionMatrix();
  camera.projectionMatrix.multiply(slide.set(1, 0, 0, 0, 0, 1, RISE, RISE * CAM_H, 0, 0, 1, 0, 0, 0, 0, 1));
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  camera.updateMatrixWorld();
  camR.set(1, 0, 0); camU.set(0, 1, 0); camF.set(0, 0.7071, 0.7071);
  Object.assign(BOUNDS, { x0: introCX - hw, x1: introCX + hw, z0: introCZ + cz - hh * 0.8, z1: introCZ + cz + hh * 0.78 });
}
// ---------- watercolour: the scene is drawn to a picture first, then painted over the screen as if in watercolour ----------
// The picture is nudged by a slow paper-like wobble; colours bleed a little into their neighbours; pigment gathers and
// darkens where colours meet; fine granulation settles in the paper; and broad, uneven washes lighten and darken it.
const isGL2 = renderer.capabilities.isWebGL2;
const paintRT = new (isGL2 ? THREE.WebGLMultisampleRenderTarget : THREE.WebGLRenderTarget)(4, 4, { encoding: THREE.sRGBEncoding });
paintRT.texture.encoding = THREE.sRGBEncoding; if (isGL2) paintRT.samples = 4;
const paintMat = new THREE.ShaderMaterial({
  depthTest: false, depthWrite: false,
  uniforms: { tPic: { value: paintRT.texture }, res: { value: new THREE.Vector2(4, 4) }, k: { value: 1 }, wob: { value: 1 }, bleed: { value: 1 }, edg: { value: 1 }, gran: { value: 1 }, wash: { value: 1 }, seed: { value: Math.random() * 50 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
  fragmentShader: `uniform sampler2D tPic; uniform vec2 res; uniform float k, wob, bleed, edg, gran, wash, seed; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
    float fbm(vec2 p){ return vnoise(p) * 0.5 + vnoise(p * 2.03 + 7.1) * 0.3 + vnoise(p * 4.1 + 3.3) * 0.2; }
    void main(){
      vec2 px = 1.0 / res, p = vUv * res / min(res.x, res.y);
      // a slow wobble, as if the paper buckled where it got wet
      vec2 w = vec2(fbm(p * 5.0 + seed), fbm(p * 5.0 + seed + 17.3)) - 0.5;
      vec2 uv = vUv + w * 0.009 * wob * k;
      vec3 c = texture2D(tPic, uv).rgb;
      // bleeding: colour runs a couple of pixels into its neighbours, unevenly
      vec3 near = vec3(0.0), far = vec3(0.0);
      for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.7854 + hash(uv * 91.0 + float(i)) * 0.6;
        vec2 d = vec2(cos(a), sin(a));
        near += texture2D(tPic, uv + d * px * 2.6).rgb;
        far += texture2D(tPic, uv + d * px * 7.0).rgb;
      }
      near /= 8.0; far /= 8.0;
      c = mix(c, near, 0.35 * bleed * k);
      // pigment pools and dries darker along the inside edge of each wash (only where this spot is darker than its
      // surroundings, so the paper around a shape stays clean)
      float lumC = dot(c, vec3(0.299, 0.587, 0.114)), lumF = dot(far, vec3(0.299, 0.587, 0.114));
      float edge = clamp((lumF - lumC) * 4.5, 0.0, 1.0);
      c *= 1.0 - edge * 0.5 * edg * k;
      // granulation: grains of pigment settle into the paper's tooth, most of all in the darker washes
      float lum = dot(c, vec3(0.299, 0.587, 0.114));
      float g = vnoise(vUv * res / 1.8 + seed) * 0.55 + vnoise(vUv * res / 5.0 + seed * 2.0) * 0.45;
      c *= 1.0 - (g - 0.5) * 0.34 * gran * k * (1.15 - lum);
      // broad washes: some areas laid on thicker, some thinner
      float bl = fbm(p * 1.6 + seed * 3.0);
      c *= mix(1.0, 0.85 + 0.26 * bl, wash * k);
      // watercolour never reaches true black: the darks lift a little, as if diluted
      c = mix(c, c * 0.9 + 0.08, 0.25 * k);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
});
const paintScene = new THREE.Scene(), paintCam = new THREE.Camera();
const paintQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), paintMat); paintQuad.frustumCulled = false; paintScene.add(paintQuad);
function paintSize() {
  const v = renderer.getDrawingBufferSize(new THREE.Vector2());
  paintRT.setSize(v.x, v.y); paintMat.uniforms.res.value.copy(v);
}
function paintSettings() {
  const W = CFG.watercolour, u = paintMat.uniforms, c = x => Math.max(0, Math.min(2, +x || 0));
  u.k.value = c(W.strength); u.wob.value = c(W.wobble); u.bleed.value = c(W.bleed); u.edg.value = c(W.edges); u.gran.value = c(W.granulation); u.wash.value = c(W.wash);
}
function layerMicro() { if (!microOn()) return; renderer.autoClear = false; renderer.render(microScene, paintCam); if (bugGeo.instanceCount > 0 && microMat.uniforms.mode.value === 1) renderer.render(bugScene, paintCam); renderer.autoClear = true; }
function render() {
  if (envPeopleOn()) return renderPeopleOnTiles(); // people over the green tiles (transitions.js, 4b)
  renderer.setRenderTarget(null); renderer.render(scene, camera); layerMicro(); return; // no watercolour pass: the page is drawn as it is
  renderer.setRenderTarget(paintRT); renderer.render(scene, camera); layerMicro();
  renderer.setRenderTarget(null); renderer.render(paintScene, paintCam);
}
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h); paintSize();
  updateFrame(0, true); fitCamera();
  overlay.width = w * DPR2; overlay.height = h * DPR2; overlay.style.width = w + "px"; overlay.style.height = h + "px";
  U = Math.min(w, h);
}
const right2 = () => new THREE.Vector3(camR.x, 0, camR.z).normalize();

// ---------- a pencil overlay for the burst lines and the "Squish" note ----------
const overlay = document.getElementById("ink"), octx = overlay.getContext("2d");
const DPR2 = Math.min(devicePixelRatio || 1, 2);
let U = 400, boil = 0;
const hn = (a, b, c) => { const h = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return (h - Math.floor(h)) * 2 - 1; };
function pencil(pts, seed, w = 1.4, a = 0.75) {
  for (let pass = 0; pass < 2; pass++) {
    const J = pass ? 1.4 : 0.7;
    const q = pts.map((p, i) => [p[0] + hn(i, seed + pass * 7.3, boil) * J, p[1] + hn(i + 0.5, seed + pass * 7.3, boil + 3) * J]);
    octx.beginPath(); octx.moveTo(q[0][0], q[0][1]);
    for (let i = 1; i < q.length - 1; i++) octx.quadraticCurveTo(q[i][0], q[i][1], (q[i][0] + q[i + 1][0]) / 2, (q[i][1] + q[i + 1][1]) / 2);
    octx.lineTo(q[q.length - 1][0], q[q.length - 1][1]);
    octx.lineWidth = pass ? w * 0.6 : w; octx.strokeStyle = `rgba(52,53,58,${pass ? a * 0.45 : a})`; octx.stroke();
  }
}
function pline(x1, y1, x2, y2, seed, w, a) { const p = []; for (let i = 0; i <= 4; i++) p.push([x1 + (x2 - x1) * i / 4, y1 + (y2 - y1) * i / 4]); pencil(p, seed, w, a); }
const scr = new THREE.Vector3();
function toScreen(v) { scr.copy(v).project(camera); return [(scr.x + 1) / 2 * innerWidth, (1 - scr.y) / 2 * innerHeight]; }

// ---------- sound ----------
let AC = null, soundOn = true, noiseBuf = null;
function audio() {
  if (!soundOn) return null;
  try {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (AC.state === "suspended") AC.resume();
    if (!KNOCKS.loading) loadKnocks();
  } catch (e) { AC = null; }
  return AC;
}
// six single glass knocks
// six single glass knocks (knock 4 was two knocks, cut apart) and nine strikes cut from a wind-chime recording; and one
// long chime in D for the first cell
const KNOCK_FILES = ["knock1.mp3", "knock2.mp3", "knock3.mp3", "knock4a.mp3", "knock4b.mp3", "knock5.mp3",
  "chime1.mp3", "chime2.mp3", "chime3.mp3", "chime4.mp3", "chime5.mp3", "chime6.mp3", "chime7.mp3", "chime8.mp3", "chime9.mp3", "chime-d3.mp3", "crack.mp3"];
const N_KNOCK = 6, D3 = KNOCK_FILES.length - 2, CRACK = KNOCK_FILES.length - 1;
const KNOCKS = { bufs: KNOCK_FILES.map(() => null), next: 0, loading: false };
function loadKnocks() {
  KNOCKS.loading = true;
  KNOCK_FILES.forEach((f, i) => fetch(f).then(r => r.arrayBuffer()).then(b => new Promise((res, rej) => AC.decodeAudioData(b, res, rej))).then(buf => { KNOCKS.bufs[i] = buf; }).catch(() => {}));
}
function squeezeStart(o) {
  return; // the sliding noise under a squeeze is switched off
  const A = audio(); if (!A) return;
  const src = A.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = A.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 200; f.Q.value = 5;
  const g = A.createGain(); g.gain.value = 0;
  src.connect(f).connect(g).connect(A.destination); src.start(); o.snd = { src, f, g };
}
function squeezeUpdate(o) {
  if (!o.snd || !AC) return; const t = AC.currentTime;
  o.snd.f.frequency.setTargetAtTime(180 + 300 * o.p + 50 * Math.sin(t * 23), t, 0.03);
  o.snd.g.gain.setTargetAtTime(0.05 + 0.07 * Math.min(1, o.p), t, 0.05);
}
function squeezeStop(o) { if (!o.snd || !AC) return; const s = o.snd, t = AC.currentTime; o.snd = null; s.g.gain.setTargetAtTime(0, t, 0.04); s.src.stop(t + 0.3); }
// the long D chime, once, for the first cell as it splits
function chimeFirst() {
  const A = audio(), b = A && KNOCKS.bufs[D3]; if (!b) return;
  const src = A.createBufferSource(), g = A.createGain(); src.buffer = b; g.gain.value = 0.45;
  src.connect(g).connect(A.destination); src.start();
}
// one particular sound, by its place in KNOCK_FILES (0 is glass knock 1)
function playSound(i, gain = 0.32) {
  const A = audio(), b = A && KNOCKS.bufs[i]; if (!b) return false;
  const src = A.createBufferSource(), g = A.createGain(); src.buffer = b; g.gain.value = gain;
  src.connect(g).connect(A.destination); src.start(); KNOCKS.last = i; return true;
}
function pop() {
  const A = audio(); if (!A) return;
  // a glass knock picked at random (never the same one twice running), each a touch late, quieter or louder, higher or lower
  // than the last, so the knocks of a chain fall loosely, out of step, rather than in a tick-tock
  const ready = KNOCKS.bufs.map((b, i) => b ? i : -1).filter(i => i >= 0 && i !== KNOCKS.last && i < N_KNOCK); // splits: the glass knocks only (the chimes are kept aside)
  if (ready.length) {
    const i = ready[Math.floor(Math.random() * ready.length)]; KNOCKS.last = i;
    const src = A.createBufferSource(), g = A.createGain(); src.buffer = KNOCKS.bufs[i];
    src.playbackRate.value = 0.9 + Math.random() * 0.18; g.gain.value = (i < N_KNOCK ? 0.18 : 0.3) + Math.random() * 0.14;
    src.connect(g).connect(A.destination); src.start(A.currentTime + Math.random() * 0.16); return;
  }
  const t = A.currentTime, o = A.createOscillator(), g = A.createGain();
  o.frequency.setValueAtTime(560, t); o.frequency.exponentialRampToValueAtTime(100, t + 0.22);
  g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  o.connect(g).connect(A.destination); o.start(t); o.stop(t + 0.3);
}
function rustle(delay = 0.25) { // paper unfolding
  const A = audio(); if (!A) return; const t = A.currentTime + delay;
  const src = A.createBufferSource(); src.buffer = noiseBuf;
  const f = A.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 2500;
  const g = A.createGain(); g.gain.setValueAtTime(0, t);
  for (let i = 0; i < 6; i++) { g.gain.linearRampToValueAtTime(rnd(0.03, 0.09), t + i * 0.06 + 0.01); g.gain.linearRampToValueAtTime(0.005, t + i * 0.06 + 0.05); }
  src.connect(f).connect(g).connect(A.destination); src.start(t); src.stop(t + 0.45);
}
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

// ---------- the canvas and the buttons ----------
const cv = renderer.domElement;
cv.tabIndex = 0; cv.setAttribute("role", "img");
cv.setAttribute("aria-label", "A glassy cell sits on graph paper. Press and hold it to squeeze it until it divides and a folded paper creature unfolds out of it. Space bar presses the middle cell.");
const sndBtn = document.getElementById("snd");
sndBtn.addEventListener("click", () => {
  soundOn = !soundOn; sndBtn.textContent = soundOn ? "sound on" : "sound off"; sndBtn.setAttribute("aria-pressed", soundOn);
  if (!soundOn) for (const o of cells) squeezeStop(o); else audio();
});
