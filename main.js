import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

import houseModelUrl from './modelos/construcoes/House-nihGGju7DW.glb?url';
import houseModelSimpleUrl from './modelos/construcoes/House.glb?url';
import houseModelAltUrl from './modelos/construcoes/House-RSwoYSLblu.glb?url';
import houseModelAlt2Url from './modelos/construcoes/House-YlADpCJU8U.glb?url';
import treeModelUrl from './modelos/arvore/CommonTree_3.fbx?url';
import treeModelAltUrl from './modelos/arvore/CommonTree_4.fbx?url';
import treeModelAlt2Url from './modelos/arvore/CommonTree_5.fbx?url';
import flowerModelUrl from './modelos/arvore/Flower_3_Group.fbx?url';
import flowerModelAltUrl from './modelos/arvore/Flower_4_Group.fbx?url';
import animalModelUrl from './modelos/animal/Horse.fbx?url';
import animalPugModelUrl from './modelos/animal/Pug.fbx?url';
import bonfireModelUrl from './modelos/construcoes/bonfire.glb?url';

import skyHdrUrl from './texturas/ceu_estrelado_2k.hdr?url';
import grassColorUrl from './texturas/grama_cor.jpg?url';
import grassNormalUrl from './texturas/grama_normal.png?url';
import dirtColorUrl from './texturas/terra_cor.jpg?url';
import dirtNormalUrl from './texturas/terra_normal.png?url';
import pathMaskUrl from './texturas/mascara_caminho.png?url';
import plazaMaskUrl from './texturas/mascara_praca.png?url';

const SKY_COLOR = new THREE.Color(0x071a36);

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
// Sombras habilitadas
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
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
const WORLD_RADIUS = 45;

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

// Luz da fogueira (com sombra)
const fireLight = new THREE.PointLight(0xffa94d, 100, 25, 2);
fireLight.position.set(0.05, 1.5, -0.09); // acima da lenha, dentro da chama
fireLight.castShadow = true;
fireLight.shadow.mapSize.set(1024, 1024);
fireLight.shadow.bias = -0.003;
fireLight.shadow.radius = 4;
fireLight.shadow.normalBias = 0.03;
scene.add(fireLight);

// Lua
const lua = new THREE.Mesh(
  new THREE.SphereGeometry(4, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0xf2f2e6, fog: false }),
);
lua.position.set(-40, 55, -55);
scene.add(lua);

// Luz da lua (com sombra)
const luzLua = new THREE.PointLight(0xaec6ff, 5000, 220, 2);
luzLua.position.copy(lua.position);
luzLua.castShadow = true;
luzLua.shadow.mapSize.set(2048, 2048);
luzLua.shadow.bias = -0.0015;
luzLua.shadow.radius = 2;
scene.add(luzLua);

const luzAmbiente = new THREE.AmbientLight(0x4060a0, 0.12);
scene.add(luzAmbiente);

// Casas 
const HOUSE_POSITIONS = [
  new THREE.Vector3(-18, 0, -10),
  new THREE.Vector3(-18, 0, 10),
  new THREE.Vector3(-8, 0, -20),
  new THREE.Vector3(-8, 0, 20),
  new THREE.Vector3(18, 0, -10),
  new THREE.Vector3(18, 0, 10),
];

// Chão da vila
const GROUND_RADIUS = 100;
const GRASS_TILE = 4; // tamanho (unidades do mundo) de cada repetição da grama
const DIRT_TILE = 3; // idem, para a terra
const PLAZA_RADIUS = 7;
const PATH_WIDTH = 3.4;
const PATH_START = 3; // o caminho começa dentro da praça
const HOUSE_CLEARANCE = 6.5; // distância do centro da casa onde o caminho termina

// A neblina esconde a borda do chão e tem a mesma cor do horizonte do HDR.
const FOG_COLOR = 0x0a1830;
scene.fog = new THREE.Fog(FOG_COLOR, 45, 95);

const textureLoader = new THREE.TextureLoader();
const maxAnisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);

function loadTexture(url, { srgb = false, repeat = false } = {}) {
  const texture = textureLoader.load(url);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

const grassColor = loadTexture(grassColorUrl, { srgb: true, repeat: true });
const grassNormal = loadTexture(grassNormalUrl, { repeat: true });
const dirtColor = loadTexture(dirtColorUrl, { srgb: true, repeat: true });
const dirtNormal = loadTexture(dirtNormalUrl, { repeat: true });

// Máscaras de transparência (bordas irregulares) dos caminhos e da praça.
// Ficam no canal de UV 1, para a terra poder repetir no canal 0.
const pathMask = loadTexture(pathMaskUrl);
const plazaMask = loadTexture(plazaMaskUrl);
pathMask.channel = 1;
plazaMask.channel = 1;

// Grama: textura repetida por todo o chão.
const grassRepeat = (GROUND_RADIUS * 2) / GRASS_TILE;
grassColor.repeat.set(grassRepeat, grassRepeat);
grassNormal.repeat.set(grassRepeat, grassRepeat);

const groundMaterial = new THREE.MeshStandardMaterial({
  map: grassColor,
  normalMap: grassNormal,
  normalScale: new THREE.Vector2(0.9, 0.9),
  color: new THREE.Color().setScalar(1.45), // clareia a grama (a cena é noturna)
  roughness: 1,
  metalness: 0,
});

// Quebra a repetição visível da grama: amostra a mesma textura em escala bem
// maior e usa o resultado para clarear/escurecer grandes manchas do terreno.
groundMaterial.onBeforeCompile = (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <map_fragment>',
    `#include <map_fragment>
     float macro = texture2D( map, vMapUv * 0.037 ).g;
     diffuseColor.rgb *= mix( 0.78, 1.18, smoothstep( 0.22, 0.33, macro ) );`,
  );
};

const ground = new THREE.Mesh(new THREE.CircleGeometry(GROUND_RADIUS, 96), groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Terra: pedaços planos logo acima da grama, com bordas suaves (alphaMap).
function createDirtMaterial(alphaMap) {
  return new THREE.MeshStandardMaterial({
    map: dirtColor,
    normalMap: dirtNormal,
    alphaMap,
    color: new THREE.Color().setScalar(1.3),
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    roughness: 1,
    metalness: 0,
  });
}

const plazaMaterial = createDirtMaterial(plazaMask);
const pathMaterial = createDirtMaterial(pathMask);

function addDirtPatch(width, depth, material, position, rotationY = 0) {
  const geometry = new THREE.PlaneGeometry(width, depth);
  geometry.rotateX(-Math.PI / 2);
  // UV 1 = máscara (0..1 sobre o pedaço inteiro)
  geometry.setAttribute('uv1', geometry.attributes.uv.clone());

  const patch = new THREE.Mesh(geometry, material);
  patch.position.copy(position);
  patch.rotation.y = rotationY;
  patch.receiveShadow = true;
  patch.renderOrder = 1;
  patch.updateMatrix();

  // UV 0 = posição no mundo, assim a terra da praça e a dos caminhos "casam".
  const positions = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const vertex = new THREE.Vector3();
  for (let i = 0; i < uv.count; i++) {
    vertex.fromBufferAttribute(positions, i).applyMatrix4(patch.matrix);
    uv.setXY(i, vertex.x / DIRT_TILE, vertex.z / DIRT_TILE);
  }

  scene.add(patch);
  return patch;
}

// Praça de terra em volta da fogueira
addDirtPatch(PLAZA_RADIUS * 2, PLAZA_RADIUS * 2, plazaMaterial, new THREE.Vector3(0, 0.02, 0));

// Um caminho da praça até a frente de cada casa
HOUSE_POSITIONS.forEach((housePosition) => {
  const direction = new THREE.Vector2(housePosition.x, housePosition.z);
  const distance = direction.length();
  direction.normalize();

  const end = distance - HOUSE_CLEARANCE;
  const length = end - PATH_START;
  const middle = (PATH_START + end) / 2;

  addDirtPatch(
    length,
    PATH_WIDTH,
    pathMaterial,
    new THREE.Vector3(direction.x * middle, 0.025, direction.y * middle),
    Math.atan2(-direction.y, direction.x),
  );
});

// Céu
let skyTexture = null;
scene.backgroundIntensity = 1;
scene.environmentIntensity = 0.5;

new HDRLoader()
  .loadAsync(skyHdrUrl)
  .then((texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    skyTexture = texture;
    scene.environment = texture; // reflexos/luz suave vindos do céu
    applyDiagnostics();
  })
  .catch((error) => {
    console.error('Erro ao carregar o HDR do céu:', error);
  });

// Fogueira
const FIRE_BASE = new THREE.Vector3(0.05, 0, -0.09); // centro da base da fogueira
const FIRE_LIGHT_INTENSITY = 100;

// Tudo que é "efeito" (partículas, fumaça, halo) fica neste grupo.
const fireEffects = new THREE.Group();
scene.add(fireEffects);

// Textura macia (círculo com degradê) gerada em canvas, usada em halo, fagulhas e fumaça.
function createSoftTexture(stops) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const glowTexture = createSoftTexture([
  [0, 'rgba(255,255,255,1)'],
  [0.25, 'rgba(255,255,255,0.55)'],
  [1, 'rgba(255,255,255,0)'],
]);
const emberTexture = createSoftTexture([
  [0, 'rgba(255,255,255,1)'],
  [0.3, 'rgba(255,255,255,0.9)'],
  [0.65, 'rgba(255,255,255,0.25)'],
  [1, 'rgba(255,255,255,0)'],
]);
const smokeTexture = createSoftTexture([
  [0, 'rgba(255,255,255,0.9)'],
  [0.5, 'rgba(255,255,255,0.35)'],
  [1, 'rgba(255,255,255,0)'],
]);

// Valor "orgânico" entre 0 e 1: soma de senos em frequências diferentes.
function flicker(t, seed = 0) {
  return (
    0.5 +
    0.25 * Math.sin(t * 9.1 + seed) +
    0.15 * Math.sin(t * 17.3 + seed * 2.1) +
    0.1 * Math.sin(t * 31.7 + seed * 3.3)
  );
}

//Halo de brilho atrás/em volta da chama (aditivo, imita "bloom")
const fireGlow = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xff8a2a,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  }),
);
fireGlow.position.set(FIRE_BASE.x, 1.5, FIRE_BASE.z);
fireGlow.scale.setScalar(8);
fireEffects.add(fireGlow);

//Fagulhas
const EMBER_COUNT = 90;
const emberPositions = new Float32Array(EMBER_COUNT * 3);
const emberColors = new Float32Array(EMBER_COUNT * 3);
const embers = Array.from({ length: EMBER_COUNT }, () => ({
  life: 0,
  maxLife: 1,
  vx: 0,
  vy: 0,
  vz: 0,
}));

function resetEmber(i, ageFraction = 0) {
  const ember = embers[i];
  const radius = Math.random() * 0.7;
  const angle = Math.random() * Math.PI * 2;
  ember.maxLife = 1.6 + Math.random() * 2.2;
  ember.life = ageFraction * ember.maxLife;
  ember.vx = (Math.random() - 0.5) * 0.5;
  ember.vy = 0.9 + Math.random() * 1.3;
  ember.vz = (Math.random() - 0.5) * 0.5;
  emberPositions[i * 3] = FIRE_BASE.x + Math.cos(angle) * radius + ember.vx * ember.life;
  emberPositions[i * 3 + 1] = 0.8 + Math.random() * 0.9 + ember.vy * ember.life;
  emberPositions[i * 3 + 2] = FIRE_BASE.z + Math.sin(angle) * radius + ember.vz * ember.life;
}
for (let i = 0; i < EMBER_COUNT; i++) resetEmber(i, Math.random());

const emberGeometry = new THREE.BufferGeometry();
const emberPositionAttribute = new THREE.BufferAttribute(emberPositions, 3);
const emberColorAttribute = new THREE.BufferAttribute(emberColors, 3);
emberPositionAttribute.setUsage(THREE.DynamicDrawUsage);
emberColorAttribute.setUsage(THREE.DynamicDrawUsage);
emberGeometry.setAttribute('position', emberPositionAttribute);
emberGeometry.setAttribute('color', emberColorAttribute);

const emberPoints = new THREE.Points(
  emberGeometry,
  new THREE.PointsMaterial({
    size: 0.28,
    map: emberTexture,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    fog: false,
  }),
);
emberPoints.frustumCulled = false; // as posições mudam todo quadro
fireEffects.add(emberPoints);

// Fumaça (sprites macios que sobem, crescem e somem) 
const SMOKE_COUNT = 14;
const SMOKE_WARM = new THREE.Color(0x5a3a28); // logo que sai da chama, ainda iluminada
const SMOKE_COOL = new THREE.Color(0x2a2f3c);
const smokePuffs = [];

function resetSmoke(puff, ageFraction = 0) {
  puff.maxLife = 5 + Math.random() * 3;
  puff.life = ageFraction * puff.maxLife;
  puff.velocity.set(0.25 + Math.random() * 0.2, 0.8 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3);
  puff.start.set(
    FIRE_BASE.x + (Math.random() - 0.5) * 0.8,
    2.8,
    FIRE_BASE.z + (Math.random() - 0.5) * 0.8,
  );
}

for (let i = 0; i < SMOKE_COUNT; i++) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: smokeTexture,
      color: SMOKE_COOL,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  sprite.material.rotation = Math.random() * Math.PI * 2;
  fireEffects.add(sprite);
  const puff = { sprite, life: 0, maxLife: 1, velocity: new THREE.Vector3(), start: new THREE.Vector3() };
  resetSmoke(puff, Math.random());
  smokePuffs.push(puff);
}

//Círculo de pedras em volta da fogueira
const stoneMaterial = new THREE.MeshStandardMaterial({
  color: 0x5b5d63,
  roughness: 0.95,
  metalness: 0,
  flatShading: true,
});
const STONE_COUNT = 12;
for (let i = 0; i < STONE_COUNT; i++) {
  const angle = (i / STONE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
  const radius = 2.2 + Math.random() * 0.2;
  const stone = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.28 + Math.random() * 0.16, 0),
    stoneMaterial,
  );
  stone.position.set(FIRE_BASE.x + Math.cos(angle) * radius, 0.1, FIRE_BASE.z + Math.sin(angle) * radius);
  stone.scale.set(1, 0.65, 1);
  stone.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
  stone.castShadow = true;
  stone.receiveShadow = true;
  scene.add(stone);
}

// --- Modelo da fogueira: chama emissiva e sem sombra -------------------------
let flameMesh = null;

function setupBonfire(bonfire) {
  bonfire.traverse((child) => {
    if (!child.isMesh || child.material?.name !== 'Fire') return;
    flameMesh = child;
    // A luz está dentro da chama: se ela projetasse sombra, bloquearia a própria luz.
    child.castShadow = false;
    child.receiveShadow = false;
    const material = child.material;
    material.emissive.set(0xffffff); // a cor vem do degradê no shader abaixo
    material.emissiveIntensity = 1.2;
    material.metalness = 0;
    material.roughness = 1;

    // Degradê na chama: amarelo perto da lenha, laranja no meio, vermelho na ponta.
    // 0.0113 é a altura (no espaço do modelo) do topo da chama; o eixo "para cima" é o Z.
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vFlameHeight;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvFlameHeight = clamp( position.z / 0.0113, 0.0, 1.0 );',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vFlameHeight;')
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           totalEmissiveRadiance *= mix( vec3( 1.0, 0.82, 0.32 ), vec3( 1.0, 0.2, 0.03 ), smoothstep( 0.0, 1.0, vFlameHeight ) );`,
        );
    };
    material.needsUpdate = true;
  });
}

const fireLightColor = new THREE.Color();

// Chamado todo quadro (t = segundos desde o início, dt = delta).
function updateFire(t, dt) {
  const n = flicker(t);
  const n2 = flicker(t, 4.2);
  const n3 = flicker(t, 8.7);

  // Luz: intensidade, cor e posição oscilam. Mexer um pouco na posição faz as
  // sombras da lenha e das pedras "dançarem".
  fireLight.intensity = FIRE_LIGHT_INTENSITY * (0.78 + 0.45 * n);
  fireLight.position.set(
    FIRE_BASE.x + (n2 - 0.5) * 0.12,
    1.5 + (n - 0.5) * 0.15,
    FIRE_BASE.z + (n3 - 0.5) * 0.12,
  );
  fireLight.color.copy(fireLightColor.setHSL(0.075 + 0.02 * n2, 1, 0.65));

  // Chama: pulsa, balança e muda o brilho.
  if (flameMesh) {
    flameMesh.scale.set(1.06 - 0.12 * n, 1.06 - 0.12 * n2, 0.9 + 0.25 * n); // z = altura
    flameMesh.rotation.set(0.04 * Math.sin(t * 2.3), 0.04 * Math.sin(t * 1.9 + 1), 0.12 * Math.sin(t * 1.7));
    flameMesh.material.emissiveIntensity = 0.95 + 0.6 * n;
  }

  fireGlow.material.opacity = 0.45 + 0.25 * n;
  fireGlow.scale.setScalar(7 * (0.9 + 0.2 * n2));

  // Fagulhas
  for (let i = 0; i < EMBER_COUNT; i++) {
    const ember = embers[i];
    ember.life += dt;
    if (ember.life >= ember.maxLife) resetEmber(i);

    const k = ember.life / ember.maxLife;
    emberPositions[i * 3] += (ember.vx + Math.sin(t * 3 + i) * 0.35) * dt;
    emberPositions[i * 3 + 1] += ember.vy * (1 - 0.35 * k) * dt;
    emberPositions[i * 3 + 2] += (ember.vz + Math.cos(t * 2.6 + i * 1.7) * 0.35) * dt;

    const fade = Math.pow(1 - k, 1.5) * (0.6 + 0.4 * Math.sin(t * 20 + i * 7));
    const glow = fade * 2.6;
    emberColors[i * 3] = glow;
    emberColors[i * 3 + 1] = glow * (0.55 - 0.3 * k);
    emberColors[i * 3 + 2] = glow * 0.12 * (1 - k);
  }
  emberPositionAttribute.needsUpdate = true;
  emberColorAttribute.needsUpdate = true;

  // Fumaça
  for (const puff of smokePuffs) {
    puff.life += dt;
    if (puff.life >= puff.maxLife) resetSmoke(puff);

    const k = puff.life / puff.maxLife;
    puff.sprite.position.copy(puff.start).addScaledVector(puff.velocity, puff.life);
    puff.sprite.scale.setScalar(0.9 + 3 * k);
    puff.sprite.material.opacity = 0.3 * Math.sin(Math.PI * k);
    puff.sprite.material.color.copy(SMOKE_WARM).lerp(SMOKE_COOL, Math.min(1, k * 2));
  }
}

function prepareModel(model, options = {}) {
  const { position = new THREE.Vector3(0, 0, 0), rotationY = 0, scale = 1 } = options;

  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;

      if (child.material) {
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
  const bonfire = await loadGLTF(bonfireModelUrl);
  prepareModel(bonfire, {
    position: new THREE.Vector3(0, 0, 0),
    rotationY: 0,
    scale: 1.5,
  });
  setupBonfire(bonfire);

  const houses = await Promise.all([
    loadGLTF(houseModelUrl),
    loadGLTF(houseModelSimpleUrl),
    loadGLTF(houseModelAltUrl),
    loadGLTF(houseModelAlt2Url),
    loadGLTF(houseModelUrl),
    loadGLTF(houseModelSimpleUrl),
  ]);

  houses.forEach((house, index) => {
    prepareModel(house, {
      position: HOUSE_POSITIONS[index],
      rotationY: index % 2 === 0 ? 0.9 : -0.9,
      scale: 8.8,
    });
  });

  const trees = await Promise.all([
    loadFBX(treeModelUrl),
    loadFBX(treeModelAltUrl),
    loadFBX(treeModelAlt2Url),
    loadFBX(treeModelUrl),
    loadFBX(treeModelAltUrl),
    loadFBX(treeModelAlt2Url),
    loadFBX(treeModelUrl),
    loadFBX(treeModelAltUrl),
  ]);

  const treePositions = [
    new THREE.Vector3(-24, 0, -18),
    new THREE.Vector3(-28, 0, 0),
    new THREE.Vector3(-22, 0, 20),
    new THREE.Vector3(-6, 0, 26),
    new THREE.Vector3(10, 0, 25),
    new THREE.Vector3(25, 0, 18),
    new THREE.Vector3(26, 0, -16),
    new THREE.Vector3(8, 0, -24),
  ];

  trees.forEach((tree, index) => {
    prepareModel(tree, {
      position: treePositions[index],
      rotationY: 0.4 + index * 0.5,
      scale: 0.015 + (index % 3) * 0.001,
    });
  });

  const flowers = await Promise.all([
    loadFBX(flowerModelUrl),
    loadFBX(flowerModelAltUrl),
    loadFBX(flowerModelUrl),
    loadFBX(flowerModelAltUrl),
  ]);

  const flowerPositions = [
    new THREE.Vector3(6, 0, -6),
    new THREE.Vector3(-6, 0, 7),
    new THREE.Vector3(14, 0, 4),
    new THREE.Vector3(-12, 0, -5),
  ];

  flowers.forEach((flower, index) => {
    prepareModel(flower, {
      position: flowerPositions[index],
      rotationY: index % 2 === 0 ? 0.3 : -0.7,
      scale: 0.03,
    });
  });

  const horses = await Promise.all([
    loadFBX(animalModelUrl),
    loadFBX(animalModelUrl),
    loadFBX(animalModelUrl),
  ]);

  const horsePositions = [
    new THREE.Vector3(7, 0.1, 8),
    new THREE.Vector3(-10, 0.1, -7),
    new THREE.Vector3(14, 0.1, -12),
  ];

  horses.forEach((horse, index) => {
    prepareModel(horse, {
      position: horsePositions[index],
      rotationY: index === 0 ? -0.9 : 0.7,
      scale: 0.003,
    });
  });

  const dogs = await Promise.all([
    loadFBX(animalPugModelUrl),
    loadFBX(animalPugModelUrl),
    loadFBX(animalPugModelUrl),
    loadFBX(animalPugModelUrl),
  ]);

  const dogPositions = [
    new THREE.Vector3(4, 0.1, 10),
    new THREE.Vector3(-3, 0.1, -10),
    new THREE.Vector3(12, 0.1, -6),
    new THREE.Vector3(-12, 0.1, 5),
  ];

  dogs.forEach((dog, index) => {
    prepareModel(dog, {
      position: dogPositions[index],
      rotationY: index % 2 === 0 ? 0.6 : -0.9,
      scale: 0.004,
    });
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
  fireEffects.visible = !diag.depth; // partículas não funcionam com o material de profundidade
  scene.background = diag.depth ? new THREE.Color(0x000000) : (skyTexture ?? SKY_COLOR);

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

const skyFolder = gui.addFolder('Céu (HDR)');
skyFolder.add(scene, 'backgroundIntensity', 0, 4, 0.05).name('Brilho do céu');
skyFolder.add(scene, 'environmentIntensity', 0, 2, 0.05).name('Luz do céu no cenário');

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
  updateFire(timer.getElapsed(), delta);
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