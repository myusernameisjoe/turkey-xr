import * as THREE from 'three';
import { DEFAULTS, createTurkey, stepTurkey, isTouching, catchTurkey } from './turkeyBrain.js';
import { createTurkeyModel } from './turkeyModel.js';
import { createYard, createAreaRing } from './yard.js';
import { renderGobbleBuffer, renderChimeBuffer } from './audio.js';
import { createTextPanel } from './hud.js';

const params = new URLSearchParams(location.search);
const cfg = { ...DEFAULTS };
if (params.has('area')) {
  const a = parseFloat(params.get('area'));
  if (a >= 2 && a <= 50) cfg.areaRadius = a;
}

// Optional in-page headset emulator (no Quest or browser extension needed).
if (params.has('emulate')) {
  const { installEmulator } = await import('./emulator.js');
  await installEmulator();
}

// ---------- Scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const skyColor = new THREE.Color(0x9fd3f0);
scene.background = skyColor;
scene.fog = new THREE.Fog(0x9fd3f0, 25, 60);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 200);
camera.position.set(0, 3.2, cfg.areaRadius + 3);
camera.lookAt(0, 0, 0);
scene.add(camera);

scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x4a5a2a, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(4, 8, 3);
scene.add(sun);

const yard = createYard(cfg.areaRadius);
scene.add(yard);
scene.add(createAreaRing(cfg.areaRadius));

const turkeyState = createTurkey(cfg);
const turkeyModel = createTurkeyModel();
scene.add(turkeyModel.root);

// ---------- Audio ----------
const listener = new THREE.AudioListener();
camera.add(listener);
const gobble = new THREE.PositionalAudio(listener);
gobble.setRefDistance(1.5);
gobble.setRolloffFactor(1.2);
turkeyModel.root.add(gobble);
const chime = new THREE.Audio(listener);
let audioReady = false;
async function initAudio() {
  if (audioReady) return;
  audioReady = true;
  try {
    await listener.context.resume();
    gobble.setBuffer(await renderGobbleBuffer());
    chime.setBuffer(await renderChimeBuffer());
    chime.setVolume(0.6);
  } catch (e) {
    console.warn('audio unavailable', e);
  }
}
function playGobble() {
  if (gobble.buffer && !gobble.isPlaying) {
    gobble.setPlaybackRate(0.9 + Math.random() * 0.25);
    gobble.play();
  }
}

// ---------- Controllers ----------
const hands = [];
const handMat = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0x553300, roughness: 0.4 });
for (let i = 0; i < 2; i++) {
  const grip = renderer.xr.getControllerGrip(i);
  const mitt = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), handMat);
  grip.add(mitt);
  const hand = { grip, inputSource: null, worldPos: new THREE.Vector3() };
  grip.addEventListener('connected', (e) => {
    hand.inputSource = e.data;
    if (e.data.handedness === 'left') grip.add(wristPanel.mesh);
  });
  grip.addEventListener('disconnected', () => {
    hand.inputSource = null;
    if (wristPanel.mesh.parent === grip) grip.remove(wristPanel.mesh);
  });
  scene.add(grip);
  hands.push(hand);
}

const wristPanel = createTextPanel();
wristPanel.mesh.position.set(0, 0.06, 0.05);
wristPanel.mesh.rotation.x = -0.9;

function pulse(inputSource, intensity, ms) {
  try {
    const gp = inputSource?.gamepad;
    if (gp?.hapticActuators?.[0]?.pulse) gp.hapticActuators[0].pulse(intensity, ms);
    else gp?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: intensity });
  } catch {
    /* haptics are optional */
  }
}

// Floating "+1" banner over the turkey when caught.
const banner = createTextPanel(0.5, 0.18);
banner.mesh.visible = false;
scene.add(banner.mesh);

// ---------- Game state ----------
const game = {
  score: 0,
  mode: 'preview', // preview | vr | ar
  startedAt: 0,
  turkey: turkeyState,
  hands: [],
  cfg,
};
window.__game = game; // read by the automated tests

const scoreEl = document.getElementById('score');
function updateScore() {
  wristPanel.setText(`${game.score}`, game.score === 1 ? 'turkey caught' : 'turkeys caught');
  scoreEl.textContent = `Caught: ${game.score}`;
}
updateScore();

// ---------- Sessions ----------
const arBtn = document.getElementById('enter-ar');
const vrBtn = document.getElementById('enter-vr');
const statusEl = document.getElementById('status');

async function setupButtons() {
  if (!('xr' in navigator)) {
    statusEl.textContent = 'WebXR is not available in this browser. Open this page in the Quest Browser, or add ?emulate to the URL.';
    return;
  }
  const [ar, vr] = await Promise.all([
    navigator.xr.isSessionSupported('immersive-ar').catch(() => false),
    navigator.xr.isSessionSupported('immersive-vr').catch(() => false),
  ]);
  arBtn.disabled = !ar;
  vrBtn.disabled = !vr;
  if (!ar && !vr) statusEl.textContent = 'No headset found. On desktop, add ?emulate to the URL to use the built-in emulator.';
  else if (!ar) statusEl.textContent = 'Passthrough (AR) not available here; VR yard mode only.';
}
setupButtons();

async function start(mode) {
  await initAudio();
  const session = await navigator.xr.requestSession(mode === 'ar' ? 'immersive-ar' : 'immersive-vr', {
    requiredFeatures: ['local-floor'],
  });
  game.mode = mode;
  yard.visible = mode === 'vr';
  scene.background = mode === 'ar' ? null : skyColor;
  scene.fog = mode === 'ar' ? null : scene.fog;
  renderer.setClearColor(0x000000, mode === 'ar' ? 0 : 1);
  session.addEventListener('end', () => {
    game.mode = 'preview';
    yard.visible = true;
    scene.background = skyColor;
    scene.fog = new THREE.Fog(0x9fd3f0, 25, 60);
    document.body.classList.remove('in-xr');
  });
  await renderer.xr.setSession(session);
  document.body.classList.add('in-xr');
  game.startedAt = performance.now();
}
arBtn.addEventListener('click', () => start('ar').catch((e) => (statusEl.textContent = `Could not start AR: ${e.message}`)));
vrBtn.addEventListener('click', () => start('vr').catch((e) => (statusEl.textContent = `Could not start VR: ${e.message}`)));

// ---------- Loop ----------
const clock = new THREE.Clock();
const headPos = new THREE.Vector3();
let nextGobble = 4;
let lastMode = turkeyState.mode;
let previewAngle = 0;

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);

  // Where is the player?
  if (renderer.xr.isPresenting) {
    renderer.xr.getCamera().getWorldPosition(headPos);
  } else {
    previewAngle += dt * 0.08;
    const r = cfg.areaRadius + 3;
    camera.position.set(Math.sin(previewAngle) * r, 3.2, Math.cos(previewAngle) * r);
    camera.lookAt(0, 0.3, 0);
    camera.getWorldPosition(headPos);
  }

  stepTurkey(turkeyState, { x: headPos.x, z: headPos.z }, dt, cfg);

  // Catch check.
  game.hands = [];
  for (const hand of hands) {
    if (!hand.inputSource) continue;
    hand.grip.getWorldPosition(hand.worldPos);
    game.hands.push({ x: hand.worldPos.x, y: hand.worldPos.y, z: hand.worldPos.z });
    if (isTouching(turkeyState, hand.worldPos, cfg)) {
      catchTurkey(turkeyState, cfg);
      game.score++;
      updateScore();
      pulse(hand.inputSource, 1, 250);
      playGobble();
      if (chime.buffer) chime.play();
      banner.setText('Gotcha!', `${game.score} caught`);
      banner.mesh.visible = true;
    }
  }

  // Gobble when it starts running, and now and then while wandering.
  if (turkeyState.mode === 'flee' && lastMode !== 'flee') playGobble();
  nextGobble -= dt;
  if (nextGobble <= 0) {
    playGobble();
    nextGobble = 6 + Math.random() * 8;
  }
  lastMode = turkeyState.mode;

  turkeyModel.animate(turkeyState, dt);

  if (banner.mesh.visible) {
    banner.mesh.position.set(turkeyState.x, 1.0, turkeyState.z);
    banner.mesh.lookAt(headPos);
    if (turkeyState.mode !== 'caught') banner.mesh.visible = false;
  }

  renderer.render(scene, camera);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
