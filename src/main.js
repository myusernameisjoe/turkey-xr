import * as THREE from 'three';
import { DEFAULTS, EASY, createTurkey, stepTurkey, isTouching, catchTurkey, stunTurkey } from './turkeyBrain.js';
import { createTurkeyModel } from './turkeyModel.js';
import { createYard, createAreaRing } from './yard.js';
import { createRig, stepRig } from './locomotion.js';
import { renderGobbleBuffer, renderChimeBuffer, renderBonkBuffer } from './audio.js';
import { createTextPanel } from './hud.js';
import { ITEMS, getItem } from './items/index.js';
import { UNLOCKS } from './unlocks.js';
import { createProgress } from './progress.js';
import { createBoard } from './board.js';

const params = new URLSearchParams(location.search);
const cfg = { ...DEFAULTS };
const easy = params.has('easy') || (params.has('emulate') && !params.has('hard'));
if (easy) Object.assign(cfg, EASY);
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

// The player's "rig": the head (camera) and both hands ride on it.
// Moving or turning the rig moves the player through the fake yard (joysticks).
const rig = new THREE.Group();
rig.add(camera);
scene.add(rig);

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
const bonk = new THREE.Audio(listener);
let audioReady = false;
async function initAudio() {
  if (audioReady) return;
  audioReady = true;
  try {
    await listener.context.resume();
    gobble.setBuffer(await renderGobbleBuffer());
    chime.setBuffer(await renderChimeBuffer());
    chime.setVolume(0.6);
    bonk.setBuffer(await renderBonkBuffer());
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
const raycaster = new THREE.Raycaster();
const gazeOrigin = new THREE.Vector3();
const gazeDir = new THREE.Vector3();
function gazeHit() {
  const cam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
  cam.getWorldPosition(gazeOrigin);
  cam.getWorldDirection(gazeDir);
  raycaster.set(gazeOrigin, gazeDir);
  return raycaster.intersectObject(board.mesh)[0] || null;
}
// Small dot showing where you're looking on the board.
const reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.006, 0.012, 20),
  new THREE.MeshBasicMaterial({ color: 0xff5a36, depthTest: false }),
);
reticle.renderOrder = 1000;
reticle.visible = false;
let itemHand = null; // the hand that holds the equipped item (right if present)
const handMat = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0x553300, roughness: 0.4 });
for (let i = 0; i < 2; i++) {
  const grip = renderer.xr.getControllerGrip(i);
  const mitt = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), handMat);
  grip.add(mitt);
  const pointer = renderer.xr.getController(i); // target-ray space, for pointing at the board
  const ray = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -3)]),
    new THREE.LineBasicMaterial({ color: 0xffd166 }),
  );
  ray.visible = false;
  pointer.add(ray);
  const hand = { grip, pointer, ray, inputSource: null, worldPos: new THREE.Vector3(), aWasDown: false };
  grip.addEventListener('connected', (e) => {
    hand.inputSource = e.data;
    if (e.data.handedness === 'left') grip.add(wristPanel.mesh);
    if (e.data.handedness === 'right' || !itemHand) itemHand = hand;
    equipItem(progress.equipped);
  });
  grip.addEventListener('disconnected', () => {
    hand.inputSource = null;
    if (wristPanel.mesh.parent === grip) grip.remove(wristPanel.mesh);
  });
  pointer.addEventListener('select', () => {
    if (!board.isOpen) return;
    // Try where the controller points first, then where the player is looking
    // (look-and-click is much easier in the desktop emulator).
    raycaster.setFromXRController(pointer);
    let hit = raycaster.intersectObject(board.mesh)[0];
    if (!hit) hit = gazeHit();
    if (hit?.uv && board.selectUV(hit.uv)) pulse(hand.inputSource, 0.3, 40);
  });
  rig.add(grip, pointer);
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

// ---------- Items & unlocks ----------
const progress = createProgress(UNLOCKS);
if (params.has('reset')) progress.reset();
let item = null; // { def, instance }
function equipItem(id) {
  const def = getItem(id);
  if (item?.def === def && (item.instance || !def.create)) return;
  item?.instance?.dispose();
  item = { def, instance: def.create ? def.create(scene) : null };
  game.equipped = def.id;
  game.item = item;
  updateScore();
}
const board = createBoard({ items: ITEMS, progress, onEquip: equipItem });
scene.add(board.mesh, reticle);
const headQuat = new THREE.Quaternion();
function toggleBoard() {
  if (board.isOpen) board.close();
  else {
    renderer.xr.getCamera().getWorldQuaternion(headQuat);
    board.open(headPos, headQuat);
  }
}
game.progress = progress;
game.board = board;
game.toggleBoard = toggleBoard;
game.equipped = progress.equipped;

const scoreEl = document.getElementById('score');
function updateScore() {
  wristPanel.setText(`${game.score} caught`, 'Press A or X for items');
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
    resetRig();
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

function onCatch(hand, itemName) {
  catchTurkey(turkeyState, cfg);
  game.score++;
  game.lastCatchBy = itemName || 'hands';
  updateScore();
  pulse(hand.inputSource, 1, 250);
  playGobble();
  if (chime.buffer) chime.play();
  // Catching turkeys unlocks items (see src/unlocks.js). A new item goes straight into your hand.
  const unlocked = progress.recordCatch();
  if (unlocked.length) {
    const def = getItem(unlocked[unlocked.length - 1]);
    if (progress.equip(def.id)) equipItem(def.id);
    banner.setText('New item!', def.name);
    game.lastUnlock = def.id;
  } else {
    banner.setText('Gotcha!', `${game.score} caught`);
  }
  banner.mesh.visible = true;
  board.refresh();
}

function onStun(hand, def) {
  hand.grip.getWorldPosition(hand.worldPos);
  if (!stunTurkey(turkeyState, hand.worldPos.x, hand.worldPos.z, def.stunSeconds, def.knockback)) return;
  game.stuns = (game.stuns || 0) + 1;
  pulse(hand.inputSource, 0.8, 120);
  if (bonk.buffer) {
    if (bonk.isPlaying) bonk.stop();
    bonk.play();
  }
  banner.setText('BONK!', 'Quick, tag it!');
  banner.mesh.visible = true;
}

// ---------- Joystick movement (fake yard only) ----------
const rigState = createRig();
game.rig = rigState;
function resetRig() {
  Object.assign(rigState, createRig());
  rig.position.set(0, 0, 0);
  rig.rotation.set(0, 0, 0);
}
const headDir = new THREE.Vector3();
function moveWithSticks(dt) {
  if (game.mode !== 'vr' || board.isOpen) return;
  const input = { moveX: 0, moveY: 0, turnX: 0 };
  for (const hand of hands) {
    // Quest thumbsticks are axes 2 (left/right) and 3 (forward/back).
    const axes = hand.inputSource?.gamepad?.axes;
    if (!axes || axes.length < 4) continue;
    if (hand.inputSource.handedness === 'left') {
      input.moveX = axes[2];
      input.moveY = axes[3];
    } else if (hand.inputSource.handedness === 'right') {
      input.turnX = axes[2];
    }
  }
  renderer.xr.getCamera().getWorldDirection(headDir);
  const head = { x: headPos.x, z: headPos.z, yaw: Math.atan2(-headDir.x, -headDir.z) };
  stepRig(rigState, input, head, dt);
  rig.position.set(rigState.x, 0, rigState.z);
  rig.rotation.y = rigState.yaw;
  rig.updateMatrixWorld(true);
  renderer.xr.getCamera().getWorldPosition(headPos);
}

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
  moveWithSticks(dt);

  // A or X opens the Item Board.
  for (const hand of hands) {
    const down = !!hand.inputSource?.gamepad?.buttons?.[4]?.pressed;
    if (down && !hand.aWasDown) toggleBoard();
    hand.aWasDown = down;
    hand.ray.visible = board.isOpen;
  }
  board.tick();
  reticle.visible = false;
  if (board.isOpen) {
    const g = gazeHit();
    if (g) {
      reticle.position.copy(g.point);
      reticle.quaternion.copy(board.mesh.quaternion);
      reticle.translateZ(0.002);
      reticle.visible = true;
    }
  }

  // The turkey waits politely while the board is open.
  if (!board.isOpen) stepTurkey(turkeyState, { x: headPos.x, z: headPos.z }, dt, cfg);

  // Equipped item physics + hits.
  if (item?.instance && itemHand?.inputSource) {
    item.instance.update(dt, itemHand.grip);
    if (!board.isOpen && turkeyState.mode !== 'caught' &&
        turkeyState.mode !== 'stunned' &&
        item.instance.hits({ x: turkeyState.x, y: cfg.bodyHeight, z: turkeyState.z })) {
      if (item.def.effect === 'stun') onStun(itemHand, item.def);
      else onCatch(itemHand, item.def.name);
    }
  }

  // Catch check.
  game.hands = [];
  for (const hand of hands) {
    if (!hand.inputSource) continue;
    hand.grip.getWorldPosition(hand.worldPos);
    game.hands.push({ x: hand.worldPos.x, y: hand.worldPos.y, z: hand.worldPos.z });
    if (!board.isOpen && isTouching(turkeyState, hand.worldPos, cfg)) onCatch(hand, null);
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
    if (turkeyState.mode !== 'caught' && turkeyState.mode !== 'stunned') banner.mesh.visible = false;
  }

  renderer.render(scene, camera);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
