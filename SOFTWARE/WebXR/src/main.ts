import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { Training, steps, type Action } from './training';
import { stepGuides, terms, inputHelp, phaseNotes } from './guide';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createLab, createPipette, glassMaterial, machineDetails, panelStand, printedMaterial } from './visuals';

const viewport = document.querySelector<HTMLDivElement>('#viewport')!;
const status = document.querySelector<HTMLDivElement>('#xr-status')!;
let training = new Training();
const scene = new THREE.Scene();
scene.background = new THREE.Color('#dce2df');
scene.fog = new THREE.Fog('#dce2df', 6, 16);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
const environment = new RoomEnvironment();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(environment, 0.04).texture;
scene.environmentIntensity = 0.55;
environment.dispose(); pmrem.dispose();
viewport.append(renderer.domElement);

const camera = new THREE.PerspectiveCamera(48, 1, 0.02, 30);
camera.position.set(0.55, 1.82, 1.45);
const rig = new THREE.Group();
scene.add(rig);
rig.add(camera);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(-0.15, 1.29, -0.7);
orbit.minDistance = 0.45;
orbit.maxDistance = 3;
orbit.maxPolarAngle = Math.PI * 0.48;
orbit.enableDamping = true;
orbit.update();
scene.add(new THREE.HemisphereLight('#f4f8ff', '#687379', 0.7));
const key = new THREE.DirectionalLight('#fff4df', 2.5);
key.position.set(-2.3, 4, 1.8);
key.target.position.set(-0.25, 0.9, -0.6);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = key.shadow.camera.bottom = -1.7;
key.shadow.camera.right = key.shadow.camera.top = 1.7;
key.shadow.camera.near = 0.1; key.shadow.camera.far = 9;
key.shadow.normalBias = 0.002;
key.shadow.bias = -0.0001;
key.shadow.radius = 3;
scene.add(key);
scene.add(key.target);
const fill = new THREE.DirectionalLight('#e6efff', 0.7);
fill.position.set(2, 2.7, -1.5);
scene.add(fill);

function box(w: number, h: number, d: number, color: string, parent: THREE.Object3D, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

createLab(scene);

const machine = new THREE.Group();
machine.position.set(-0.27, 0.903, -0.57);
scene.add(machine);
const lidPivot = new THREE.Group();
lidPivot.position.set(0, 0.13, -0.126);
machine.add(lidPivot);
const holder = new THREE.Group();
holder.position.set(0, 0.126, -0.03);
machine.add(holder);
const sample = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.002, 48), new THREE.MeshPhysicalMaterial({ color: '#8099ad', metalness: 0.7, roughness: 0.14, clearcoat: 0.8 }));
sample.castShadow = sample.receiveShadow = true;
scene.add(sample);
const liquidMaterial = new THREE.MeshPhysicalMaterial({ color: '#329e7d', transparent: true, opacity: 0.68, roughness: 0.07, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.07, depthWrite: false });
const liquid = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 12), liquidMaterial);
liquid.position.y = 0.0015;
liquid.scale.set(0.003, 0.001, 0.003);
sample.add(liquid);
const pipette = new THREE.Group();
pipette.position.set(-0.65, 0.986, -0.53);
pipette.rotation.z = -0.35;
scene.add(pipette);
createPipette(pipette);
const drop = new THREE.Mesh(new THREE.SphereGeometry(0.004, 16, 12), liquidMaterial);
scene.add(drop);
drop.visible = false;
let dispenseAnimation = 0;
const updateMachineScreen = machineDetails(machine, lidPivot);
let machineScreenSignature = '';

const modelURLs = {
  case: new URL('../../../HARDWARE/3mf/Case.3mf', import.meta.url).href,
  base: new URL('../../../HARDWARE/3mf/Base.3mf', import.meta.url).href,
  vase: new URL('../../../HARDWARE/3mf/Vase.3mf', import.meta.url).href,
  lid: new URL('../../../HARDWARE/3mf/Lid_frame_hinges.3mf', import.meta.url).href,
  holder: new URL('../../../HARDWARE/3mf/Round_holder_18mm.3mf', import.meta.url).href,
};
const loader = new ThreeMFLoader();
let assetMessage = '3MF形状を読み込み中…';
let xrMessage = '';
const showStatus = () => { status.textContent = `${assetMessage} ${xrMessage}`; };
showStatus();
async function loadModels() {
  const parts = await Promise.all(Object.entries(modelURLs).map(async ([name, url]) => {
    const part = await loader.loadAsync(url);
    part.rotation.x = -Math.PI / 2;
    part.scale.setScalar(0.002);
    part.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.geometry.computeVertexNormals();
        object.material = printedMaterial(name === 'vase' || name === 'base' ? '#262c32' : name === 'lid' ? '#bac5c9' : '#2873b8', name === 'vase' ? 0.55 : 0.43);
        object.castShadow = object.receiveShadow = true;
      }
    });
    return { name, part };
  }));
  for (const { name, part } of parts) {
    if (name === 'lid') {
      part.position.set(-0.0998, -0.13, 0.286);
      lidPivot.add(part);
    } else if (name === 'holder') {
      holder.add(part);
    } else {
      part.position.set(-0.0998, 0, 0.16);
      machine.add(part);
    }
  }
  // The CAD frame has no transparent window; add a training window to it.
  box(0.17, 0.0015, 0.16, '#99c5d1', lidPivot, 0, 0.007, 0.08);
  const glass = lidPivot.children[lidPivot.children.length - 1] as THREE.Mesh;
  glass.material = glassMaterial;
  renderer.shadowMap.needsUpdate = true;
  assetMessage = 'Maasiの3MF形状を使用 / 練習用2倍スケール';
  showStatus();
}
loadModels().catch(error => {
  console.error('3MF loading failed', error);
  // Keep interaction available, but clearly identify the fallback geometry.
  box(0.21, 0.12, 0.30, '#2873b8', machine, 0, 0.06, 0);
  box(0.20, 0.006, 0.20, '#7da7b1', lidPivot, 0, 0, 0.1);
  assetMessage = '3MF読込失敗：簡易形状で表示中（ページを再読み込み）';
  showStatus();
});

function label(text: string, x: number, y: number, z: number, width = 0.22) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 100;
  const context = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  function draw() {
    context.fillStyle = '#17353e'; context.fillRect(0, 0, 512, 100);
    context.fillStyle = '#d9eeee'; context.font = '500 32px "Noto Sans JP Variable", sans-serif';
    context.textAlign = 'center'; context.fillText(text, 256, 61);
    texture.needsUpdate = true;
  }
  draw();
  document.fonts.load('500 32px "Noto Sans JP Variable"', text).then(draw);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
  sprite.position.set(x, y, z); sprite.scale.set(width, width * 100 / 512, 1);
  scene.add(sprite);
  return sprite;
}
const lidLabel = label('蓋を開く / 閉じる', -0.27, 1.18, -0.57, 0.24);
const sampleLabel = label('試料を設置 / 回収', -0.65, 0.94, -0.30, 0.22);
const pipetteLabel = label('ピペット：滴下', -0.65, 1.10, -0.53, 0.22);

// Transparent hit boxes provide usable targets even for tiny parts in VR.
const targets: THREE.Object3D[] = [];
function hitBox(parent: THREE.Object3D, action: Action, size: THREE.Vector3, position: THREE.Vector3) {
  const hit = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  hit.position.copy(position); hit.userData.action = action;
  parent.add(hit); targets.push(hit);
}
hitBox(lidPivot, 'lid', new THREE.Vector3(0.21, 0.02, 0.22), new THREE.Vector3(0, 0.01, 0.1));
hitBox(pipette, 'drop', new THREE.Vector3(0.07, 0.17, 0.07), new THREE.Vector3());
hitBox(sample, 'sample', new THREE.Vector3(0.075, 0.04, 0.075), new THREE.Vector3());
for (const [object, action] of [[lidLabel, 'lid'], [sampleLabel, 'sample'], [pipetteLabel, 'drop']] as const) {
  object.userData.action = action; targets.push(object);
}

type GuideAction = 'guidePrev' | 'guideNext' | 'guideLive' | 'guideOverview' | 'guideTerms';
type PanelAction = Action | GuideAction | 'reset';
type GuideMode = 'step' | 'overview' | 'terms';
let guideMode: GuideMode = 'step';
let guideFollowing = true;
let guideIndex = 0;
const actionLabels: Record<Action, string> = {
  lid: '蓋を開く / 閉じる', sample: '試料を設置 / 回収', drop: '液体を滴下',
  start: 'START · 滴下回転', coat: 'COAT · 塗布開始', stop: 'STOP · 中断',
  rpmDown: 'RPM −100', rpmUp: 'RPM +100', timeDown: '時間 −1秒', timeUp: '時間 +1秒',
};
const panelCanvas = document.createElement('canvas');
panelCanvas.width = 768; panelCanvas.height = 1100;
const ctx = panelCanvas.getContext('2d')!;
const panelTexture = new THREE.CanvasTexture(panelCanvas);
panelTexture.colorSpace = THREE.SRGBColorSpace;
const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.56 * 1100 / 768), new THREE.MeshBasicMaterial({ map: panelTexture }));
panel.position.set(0.35, 1.34, -0.77);
panel.rotation.y = -0.08;
scene.add(panel); targets.push(panel);
panelStand(panel, 0.56, 0.56 * 1100 / 768);
const panelButtons: { action: PanelAction; x: number; y: number; w: number; h: number }[] = [];
const rows: (Action | 'reset')[][] = [['rpmDown', 'rpmUp'], ['timeDown', 'timeUp'], ['lid', 'sample'], ['start', 'drop'], ['coat', 'stop'], ['reset']];
rows.forEach((row, i) => row.forEach((action, j) => panelButtons.push({ action, x: 36 + j * 354, y: 540 + i * 77, w: row.length === 1 ? 696 : 342, h: 62 })));
let hoverAction: PanelAction | null = null;
let panelSignature = '';
const guideCanvas = document.createElement('canvas');
guideCanvas.width = 768; guideCanvas.height = 1160;
const guideContext = guideCanvas.getContext('2d')!;
const guideTexture = new THREE.CanvasTexture(guideCanvas);
guideTexture.colorSpace = THREE.SRGBColorSpace;
const guidePanel = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.64 * 1160 / 768), new THREE.MeshBasicMaterial({ map: guideTexture }));
guidePanel.position.set(-0.75, 1.45, -1.04);
guidePanel.rotation.y = 0.18;
scene.add(guidePanel); targets.push(guidePanel);
panelStand(guidePanel, 0.64, 0.64 * 1160 / 768);
const guideButtons: { action: GuideAction; title: string; x: number; y: number; w: number; h: number }[] = [
  { action: 'guideLive', title: '現在の操作', x: 36, y: 940, w: 224, h: 66 },
  { action: 'guideOverview', title: '全手順', x: 272, y: 940, w: 224, h: 66 },
  { action: 'guideTerms', title: '用語解説', x: 508, y: 940, w: 224, h: 66 },
  { action: 'guidePrev', title: '← 前の説明', x: 36, y: 1022, w: 342, h: 66 },
  { action: 'guideNext', title: '次の説明 →', x: 390, y: 1022, w: 342, h: 66 },
];
let guideSignature = '';
const fontRequests = new Set<string>();
function ensurePanelFont(value: string) {
  if (fontRequests.has(value)) return;
  fontRequests.add(value);
  document.fonts.load('500 25px "Noto Sans JP Variable"', value).then(() => { updatePanel(true); updateGuide(true); }).catch(console.error);
}

function text(value: string, x: number, y: number, size = 26, color = '#d9eeee') {
  ctx.font = `500 ${size}px "Noto Sans JP Variable", sans-serif`; ctx.fillStyle = color; ctx.fillText(value, x, y);
}
function wrap(value: string, x: number, y: number, maxWidth: number, lineHeight: number, size: number, color: string) {
  ctx.font = `500 ${size}px "Noto Sans JP Variable", sans-serif`;
  let line = '';
  for (const char of value) {
    if (ctx.measureText(line + char).width > maxWidth) { text(line, x, y, size, color); y += lineHeight; line = ''; }
    line += char;
  }
  text(line, x, y, size, color);
}

function updatePanel(force = false) {
  const screenSignature = `${Math.round(training.rpm / 10)}|${training.coatRPM}|${training.coatSeconds}|${training.phase}`;
  if (screenSignature !== machineScreenSignature) {
    machineScreenSignature = screenSignature;
    updateMachineScreen(training.phase === 'idle' ? training.coatRPM : training.rpm, training.coatSeconds, training.phase);
  }
  ensurePanelFont(steps.flat().join('') + Object.values(actionLabels).join('') + '設定残り時間回転数秒練習をリセット蓋を閉じる試料を回収試料を設置');
  ensurePanelFont(training.feedback);
  const rpm = Math.round(training.rpm / 10) * 10;
  const remaining = training.remaining === null ? '—' : `${training.remaining.toFixed(1)} s`;
  const signature = `${training.step}|${training.phase}|${rpm}|${remaining}|${training.coatRPM}|${training.coatSeconds}|${training.feedback}|${training.lidOpen}|${training.sampleLoaded}|${hoverAction}`;
  if (!force && signature === panelSignature) return;
  panelSignature = signature;
  ctx.fillStyle = '#102b35'; ctx.fillRect(0, 0, 768, 1100);
  text('MAASI / VIRTUAL LAB', 36, 54, 23, '#8cdcca');
  text(`STEP ${Math.min(training.step + 1, 8)} / 8`, 36, 108, 23, '#9cb6bf');
  text(steps[training.step][0], 36, 163, 40);
  wrap(steps[training.step][1], 36, 211, 692, 36, 25, '#b7cdd4');
  ctx.fillStyle = '#25444f'; ctx.fillRect(36, 310, 696, 3);
  text('回転数', 36, 356, 23, '#9cb6bf'); text('残り時間', 425, 356, 23, '#9cb6bf');
  text(`${rpm.toLocaleString()} RPM`, 36, 418, 45, '#8cdcca'); text(remaining, 425, 418, 40);
  text(`設定 ${training.coatRPM.toLocaleString()} RPM / ${training.coatSeconds} 秒`, 36, 481, 29);
  for (const button of panelButtons) {
    const action = button.action as Action | 'reset';
    const enabled = action === 'reset' || !training.reason(action);
    ctx.fillStyle = button.action === hoverAction ? '#477e86' : !enabled ? '#1b3540' : button.action === 'stop' ? '#78434a' : ['start', 'coat'].includes(button.action) ? '#296859' : '#2a4c59';
    ctx.beginPath(); ctx.roundRect(button.x, button.y, button.w, button.h, 10); ctx.fill();
    const title = action === 'reset' ? '練習をリセット' : action === 'lid' ? (training.lidOpen ? '蓋を閉じる' : '蓋を開ける') : action === 'sample' ? (training.sampleLoaded ? '試料を回収' : '試料を設置') : actionLabels[action];
    text(title, button.x + 18, button.y + 40, 25, enabled ? '#e0eeee' : '#718b97');
  }
  wrap(training.feedback, 36, 1030, 696, 30, 23, '#9bddcb');
  panelTexture.needsUpdate = true;

  document.querySelector('#step-title')!.textContent = steps[training.step][0];
  document.querySelector('#instruction')!.textContent = steps[training.step][1];
  document.querySelector('#rpm')!.innerHTML = `${rpm.toLocaleString()} <span>RPM</span>`;
  document.querySelector('#remaining')!.textContent = remaining;
  document.querySelector('#feedback')!.textContent = training.feedback;
  document.querySelector('#phase-note')!.textContent = phaseNotes[training.phase];
  document.querySelectorAll('#steps li').forEach((li, i) => { li.className = i === training.step ? 'active' : i < training.step ? 'done' : ''; });
  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => {
    const action = button.dataset.action as Action;
    button.setAttribute('aria-disabled', String(!!training.reason(action)));
    if (action === 'lid') button.textContent = training.lidOpen ? '蓋を閉じる' : '蓋を開ける';
    if (action === 'sample') button.textContent = training.sampleLoaded ? '試料を回収' : '試料を設置';
  });
}

function guideText(value: string, x: number, y: number, size = 28, color = '#d9eeee') {
  guideContext.font = `500 ${size}px "Noto Sans JP Variable", sans-serif`;
  guideContext.fillStyle = color;
  guideContext.fillText(value, x, y);
}

function guideWrap(value: string, x: number, y: number, size = 26, color = '#c4d6dc', width = 696) {
  guideContext.font = `500 ${size}px "Noto Sans JP Variable", sans-serif`;
  let line = '';
  const lineHeight = size * 1.5;
  for (const char of value) {
    if (guideContext.measureText(line + char).width > width) {
      guideText(line, x, y, size, color); y += lineHeight; line = '';
    }
    line += char;
  }
  guideText(line, x, y, size, color);
  return y + lineHeight;
}

function updateGuide(force = false) {
  if (guideFollowing) guideIndex = training.step;
  const signature = `${guideMode}|${guideFollowing}|${guideIndex}|${training.step}|${training.phase}|${hoverAction}`;
  if (!force && signature === guideSignature) return;
  guideSignature = signature;
  const detail = stepGuides[guideIndex];
  guideContext.fillStyle = '#102b35'; guideContext.fillRect(0, 0, 768, 1160);
  guideText('MAASI / 操作ガイド', 36, 58, 27, '#8cdcca');
  guideText('Quest：狙ってトリガー / PC：クリック', 36, 106, 24, '#b7cdd4');
  if (guideMode === 'step') {
    guideText(`${guideFollowing ? '現在の操作' : '説明を閲覧中'} · ${guideIndex === 8 ? '完了' : `STEP ${guideIndex + 1} / 8`}`, 36, 166, 25, '#8cdcca');
    guideText(steps[guideIndex][0], 36, 222, 39);
    guideText('やり方', 36, 280, 27, '#8cdcca');
    let y = 328;
    detail.how.forEach((line, i) => { y = guideWrap(`${i + 1}. ${line}`, 36, y) + 12; });
    guideText('なぜこの操作？', 36, y + 10, 27, '#8cdcca');
    y = guideWrap(detail.why, 36, y + 56) + 16;
    guideText('できた目印', 36, y + 10, 27, '#8cdcca');
    y = guideWrap(detail.check, 36, y + 56, 26) + 10;
    if (guideFollowing && training.step === 6) guideWrap(phaseNotes[training.phase], 36, y, 25, '#8cdcca');
  } else if (guideMode === 'overview') {
    guideText('操作の全体手順', 36, 179, 39);
    guideWrap('この順番で練習します。緑色は現在の操作です。', 36, 232, 25);
    steps.slice(0, 8).forEach(([title], i) => {
      guideText(`${i < training.step ? '✓' : String(i + 1).padStart(2, '0')}  ${title}`, 48, 325 + i * 58, 30, i === training.step ? '#8cdcca' : '#d9eeee');
    });
    guideWrap('STARTは滴下用回転、COATは塗布開始です。停止後に試料を回収すると練習完了です。', 36, 829, 26);
  } else {
    guideText('装置と用語の解説', 36, 179, 39);
    let y = 245;
    for (const [term, explanation] of terms) {
      guideText(term, 36, y, 28, '#8cdcca');
      y = guideWrap(explanation, 36, y + 41, 26) + 22;
    }
  }
  for (const button of guideButtons) {
    const active = button.action === 'guideLive' ? guideFollowing && guideMode === 'step' : button.action === 'guideOverview' ? guideMode === 'overview' : button.action === 'guideTerms' ? guideMode === 'terms' : false;
    guideContext.fillStyle = hoverAction === button.action ? '#477e86' : active ? '#296859' : '#2a4c59';
    guideContext.beginPath(); guideContext.roundRect(button.x, button.y, button.w, button.h, 10); guideContext.fill();
    guideText(button.title, button.x + 18, button.y + 43, 27);
  }
  guideText('左スティック押し込み：作業台を正面へ', 36, 1131, 23, '#9cb6bf');
  guideTexture.needsUpdate = true;

  const htmlSignature = `${guideMode}|${guideFollowing}|${guideIndex}|${training.step}`;
  const content = document.querySelector<HTMLElement>('#guide-content')!;
  if (content.dataset.signature !== htmlSignature) {
    content.dataset.signature = htmlSignature;
    document.querySelector('#guide-mode')!.textContent = guideFollowing ? '現在の操作に追従' : '説明を閲覧中';
    document.querySelector('#guide-title')!.textContent = guideMode === 'step' ? `${guideIndex === 8 ? '完了' : `${guideIndex + 1} / 8`} · ${steps[guideIndex][0]}` : guideMode === 'overview' ? '操作の全体手順' : '装置と用語の解説';
    document.querySelector<HTMLElement>('#guide-detail')!.hidden = guideMode !== 'step';
    document.querySelector<HTMLElement>('#guide-overview')!.hidden = guideMode !== 'overview';
    document.querySelector<HTMLElement>('#guide-terms')!.hidden = guideMode !== 'terms';
    const how = document.querySelector('#guide-how')!;
    how.replaceChildren(...detail.how.map(line => { const li = document.createElement('li'); li.textContent = line; return li; }));
    document.querySelector('#guide-why')!.textContent = detail.why;
    document.querySelector('#guide-check')!.textContent = detail.check;
    document.querySelectorAll('#guide-overview li').forEach((li, i) => { li.className = i === training.step ? 'current' : ''; });
    document.querySelectorAll<HTMLButtonElement>('.guide-tabs [data-guide]').forEach(button => {
      const selected = button.dataset.guide === 'guideLive' ? guideFollowing && guideMode === 'step' : button.dataset.guide === 'guideOverview' ? guideMode === 'overview' : guideMode === 'terms';
      button.setAttribute('aria-pressed', String(selected));
    });
  }
}

function activate(action: PanelAction) {
  if (action === 'guideLive') { guideFollowing = true; guideMode = 'step'; }
  else if (action === 'guideOverview') guideMode = 'overview';
  else if (action === 'guideTerms') guideMode = 'terms';
  else if (action === 'guidePrev' || action === 'guideNext') {
    guideIndex = THREE.MathUtils.clamp(guideIndex + (action === 'guidePrev' ? -1 : 1), 0, 8);
    guideFollowing = false; guideMode = 'step';
  } else if (action === 'reset') {
    training = new Training(); dispenseAnimation = 0; drop.visible = false;
    guideFollowing = true; guideMode = 'step';
  } else if (training.act(action) && action === 'drop') dispenseAnimation = 1;
  updatePanel(true);
  updateGuide(true);
  if (action === 'lid' || action === 'sample' || action === 'reset') renderer.shadowMap.needsUpdate = true;
}

const controlsElement = document.querySelector('#controls')!;
for (const [action, title] of Object.entries(actionLabels)) {
  const button = document.createElement('button');
  button.dataset.action = action; button.textContent = title;
  button.addEventListener('click', () => activate(action as Action));
  controlsElement.append(button);
}
steps.slice(0, 8).forEach(([title]) => { const li = document.createElement('li'); li.textContent = title; document.querySelector('#steps')!.append(li); });
document.querySelector('#reset')!.addEventListener('click', () => activate('reset'));
document.querySelectorAll<HTMLButtonElement>('[data-guide]').forEach(button => {
  button.addEventListener('click', () => activate(button.dataset.guide as GuideAction));
});
steps.slice(0, 8).forEach(([title]) => {
  const li = document.createElement('li'); li.textContent = title;
  document.querySelector('#guide-overview')!.append(li);
});
for (const [selector, entries] of [['#guide-terms', terms], ['#input-help', inputHelp]] as const) {
  for (const [term, explanation] of entries) {
    const dt = document.createElement('dt'); dt.textContent = term;
    const dd = document.createElement('dd'); dd.textContent = explanation;
    document.querySelector(selector)!.append(dt, dd);
  }
}
ensurePanelFont(stepGuides.map(detail => detail.how.join('') + detail.why + detail.check).join('') + terms.flat().join('') + Object.values(phaseNotes).join('') + guideButtons.map(button => button.title).join('') + '操作ガイド説明を閲覧中現在の操作完了やり方なぜこの操作できた目印操作の全体手順装置と用語の解説この順番で練習します緑色は現在の操作です左スティック押し込み作業台を正面へ狙ってトリガークリック');

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
function intersect(): { action: PanelAction; distance: number } | null {
  for (const hit of raycaster.intersectObjects(targets, false)) {
    if ((hit.object === panel || hit.object === guidePanel) && hit.uv) {
      const isGuide = hit.object === guidePanel;
      const x = hit.uv.x * 768; const y = (1 - hit.uv.y) * (isGuide ? 1160 : 1100);
      const button = (isGuide ? guideButtons : panelButtons).find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
      return button ? { action: button.action, distance: hit.distance } : null;
    }
    if (hit.object.userData.action) return { action: hit.object.userData.action as Action, distance: hit.distance };
  }
  return null;
}
function pointerHit(event: PointerEvent) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  return intersect();
}
let downPosition = new THREE.Vector2();
renderer.domElement.addEventListener('pointerdown', event => { downPosition.set(event.clientX, event.clientY); });
renderer.domElement.addEventListener('pointerup', event => {
  if (renderer.xr.isPresenting || downPosition.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 6) return;
  const hit = pointerHit(event); if (hit) activate(hit.action);
});
renderer.domElement.addEventListener('pointermove', event => {
  if (renderer.xr.isPresenting) return;
  const hit = pointerHit(event); hoverAction = hit?.action ?? null;
  renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
});
renderer.domElement.addEventListener('pointerleave', () => { hoverAction = null; });

const controllerFactory = new XRControllerModelFactory();
const controllers: THREE.XRTargetRaySpace[] = [];
const rotation = new THREE.Matrix4();
for (let i = 0; i < 2; i++) {
  const controller = renderer.xr.getController(i);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: '#7de7ce' }));
  line.name = 'ray'; line.scale.z = 2;
  controller.add(line); rig.add(controller); controllers.push(controller);
  const grip = renderer.xr.getControllerGrip(i);
  grip.add(controllerFactory.createControllerModel(grip)); rig.add(grip);
  controller.addEventListener('selectstart', () => {
    rotation.extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation);
    const hit = intersect(); if (hit) activate(hit.action);
  });
  controller.addEventListener('connected', () => { line.visible = true; });
  controller.addEventListener('disconnected', () => { line.visible = false; });
  line.visible = false;
}

let shouldRecenter = false;
let stickWasPressed = false;
const savedCameraPosition = new THREE.Vector3();
const savedCameraQuaternion = new THREE.Quaternion();
function recenter() {
  const frame = renderer.xr.getFrame();
  const referenceSpace = renderer.xr.getReferenceSpace();
  const pose = frame && referenceSpace ? frame.getViewerPose(referenceSpace) : null;
  if (!pose) return false;
  const orientation = pose.transform.orientation;
  const quaternion = new THREE.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
  const yaw = Math.atan2(-direction.x, -direction.z);
  rig.rotation.set(0, -yaw, 0);
  const position = pose.transform.position;
  const rotated = new THREE.Vector3(position.x, 0, position.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
  rig.position.set(-rotated.x, 0, 0.6 - rotated.z);
  rig.updateMatrixWorld(true);
  return true;
}
renderer.xr.addEventListener('sessionstart', () => {
  savedCameraPosition.copy(camera.position); savedCameraQuaternion.copy(camera.quaternion);
  orbit.enabled = false; shouldRecenter = true; hoverAction = null;
});
renderer.xr.addEventListener('sessionend', () => {
  rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
  camera.position.copy(savedCameraPosition); camera.quaternion.copy(savedCameraQuaternion);
  orbit.enabled = true; orbit.update(); stickWasPressed = false;
});
const vrButton = VRButton.createButton(renderer);
viewport.append(vrButton);
Object.assign(vrButton.style, { bottom: '20px', background: '#1d544c', border: '1px solid #7de7ce', borderRadius: '8px' });
if (!window.isSecureContext) {
  xrMessage = 'VR開始にはHTTPS接続が必要です。'; showStatus();
} else if (!navigator.xr) {
  xrMessage = 'このブラウザーではPC操作を利用できます。Quest Browserで開くとVRに入れます。'; showStatus();
} else {
  navigator.xr.isSessionSupported('immersive-vr').then(supported => {
    xrMessage = supported ? 'ENTER VRで開始 / 左スティック押し込みで正面へ' : 'VR非対応環境です。PC操作を利用できます。'; showStatus();
  }).catch(() => { xrMessage = 'VR対応確認に失敗しました。ブラウザーのXR設定を確認してください。'; showStatus(); });
}

new ResizeObserver(() => {
  const { width, height } = viewport.getBoundingClientRect();
  if (renderer.xr.isPresenting) return;
  renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix();
}).observe(viewport);
// Refresh Japanese canvas text once fonts become available.
document.fonts.ready.then(() => { updatePanel(true); updateGuide(true); });
updatePanel(true);
updateGuide(true);
let previousTime: number | null = null;
let lastPanelTime = -Infinity;
let lastShadowTime = -Infinity;
renderer.setAnimationLoop(time => {
  // Ignore time spent with the browser/XR tab suspended, rather than completing unseen.
  const dt = previousTime === null ? 0 : Math.min(Math.max((time - previousTime) / 1000, 0), 0.1);
  previousTime = time;
  training.update(dt);
  if (renderer.xr.isPresenting) {
    if (shouldRecenter && recenter()) shouldRecenter = false;
    const session = renderer.xr.getSession();
    const left = Array.from(session?.inputSources ?? []).find(source => source.handedness === 'left');
    const pressed = left?.gamepad?.buttons[3]?.pressed ?? false;
    if (pressed && !stickWasPressed) recenter();
    stickWasPressed = pressed;
    hoverAction = null;
    rig.updateMatrixWorld(true);
    for (const controller of controllers) {
      rotation.extractRotation(controller.matrixWorld);
      raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation);
      const hit = intersect();
      const line = controller.getObjectByName('ray')!;
      line.scale.z = hit?.distance ?? 2;
      if (hit) hoverAction = hit.action;
    }
  } else orbit.update();
  const targetAngle = training.lidOpen ? -Math.PI * 0.62 : 0;
  const lidMoving = Math.abs(lidPivot.rotation.x - targetAngle) > 0.002;
  lidPivot.rotation.x = THREE.MathUtils.damp(lidPivot.rotation.x, targetAngle, 10, dt);
  holder.rotation.y = (holder.rotation.y + training.rpm * Math.PI * 2 / 60 * dt) % (Math.PI * 2);
  if (training.sampleLoaded) {
    sample.position.copy(machine.position).add(new THREE.Vector3(0, 0.142, -0.03));
    sample.rotation.y = holder.rotation.y;
  } else { sample.position.set(-0.65, 0.908, -0.3); sample.rotation.y = 0; }
  liquid.visible = training.dropped && training.sampleLoaded;
  const filmRadius = 0.017 * Math.max(0.12, training.film);
  liquid.scale.set(filmRadius, 0.00015 + 0.001 * (1 - training.film), filmRadius);
  const pipetteTarget = dispenseAnimation > 0 ? sample.position.clone().add(new THREE.Vector3(0, 0.16, 0)) : new THREE.Vector3(-0.65, 0.986, -0.53);
  const pipetteMoving = pipette.position.distanceTo(pipetteTarget) > 0.001;
  pipette.position.lerp(pipetteTarget, 1 - Math.exp(-12 * dt));
  pipette.rotation.z = THREE.MathUtils.damp(pipette.rotation.z, dispenseAnimation > 0 ? 0 : -0.35, 12, dt);
  if (dispenseAnimation > 0) {
    dispenseAnimation = Math.max(0, dispenseAnimation - dt);
    drop.visible = true;
    drop.position.copy(sample.position).add(new THREE.Vector3(0, 0.01 + 0.12 * dispenseAnimation, 0));
  } else drop.visible = false;
  // Uploading an 1100px canvas every XR frame is unnecessary; telemetry is 10 Hz.
  if (time - lastPanelTime >= 100) { updatePanel(); updateGuide(); lastPanelTime = time; }
  if ((lidMoving || pipetteMoving) && time - lastShadowTime >= 100) {
    renderer.shadowMap.needsUpdate = true; lastShadowTime = time;
  }
  renderer.render(scene, camera);
});
