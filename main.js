import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

import houseModelUrl from './modelos/casa/House-nihGGju7DW.glb?url';
import treeModelUrl from './modelos/arvore/CommonTree_3.fbx?url';
import animalModelUrl from './modelos/animal/Horse.fbx?url';

const SKY_COLOR = new THREE.Color(0xbfe6ff);

const scene = new THREE.Scene();
scene.background = SKY_COLOR;

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  200,
);
const EYE_HEIGHT = 1.7;
camera.position.set(12, EYE_HEIGHT, 18);
camera.lookAt(0, EYE_HEIGHT, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.info.autoReset = false;
document.body.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(controls.object);

renderer.domElement.addEventListener('click', () => controls.lock());

const keys = { forward: false, back: false, left: false, right: false, run: false };

function setKey(code, pressed) {
  switch (code) {
    case 'KeyW':
    case 'ArrowUp':
      keys.forward = pressed;
      break;
    case 'KeyS':
    case 'ArrowDown':
      keys.back = pressed;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      keys.left = pressed;
      break;
    case 'KeyD':
    case 'ArrowRight':
      keys.right = pressed;
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      keys.run = pressed;
      break;
    default:
      return false;
  }
  return true;
}

const WALK_SPEED = 5;
const RUN_SPEED = 10;
const WORLD_RADIUS = 28;

const timer = new THREE.Timer();

function updateMovement(delta) {
  if (!controls.isLocked) return;

  const strafe = Number(keys.right) - Number(keys.left);
  const advance = Number(keys.forward) - Number(keys.back);
  if (strafe === 0 && advance === 0) return;

  const length = Math.hypot(strafe, advance);
  const speed = keys.run ? RUN_SPEED : WALK_SPEED;
  const step = speed * delta;

  controls.moveRight((strafe / length) * step);
  controls.moveForward((advance / length) * step);

  const pos = controls.object.position;
  pos.y = EYE_HEIGHT;
  const dist = Math.hypot(pos.x, pos.z);
  if (dist > WORLD_RADIUS) {
    pos.x *= WORLD_RADIUS / dist;
    pos.z *= WORLD_RADIUS / dist;
  }
}

const light = new THREE.DirectionalLight(0xffffff, 1.2);
light.position.set(10, 20, 10);
scene.add(light);

const ambient = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambient);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(30, 60),
  new THREE.MeshStandardMaterial({ color: 0x7dbd64 }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

function prepareModel(model, options = {}) {
  const { position = new THREE.Vector3(0, 0, 0), rotationY = 0, scale = 1 } = options;

  model.traverse((child) => {
    if (child.isMesh && child.material) {
      const material = child.material;
      if (Array.isArray(material)) {
        material.forEach((m) => {
          m.transparent = false;
          m.opacity = 1;
          m.depthWrite = true;
        });
      } else {
        material.transparent = false;
        material.opacity = 1;
        material.depthWrite = true;
      }
    }
  });

  model.position.copy(position);
  model.rotation.y = rotationY;
  model.scale.setScalar(scale);
  scene.add(model);

  return model;
}

function loadGLTF(url) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
  });
}

function loadFBX(url) {
  return new Promise((resolve, reject) => {
    const loader = new FBXLoader();
    loader.load(url, (model) => resolve(model), undefined, reject);
  });
}

async function buildVillage() {
  const house = await loadGLTF(houseModelUrl);
  prepareModel(house, {
    position: new THREE.Vector3(0, 0, 0),
    rotationY: Math.PI / 6,
    scale: 10,
  });

  const tree = await loadFBX(treeModelUrl);
  prepareModel(tree, {
    position: new THREE.Vector3(-10, 0, -8),
    rotationY: 0.7,
    scale: 0.015,
  });

  const horse = await loadFBX(animalModelUrl);
  prepareModel(horse, {
    position: new THREE.Vector3(8, 0.1, 6),
    rotationY: -0.9,
    scale: 0.003,
  });
}

const diag = {
  wireframe: false,
  depth: false,
  depthMode: 'linear',
  depthRange: 60,
  backFaceCulling: true,
  showFrustum: false,
  frustumCulling: true,
};

const rawDepthMaterial = new THREE.MeshDepthMaterial();
const linearDepthMaterial = new THREE.MeshDepthMaterial();
const linearDepthUniform = { value: diag.depthRange };
linearDepthMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uMaxDist = linearDepthUniform;
  const patched = shader.fragmentShader.replace(
    /gl_FragColor\s*=\s*vec4\(\s*vec3\(\s*1\.0\s*-\s*fragCoordZ\s*\)\s*,\s*opacity\s*\)\s*;/,
    'gl_FragColor = vec4( vec3( 1.0 - clamp( vHighPrecisionZW[ 1 ] / uMaxDist, 0.0, 1.0 ) ), opacity );',
  );
  if (patched === shader.fragmentShader) {
    console.warn('Profundidade linear indisponível nesta versão do Three.js; use o modo z-buffer.');
  }
  shader.fragmentShader = 'uniform float uMaxDist;\n' + patched;
};

const frustumHelper = new THREE.CameraHelper(camera);
frustumHelper.visible = false;
scene.add(frustumHelper);

const topCamera = new THREE.PerspectiveCamera(50, 1, 1, 300);
topCamera.up.set(0, 0, -1);
topCamera.position.set(0, 75, 0);
topCamera.lookAt(0, 0, 0);

const insetFrame = document.createElement('div');
insetFrame.textContent = 'Visão de cima: frustum da câmera';
Object.assign(insetFrame.style, {
  position: 'fixed',
  display: 'none',
  boxSizing: 'border-box',
  border: '2px solid #fff',
  boxShadow: '0 0 6px rgba(0,0,0,0.6)',
  color: '#fff',
  font: '12px sans-serif',
  textShadow: '0 0 3px #000',
  padding: '3px 6px',
  pointerEvents: 'none',
  zIndex: '5',
});
document.body.appendChild(insetFrame);

const INSET_MARGIN = 12;

function getInsetRect() {
  const size = Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.36);
  return {
    size,
    x: window.innerWidth - size - INSET_MARGIN,
    y: INSET_MARGIN,
  };
}

function layoutInset() {
  const r = getInsetRect();
  Object.assign(insetFrame.style, {
    width: `${r.size}px`,
    height: `${r.size}px`,
    right: `${INSET_MARGIN}px`,
    bottom: `${INSET_MARGIN}px`,
    display: diag.showFrustum ? 'block' : 'none',
  });
}

function applyDiagnostics() {
  const side = diag.backFaceCulling ? THREE.FrontSide : THREE.DoubleSide;

  scene.traverse((obj) => {
    if (!obj.isMesh) return;

    obj.frustumCulled = diag.frustumCulling;

    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of materials) {
      m.wireframe = diag.wireframe;
      m.side = side;
    }
  });

  for (const m of [rawDepthMaterial, linearDepthMaterial]) {
    m.wireframe = diag.wireframe;
    m.side = side;
  }

  linearDepthUniform.value = diag.depthRange;
  const depthMaterial = diag.depthMode === 'linear' ? linearDepthMaterial : rawDepthMaterial;
  scene.overrideMaterial = diag.depth ? depthMaterial : null;
  scene.background = diag.depth ? new THREE.Color(0x000000) : SKY_COLOR;

  layoutInset();
}

const gui = new GUI({ title: 'Modo diagnóstico' });
const ui = {};

ui.wireframe = gui.add(diag, 'wireframe').name('1 · Wireframe').onChange(applyDiagnostics);

const depthFolder = gui.addFolder('2 · Profundidade (z-buffer)');
ui.depth = depthFolder.add(diag, 'depth').name('Ativar').onChange(applyDiagnostics);
depthFolder
  .add(diag, 'depthMode', { 'Linear (didático)': 'linear', 'z-buffer bruto': 'raw' })
  .name('Modo')
  .onChange(applyDiagnostics);
depthFolder.add(diag, 'depthRange', 10, 200, 1).name('Alcance linear').onChange(applyDiagnostics);

ui.backFaceCulling = gui
  .add(diag, 'backFaceCulling')
  .name('3 · Back-face culling')
  .onChange(applyDiagnostics);

ui.showFrustum = gui.add(diag, 'showFrustum').name('4 · Frustum (visão de cima)').onChange(applyDiagnostics);

ui.frustumCulling = gui.add(diag, 'frustumCulling').name('5 · Frustum culling').onChange(applyDiagnostics);

const stats = { drawCalls: 0, triangles: 0 };
const infoFolder = gui.addFolder('5 · renderer.info (câmera principal)');
infoFolder.add(stats, 'drawCalls').name('Draw calls').listen().disable();
infoFolder.add(stats, 'triangles').name('Triângulos').listen().disable();

const cameraFolder = gui.addFolder('Câmera (near / far)');
function onCameraPlanesChange() {
  camera.updateProjectionMatrix();
  frustumHelper.update();
}
cameraFolder.add(camera, 'near', 0.01, 10, 0.01).onChange(onCameraPlanesChange);
cameraFolder.add(camera, 'far', 20, 500, 1).onChange(onCameraPlanesChange);

const shortcuts = {
  Digit1: 'wireframe',
  Digit2: 'depth',
  Digit3: 'backFaceCulling',
  Digit4: 'showFrustum',
  Digit5: 'frustumCulling',
};

window.addEventListener('keydown', (e) => {
  if (setKey(e.code, true)) {
    e.preventDefault();
    return;
  }
  const prop = shortcuts[e.code];
  if (prop && !e.repeat) {
    diag[prop] = !diag[prop];
    applyDiagnostics();
    ui[prop].updateDisplay();
  }
});
window.addEventListener('keyup', (e) => {
  if (setKey(e.code, false)) e.preventDefault();
});

applyDiagnostics();

buildVillage()
  .catch((error) => {
    console.error('Erro ao carregar os modelos do vilarejo:', error);
  })
  .finally(applyDiagnostics);

function render() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  renderer.info.reset();

  frustumHelper.visible = false;
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, w, h);
  renderer.render(scene, camera);

  stats.drawCalls = renderer.info.render.calls;
  stats.triangles = renderer.info.render.triangles;

  if (diag.showFrustum) {
    const r = getInsetRect();
    frustumHelper.visible = true;
    renderer.setScissorTest(true);
    renderer.setViewport(r.x, r.y, r.size, r.size);
    renderer.setScissor(r.x, r.y, r.size, r.size);
    renderer.render(scene, topCamera);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, w, h);
  }
}

function animate() {
  requestAnimationFrame(animate);

  timer.update();
  const delta = Math.min(timer.getDelta(), 0.1);

  updateMovement(delta);
  render();
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  frustumHelper.update();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  layoutInset();
});