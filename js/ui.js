// ====================================================================================================================
// UI: the "edit" settings panel, and the hint line that dissolves in under the card.
// ====================================================================================================================
// ---------- the settings panel ----------
function applySettings(next, keep = true) {
  CFG = fit(DEFAULTS, next);
  Object.assign(DISSOLVE, CFG.reveal); CFG.reveal = DISSOLVE;       // the reveal settings are shared by reference
  FUSE_N = Math.max(2, Math.min(8, Math.round(CFG.people.gatherAtCount)));
  paintSettings();
  const u = inkMat.uniforms; u.tile.value = Math.max(1, CFG.ink.patternSize); u.thick.value = Math.max(0, Math.min(1, CFG.ink.lineThickness));
  try { u.ink.value.set(CFG.ink.colour); } catch (e) {}
  if (keep) try { localStorage.setItem(CFG_KEY, JSON.stringify(CFG)); } catch (e) {} // only your own edits are kept, so new defaults still reach you
}
{
  const panel = document.getElementById("cfg"), text = document.getElementById("cfgText"), msg = document.getElementById("cfgMsg"), btn = document.getElementById("cfgBtn");
  const say = (t, bad) => { msg.textContent = t; msg.classList.toggle("bad", !!bad); };
  // ---- percentages: a slider for each share, with the real percentage it works out to shown beside it ----
  const odds = document.getElementById("cfgOdds"), jsonTab = document.getElementById("cfgJson");
  const NAMES = { tree: "Tree", finial: "Ivory finial", house: "Clay house", arcade: "Arcade", minaret: "Red minaret", ruin: "Broken wall", rampart: "Battlement", gate: "Gateway", cupola: "Cupola", kiosk: "Kiosk", bay: "Window bay", arcadeWall: "Arcade wall", wingL: "Left wing", wingR: "Right wing", tower: "Grey minaret", iwan: "Great doorway", domeTop: "Dome" };
  const TINT = { tree: "#5c7a55", finial: "#e8dcc0", house: "#c46b3c", arcade: "#b08a52", minaret: "#8f3b33", ruin: "#d9b98a", rampart: "#7d5f48", gate: "#d48f86", cupola: "#cfc9bf", kiosk: "#9a958d", bay: "#7a756e", arcadeWall: "#55524d", wingL: "#b5b0a8", wingR: "#8c877f", tower: "#e3ddd2", iwan: "#3f3c38", domeTop: "#2c2a27" };
  const GROUPS = []; // (the old building odds are gone: every building is the collage)
  const CHANCES = [
    [() => CFG.watercolour, "strength", "Watercolour", "How strongly the watercolour is painted over everything. The finer controls are in All settings."],
    ...!TALK_ON ? [] : [[() => CFG.speech, "onSplit", "Talk: split", "How often someone speaks when the circle splits or a person pops."]],
    ...!TALK_ON ? [] : [[() => CFG.speech, "onBuilding", "Talk: building", "How often whoever is nearest remarks on a building as it rises."]],
    ...!TALK_ON ? [] : [[() => CFG.speech, "replyChance", "Replies", "How often somebody nearby answers."]],
  ];
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const rows = [];
  function buildOdds() {
    odds.textContent = ""; rows.length = 0;
    for (const [key, title, note] of GROUPS) {
      odds.appendChild(el("h3", "", title)); if (note) odds.appendChild(el("p", "note", note));
      const bar = el("div", "bar"); bar.setAttribute("aria-hidden", "true"); odds.appendChild(bar);
      const group = { key, bar, items: [] };
      for (const kind of Object.keys(NAMES)) {
        if (!(kind in CFG.buildings[key])) continue;
        const row = el("div", "odd"), id = `odd-${key}-${kind}`, lab = el("label", "", NAMES[kind]), inp = el("input"), out = el("output");
        lab.htmlFor = id; inp.id = id; inp.type = "range"; inp.min = 0; inp.max = 100; inp.step = 1; out.htmlFor = id;
        const seg = el("i"); seg.style.background = TINT[kind]; bar.appendChild(seg);
        inp.addEventListener("input", () => { CFG.buildings[key][kind] = +inp.value / 100; applySettings(CFG); syncOdds(); say("applied"); });
        row.append(lab, inp, out); odds.appendChild(row); group.items.push({ kind, row, inp, out, seg });
      }
      rows.push(group);
    }
    odds.appendChild(el("h3", "", "Chances"));
    for (const [obj, prop, name, note] of CHANCES) {
      const row = el("div", "odd"), id = `chance-${prop}`, lab = el("label", "", name), inp = el("input"), out = el("output");
      lab.htmlFor = id; inp.id = id; inp.type = "range"; inp.min = 0; inp.max = 100; inp.step = 1; out.htmlFor = id;
      inp.addEventListener("input", () => { obj()[prop] = +inp.value / 100; applySettings(CFG); syncOdds(); say("applied"); });
      row.append(lab, inp, out); odds.appendChild(row); odds.appendChild(el("p", "note", note));
      rows.push({ chance: true, obj, prop, inp, out });
    }
  }
  function syncOdds() {
    for (const g of rows) {
      if (g.chance) { const v = Math.max(0, Math.min(1, g.obj()[g.prop])); if (document.activeElement !== g.inp) g.inp.value = Math.round(v * 100); g.out.textContent = Math.round(v * 100) + "%"; continue; }
      const shares = CFG.buildings[g.key], sum = g.items.reduce((a, it) => a + Math.max(0, shares[it.kind]), 0);
      for (const it of g.items) {
        const s = Math.max(0, shares[it.kind]), pct = sum > 0 ? s / sum * 100 : 0;
        if (document.activeElement !== it.inp) it.inp.value = Math.round(Math.min(1, s) * 100);
        it.out.textContent = (pct > 0 && pct < 1 ? "<1" : Math.round(pct)) + "%"; it.row.classList.toggle("off", s <= 0); it.seg.style.width = pct + "%";
      }
    }
  }
  const tabs = [[document.getElementById("tabOdds"), odds], [document.getElementById("tabJson"), jsonTab]];
  const pickTab = which => tabs.forEach(([t, p], i) => { t.setAttribute("aria-selected", i === which); p.hidden = i !== which; if (i === which && i === 1) text.value = JSON.stringify(CFG, null, 2); if (i === which && i === 0) syncOdds(); });
  tabs.forEach(([t], i) => t.addEventListener("click", () => pickTab(i)));
  const show = () => { text.value = JSON.stringify(CFG, null, 2); syncOdds(); say("changes apply at once and are kept in this browser"); };
  const open = on => { panel.classList.toggle("open", on); btn.setAttribute("aria-expanded", on); if (on) show(); };
  btn.addEventListener("click", () => open(!panel.classList.contains("open")));
  document.getElementById("cfgClose").addEventListener("click", () => { open(false); btn.focus(); });
  let timer = 0;
  text.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      let parsed; try { parsed = JSON.parse(text.value); } catch (e) { return say("not valid JSON yet: " + e.message.replace(/^JSON\.parse: /, ""), true); }
      applySettings(parsed); syncOdds();
      say(JSON.stringify(parsed) === JSON.stringify(CFG) ? "applied" : "applied · anything left out, unknown or of the wrong type keeps its default");
    }, 350);
  });
  document.getElementById("cfgCopy").addEventListener("click", async () => {
    const out = JSON.stringify(CFG, null, 2);
    try { await navigator.clipboard.writeText(out); say("copied: paste it to Claude to bake in"); }
    catch (e) { text.value = out; text.focus(); text.select(); say("select all and copy from the box"); }
  });
  document.getElementById("cfgReset").addEventListener("click", () => { applySettings(DEFAULTS, false); try { localStorage.removeItem(CFG_KEY); } catch (e) {} show(); say("back to defaults"); });
  applySettings(CFG, false); // saved settings from an earlier visit take effect at start
  buildOdds(); syncOdds();
}
const hintEl = document.getElementById("hint");
let hintT = 0;
// Text arrives the way the Draw Reveal project's TextDissolveIn does it: letters materialise in a scattered order, the
// corners of each letter appear at slightly different moments (ragged, ink-like edges), and each letter settles from a
// little larger and lower into place. Same settings as that script's defaults.
function dissolveIn(el, text) {
  const run = el._run = (el._run || 0) + 1; el.textContent = ""; el.setAttribute("aria-label", text);
  const letters = [], D = DISSOLVE, spread = Math.max(0, D.duration - D.letterFade);
  text.split(" ").forEach((word, wi, all) => {
    const w = document.createElement("span"); w.className = "w"; w.setAttribute("aria-hidden", "true");
    for (const ch of word) {
      const l = document.createElement("span"); l.className = "l"; l.textContent = ch; l.style.opacity = 0; w.appendChild(l);
      const when = Math.random() * spread; // scattered order
      letters.push({ l, start: [0, 1, 2, 3].map(() => when + Math.random() * D.edgeRaggedness * D.letterFade * 0.8) }); // bottom-left, top-left, top-right, bottom-right
    }
    el.appendChild(w); if (wi < all.length - 1) el.appendChild(document.createTextNode(" "));
  });
  const t0 = performance.now() / 1000 + D.delay;
  const finish = () => { for (const L of letters) { L.l.style.opacity = ""; L.l.style.transform = ""; L.l.style.maskImage = L.l.style.webkitMaskImage = ""; } };
  if (reduced) return finish();
  const step = () => {
    if (run !== el._run || !el.isConnected) return;
    const now = performance.now() / 1000 - t0;
    if (now > D.duration + D.letterFade + 0.1) return finish();
    for (const L of letters) {
      const a = L.start.map(s => smooth((now - s) / D.letterFade)), avg = (L.start[0] + L.start[1] + L.start[2] + L.start[3]) / 4;
      const letter = smooth((now - avg) / D.letterFade);
      const scale = D.startScale + (1 - D.startScale) * letter, drop = D.riseFrom * (1 - letter);
      L.l.style.opacity = 1; L.l.style.transform = `translateY(${drop.toFixed(3)}em) scale(${scale.toFixed(3)})`;
      // the four corner strengths, drawn as a gradient across the letter
      const gx = (a[2] + a[3] - a[0] - a[1]) / 2, gy = (a[1] + a[2] - a[0] - a[3]) / 2;
      const ang = Math.hypot(gx, gy) < 1e-3 ? 0 : Math.atan2(gx, gy) * 180 / Math.PI, lo = Math.min(...a), hi = Math.max(...a);
      const m = `linear-gradient(${ang.toFixed(0)}deg, rgba(0,0,0,${lo.toFixed(3)}), rgba(0,0,0,${hi.toFixed(3)}))`;
      L.l.style.maskImage = m; L.l.style.webkitMaskImage = m;
    }
    requestAnimationFrame(step);
  };
  step();
}
function hint(text) { if (text) dissolveIn(hintEl, text); hintEl.style.opacity = text ? 1 : 0; hintT = text ? 6 : 0; }
