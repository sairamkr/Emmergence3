// ====================================================================================================================
// SHADER: the one full-screen shader that draws the cells, the grey, the jali and the map. Each sequence keeps its own
// piece (the GLSL_* strings and *_UNIFORMS in its file); here they are put together, in this order. The uniform
// declarations for every piece are in GLSL_DECLARATIONS below.
// ====================================================================================================================
// shared declarations: every uniform any piece uses, noise, colours
const GLSL_DECLARATIONS = `uniform sampler2D field; uniform sampler2D maps; uniform vec2 res; uniform float dpr; uniform int mode; uniform int n;
    uniform vec4 A[${MICRO_MAX}]; uniform vec4 B[${MICRO_MAX}];
    uniform vec2 centre; uniform float rin, rout, rim; uniform vec2 orbC; uniform float orbR, k, tissueA, bgA, seed, tile, dissolve; uniform float wrap; uniform float cellR; uniform sampler2D delhi, delhi1950, headT, jali1, jali2; uniform vec4 rev, zoomL; uniform float fillAmt, tm, torn, gray, jaliT, jaliS, jaliR, jaliI, jaliSweep, jStage; uniform sampler2D jaliFull; uniform vec2 jaliP, jaliPs; uniform vec2 crackP[8]; uniform vec2 crackC[5]; uniform sampler2D jaliOld; uniform sampler2D jaliFine, jaliRock; uniform vec3 jCam; uniform vec4 jFineR[${FINE.length}]; uniform vec2 jFineN[${FINE.length}]; uniform vec4 jRock; uniform int pcN; uniform float jPan, jN; uniform vec4 pcR[16]; uniform vec4 pcA[16]; uniform float pcS[16]; uniform vec3 bgCol;
    uniform vec4 win; uniform float mapOff, cutR, cutA, cutP, hole, lift; uniform vec2 cutC;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
    // colours from an old cover: ochre laid paper, a flat olive cell, pale threads in it, and a red dot at each pole
    const vec3 SLIDE = vec3(0.018, 0.016, 0.015), PLASM = vec3(0.604, 0.659, 0.243), INK = vec3(0.231, 0.141, 0.075);
    const vec3 THREAD = vec3(0.843, 0.851, 0.490), RIM = vec3(0.494, 0.553, 0.180), DOT = vec3(0.776, 0.125, 0.122);
    // the cells themselves: cut paper discs, olive, a dark pencil outline, an old map of Delhi showing through,
    // white threads, a checkerboard nucleus and red beans
    const vec3 OLIVE = vec3(0.84, 0.80, 0.68), OUTL = vec3(0.47, 0.45, 0.42), WHITE = vec3(0.985, 0.98, 0.965);
    const vec3 BEAN = vec3(0.788, 0.298, 0.282), BEANL = vec3(0.86, 0.43, 0.40), CHK = vec3(0.09, 0.08, 0.08), CREAM = vec3(0.93, 0.91, 0.84);
    vec2 rot2(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c * v.x + s * v.y, -s * v.x + c * v.y); }
    uniform sampler2D envOlive; uniform vec4 jStrip; uniform float envWhite; uniform vec2 envView; uniform float envTileN; uniform vec4 envTiles[${TILE_MAX}]; uniform vec4 envTileUV[${TILE_MAX}];   // transition 4, jali -> environment`;
const GLSL_HELPERS = `    float lines(vec2 q, float th){ float v = texture2D(field, q).r; float aa = max(fwidth(v) * 0.75, 0.01); return smoothstep(th - aa, th + aa, v); }
    // an image laid over the whole screen (cover-fitted), a little enlarged by z
    vec2 cover(vec2 sp, float asp, float z){ float sc = max(win.z / asp, win.w) * z; return (sp - win.xy - win.zw * 0.5) / (vec2(asp, 1.0) * sc) * vec2(1.0, -1.0) + 0.5; }`;
const GLSL_MAP_AT = `    vec3 mapAt(vec2 q){ vec2 uv = clamp((q - win.xy) / win.zw, 0.0, 1.0); return texture2D(delhi, vec2(uv.x, 1.0 - uv.y)).rgb; }`;
const GLSL_MAIN_OPEN = `    void main(){
      vec2 sp = vec2(gl_FragCoord.x / dpr, res.y - gl_FragCoord.y / dpr);   // this pixel, in screen points
      vec4 cellB = vec4(0.0); float cellIn = 0.0, cellWall = 0.0, cellM = 1.0; vec2 cellC = vec2(-1e5);`;
const GLSL_MAIN_VIEW = `      float inCircle = 1.0 - smoothstep(orbR - 1.5, orbR + 1.5, distance(sp, orbC));
      vec2 p = centre + (sp - orbC) / k;                                    // where it falls in the tissue, as the view pulls back
      vec3 col = paper(sp), lc = THREAD; float ink = 0.0;`;
const GLSL_MAIN_MIX = `      vec3 c = mix(col, lc, ink);
      float a = mix(bgA, tissueA, inCircle);`;
const GLSL_MAIN_CIRCLE = `      c = mix(paper(sp), c, inCircle);`;
const GLSL_MAIN_CLOSE = `      gl_FragColor = vec4(c, a);
    }`;

const SHARED_UNIFORMS = {
  field: { value: inkField },
  res: { value: new THREE.Vector2(1, 1) },
  dpr: { value: 1 },
  mode: { value: 0 },
  centre: { value: new THREE.Vector2() },
  orbC: { value: new THREE.Vector2() },
  orbR: { value: 1e5 },
  k: { value: 1 },
  win: { value: new THREE.Vector4(0, 0, 1, 1) },
  tissueA: { value: 1 },
  bgA: { value: 1 },
  seed: { value: 0 },
  tile: { value: 230 },
  tm: { value: 0 },
  delhi: { value: DELHI_PLAIN },
  bgCol: { value: new THREE.Color(0x050403) },
};
const microMat = new THREE.ShaderMaterial({
  transparent: true, depthTest: false, depthWrite: false,
  uniforms: Object.assign({}, SHARED_UNIFORMS, CELL_UNIFORMS, JALI_UNIFORMS, TRANSITION_UNIFORMS, ENV_UNIFORMS),
  vertexShader: "void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }",
  fragmentShader: [
  GLSL_DECLARATIONS,         // shader
  GLSL_CELL_COLOUR,          // cell
  GLSL_HELPERS,              // shader
  GLSL_TO_ENV_FRONT,         // transitions
  GLSL_CELL_PAPER,           // cell
  GLSL_MAP_AT,               // shader
  GLSL_MAIN_OPEN,            // shader
  GLSL_CELL_CARD,            // cell
  GLSL_ENV_MAP,              // environment
  GLSL_MAIN_VIEW,            // shader
  GLSL_CELL_INTRO,           // cell
  GLSL_CELL_TISSUE,          // cell
  GLSL_MAIN_MIX,             // shader
  GLSL_TO_ENV_REVEAL,        // transitions
  GLSL_MAIN_CIRCLE,          // shader
  GLSL_CELLS_TO_JALI_GREY,   // transitions
  GLSL_JALI,                 // jali
  GLSL_JALI_TO_ENV,          // transitions
  GLSL_MAIN_CLOSE,           // shader
  ].join("\n"),
  extensions: { derivatives: true, shaderTextureLOD: true },
});
const microScene = new THREE.Scene();
const microQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), microMat); microQuad.frustumCulled = false; microScene.add(microQuad);
