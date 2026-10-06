'use strict';

// World coordinates and input stay separate from visual rendering.
const CONFIG = { houseSpacing: 720, walkSpeed: 210, cameraResponse: 5, pixelsPerMetre: 64, enterDistance: 100 };
// Each stop maps to a section in resume-data.js.
const HOUSE_STOPS = [
  { id: 'about', label: 'About', side: 'left', color: '#d99468' },
  { id: 'skills', label: 'Skills', side: 'right', color: '#93b098' },
  { id: 'projects', label: 'Projects', side: 'left', color: '#a19ccc' },
  { id: 'experience', label: 'Experience', side: 'right', color: '#d3a857' },
  { id: 'education', label: 'Education', side: 'left', color: '#83b5bd' },
  { id: 'contact', label: 'Contact', side: 'right', color: '#d491a7' },
].map((stop, index) => ({ ...stop, distance: CONFIG.houseSpacing / 2 + index * CONFIG.houseSpacing, number: String(index + 1).padStart(2, '0') }));
CONFIG.roadLength = HOUSE_STOPS.length * CONFIG.houseSpacing;
const game = document.querySelector('#game');
const canvas = document.querySelector('#scene');
const sceneStatus = document.querySelector('#scene-status');
const distance = document.querySelector('#distance');
const journeyStatus = document.querySelector('#journey-status');
const enterPrompt = document.querySelector('#enter-prompt');
const panel = document.querySelector('#resume-panel');
const panelTitle = document.querySelector('#panel-title');
const panelNumber = document.querySelector('#panel-number');
const panelContent = document.querySelector('#panel-content');
const panelExitHint = document.querySelector('#panel-exit-hint');
const movementKeys = new Set(['arrowup', 'arrowdown', 'w', 's']);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const state = {
  keys: new Set(),
  player: { distance: 0, walking: false, direction: 1 },
  camera: { distance: 0 },
  viewport: { width: 0, height: 0 },
  visibleStop: null,
  nearbyStop: null,
  activeStop: null,
  lastTime: null,
};
let sceneView = null;

function handleKey(event, pressed) {
  const key = event.key.toLowerCase();
  if (!pressed) state.keys.delete(key);
  // Panel inputs retain their normal keyboard behavior.
  if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest?.('input, textarea, select, [contenteditable]')) return;

  if (pressed && ['arrowleft', 'arrowright', 'escape'].includes(key)) {
    event.preventDefault();
    if (event.repeat) return;
    if (state.activeStop) {
      const exitKey = state.activeStop.side === 'left' ? 'arrowright' : 'arrowleft';
      if (key === 'escape' || key === exitKey) closeSection();
    } else if (state.nearbyStop) {
      const entryKey = state.nearbyStop.side === 'left' ? 'arrowleft' : 'arrowright';
      if (key === entryKey) openSection(state.nearbyStop);
    }
    return;
  }

  if (!movementKeys.has(key) || state.activeStop) return;
  event.preventDefault();
  if (pressed) state.keys.add(key);
}

function clearInput() {
  state.keys.clear();
  state.lastTime = null;
  state.player.walking = false;
}

function resizeWorld() {
  state.viewport.width = game.clientWidth;
  state.viewport.height = game.clientHeight;
  sceneView?.resize(state.viewport.width, state.viewport.height);
  render();
}

function wrapDistance(value, length = CONFIG.roadLength) {
  // Positive modulo also supports walking backward through the loop's start.
  return ((value % length) + length) % length;
}

function getStopDistance(stop, reference = state.camera.distance) {
  // Place the closest copy of this house on an unlimited, repeating road.
  return stop.distance + Math.round((reference - stop.distance) / CONFIG.roadLength) * CONFIG.roadLength;
}

function update(deltaTime) {
  const forward = !state.activeStop && (state.keys.has('arrowup') || state.keys.has('w'));
  const backward = !state.activeStop && (state.keys.has('arrowdown') || state.keys.has('s'));
  const direction = Number(forward) - Number(backward);
  const previousDistance = state.player.distance;
  // Keep travel continuous so crossing the lap boundary never jumps the camera.
  state.player.distance = previousDistance + direction * CONFIG.walkSpeed * deltaTime;
  state.player.walking = state.player.distance !== previousDistance;
  if (state.player.walking) state.player.direction = direction;

  // Exponential following is independent of the monitor's frame rate.
  const follow = reducedMotion.matches ? 1 : 1 - Math.exp(-CONFIG.cameraResponse * deltaTime);
  state.camera.distance += (state.player.distance - state.camera.distance) * follow;
  if (Math.abs(state.player.distance - state.camera.distance) < 0.01) state.camera.distance = state.player.distance;
}

function renderHouse() {
  // Circular distances include About after Contact and Contact before About.
  const nearest = HOUSE_STOPS.reduce((closest, stop) => (
    Math.abs(getStopDistance(stop) - state.camera.distance) < Math.abs(getStopDistance(closest) - state.camera.distance) ? stop : closest
  ));
  if (state.visibleStop?.id !== nearest.id) {
    state.visibleStop = nearest;
    journeyStatus.textContent = `${nearest.number} / ${nearest.label} · ${nearest.side === 'left' ? 'Left' : 'Right'} side`;
  }
  return nearest;
}

function render(deltaTime = 0) {
  if (!sceneView) return;
  const stop = renderHouse();
  const signPosition = sceneView.render({
    travel: state.player.distance,
    cameraTravel: state.camera.distance,
    unitScale: 1 / CONFIG.pixelsPerMetre,
    stop,
    stopDistance: getStopDistance(stop),
    walking: state.player.walking,
    direction: state.player.direction,
    deltaTime,
    reduceMotion: reducedMotion.matches,
  });
  const metres = String(Math.floor(wrapDistance(state.player.distance) / CONFIG.pixelsPerMetre));
  if (distance.textContent !== metres) distance.textContent = metres;
  renderProximity(stop, signPosition);
}

function renderProximity(stop, signPosition) {
  const nearby = !state.activeStop && signPosition.visible
    && Math.abs(getStopDistance(stop, state.player.distance) - state.player.distance) <= CONFIG.enterDistance ? stop : null;
  if (nearby && nearby.id !== state.nearbyStop?.id) {
    const arrow = document.createElement('span');
    arrow.className = 'enter-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = nearby.side === 'left' ? '←' : '→';
    const action = document.createElement('span');
    action.className = 'enter-action-label';
    action.textContent = `Visit ${nearby.label}`;
    const actionVerb = window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(max-width: 700px)').matches ? 'Tap' : 'Press';
    enterPrompt.replaceChildren(`${actionVerb} `, arrow, ' to ', action);
    enterPrompt.dataset.side = nearby.side;
  }
  state.nearbyStop = nearby ?? null;
  enterPrompt.hidden = !nearby;
  if (nearby) {
    // Project the actual 3D sign, then keep its HTML hint inside the viewport.
    const margin = enterPrompt.offsetWidth / 2 + 12;
    enterPrompt.style.left = `${Math.max(margin, Math.min(state.viewport.width - margin, signPosition.x))}px`;
    enterPrompt.style.top = `${Math.max(135, Math.min(state.viewport.height - 120, signPosition.y - 12))}px`;
  }
}

function handleTouchMovement(event) {
  const key = event.currentTarget.dataset.movementKey;
  if (!key || state.activeStop) return;
  event.preventDefault();
  if (event.type === 'pointerdown') {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    state.keys.add(key);
  } else {
    state.keys.delete(key);
  }
}

function appendText(parent, tag, text, className = '') {
  const element = document.createElement(tag);
  element.textContent = text;
  element.className = className;
  parent.append(element);
  return element;
}

function renderResume(stop) {
  const section = RESUME_SECTIONS[stop.id];
  panelTitle.textContent = section.title;
  panelNumber.textContent = `${stop.number} / ${stop.label}`;
  const content = document.createDocumentFragment();
  appendText(content, 'p', section.intro, 'panel-intro');
  for (const block of section.blocks ?? []) {
    const article = document.createElement('article');
    article.className = 'resume-block';
    appendText(article, 'h3', block.title);
    if (block.meta) appendText(article, 'p', block.meta, 'resume-meta');
    if (block.description) appendText(article, 'p', block.description);
    if (block.items) {
      const list = document.createElement('ul');
      block.items.forEach((item) => appendText(list, 'li', item));
      article.append(list);
    }
    if (block.tags) {
      const tags = document.createElement('div');
      tags.className = 'resume-tags';
      block.tags.forEach((tag) => appendText(tags, 'span', tag));
      article.append(tags);
    }
    content.append(article);
  }
  for (const link of section.links ?? []) {
    const anchor = document.createElement('a');
    anchor.className = 'resume-link';
    anchor.href = link.href;
    appendText(anchor, 'span', link.label);
    anchor.append(link.text, ' ↗');
    if (link.href.startsWith('https://')) {
      anchor.target = '_blank';
      anchor.rel = 'noreferrer';
    }
    content.append(anchor);
  }
  panelContent.replaceChildren(content);
  panelContent.scrollTop = 0;
  panelExitHint.textContent = `Press Esc or ${stop.side === 'left' ? '→' : '←'} to return to the road.`;
}

function openSection(stop) {
  if (state.activeStop || !RESUME_SECTIONS[stop.id]) return;
  clearInput();
  state.activeStop = stop;
  // Lock the camera while reading; closing never changes the player's location.
  state.camera.distance = state.player.distance;
  renderResume(stop);
  panel.showModal();
  render();
}

function closeSection() {
  if (!state.activeStop) return;
  state.activeStop = null;
  clearInput();
  if (panel.open) panel.close();
  game.focus({ preventScroll: true });
  render();
}

function frame(time) {
  // Cap elapsed time to prevent jumps after a suspended tab or slow frame.
  const deltaTime = state.lastTime === null ? 0 : Math.min((time - state.lastTime) / 1000, 0.05);
  state.lastTime = time;
  update(deltaTime);
  render(deltaTime);
  requestAnimationFrame(frame);
}

async function initializeScene() {
  // Browsers block local ES-module imports on file:// pages.
  if (window.location.protocol === 'file:') {
    game.dataset.sceneState = 'local-file';
    sceneStatus.replaceChildren();
    appendText(sceneStatus, 'p', 'Start the preview server from the portfolio folder:');
    appendText(sceneStatus, 'code', 'python3 -m http.server 8000 --bind 127.0.0.1');
    const link = appendText(sceneStatus, 'a', 'Open the 3D portfolio');
    link.href = 'http://127.0.0.1:8000/';
    return;
  }

  let stage = 'load the Three.js modules';
  try {
    const { createWalkingScene } = await import('./scene.js');
    stage = 'start the WebGL renderer';
    sceneView = createWalkingScene(canvas, { stops: HOUSE_STOPS, roadLength: CONFIG.roadLength, unitScale: 1 / CONFIG.pixelsPerMetre });
    clearInput();
    stage = 'render the 3D world';
    resizeWorld();
    sceneStatus.hidden = true;
    game.dataset.sceneState = 'ready';
    requestAnimationFrame(frame);
  } catch (error) {
    sceneView?.dispose();
    sceneView = null;
    game.dataset.sceneState = 'error';
    sceneStatus.textContent = `Could not ${stage}: ${error.message || String(error)}. See the browser console for details.`;
    console.error('Unable to start the 3D walking world:', error);
  }
}

window.addEventListener('keydown', (event) => handleKey(event, true));
window.addEventListener('keyup', (event) => handleKey(event, false));
window.addEventListener('blur', clearInput);
window.addEventListener('resize', resizeWorld);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
game.addEventListener('pointerdown', () => {
  // Reading and clicking inside the modal should never refocus the game.
  if (!state.activeStop) game.focus({ preventScroll: true });
});
enterPrompt.addEventListener('click', () => {
  if (state.nearbyStop && !state.activeStop) openSection(state.nearbyStop);
});
document.querySelectorAll('[data-movement-key]').forEach((control) => {
  control.addEventListener('pointerdown', handleTouchMovement);
  control.addEventListener('pointerup', handleTouchMovement);
  control.addEventListener('pointercancel', handleTouchMovement);
  control.addEventListener('lostpointercapture', (event) => {
    const key = event.currentTarget.dataset.movementKey;
    if (key) state.keys.delete(key);
  });
});
document.querySelector('#panel-close').addEventListener('click', closeSection);
panel.addEventListener('cancel', (event) => { event.preventDefault(); closeSection(); });
// A queued close event must not close a different section opened meanwhile.
panel.addEventListener('close', () => { if (!panel.open) closeSection(); });
resizeWorld();
initializeScene();
