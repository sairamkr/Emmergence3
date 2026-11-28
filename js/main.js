// ====================================================================================================================
// MAIN: start over, the frame loop, and the start.
// Each frame: the card, the camera, the cell sequence (which runs the jali sequence and the transitions), the
// environment, then everything is painted.
// ====================================================================================================================
function reset() {
  for (const o of [...cells]) disposeCell(o);
  for (const m of [...meetings]) endMeeting(m);
  for (const c of [...creatures]) removeCreature(c);
  clearStains();
  bursts.length = 0; fusions.length = 0; splits = 0; window.__lifeN = 0; clearInk(); clearCaptions(); clearTalk();
  startMicro(); // the paper is empty until the opening is done; then a person walks in // every start opens under the microscope
}
document.getElementById("again").addEventListener("click", reset);
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; simT += dt;
  boil = reduced ? 0 : Math.floor(simT * 7);
  updateFrame(dt); fitCamera(); updateMapBeast(dt);
  updateMicro(dt); updateArrival(dt);
  if (hintT > 0 && splits > 0 && (hintT -= dt) <= 0) hintEl.style.opacity = 0;
  updateEnvironment(dt);                 // ENVIRONMENT SEQUENCE (environment-sequence.js)
  render();

  // pencil overlay
  octx.setTransform(DPR2, 0, 0, DPR2, 0, 0); octx.clearRect(0, 0, innerWidth, innerHeight);
  octx.lineCap = octx.lineJoin = "round";
  drawEnvironmentOverlay(dt);
  requestAnimationFrame(frame);
}
addEventListener("resize", resize);
loadMaps().then(() => {
  document.getElementById("loading").remove();
  resize(); reset();
  requestAnimationFrame(t => { last = t; frame(t); });
});
