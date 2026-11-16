// Vila medieval em Three.js que dá para explorar em primeira pessoa

// O Three.js cuida da cena, da câmera e da renderização
import * as THREE from "three";
// O PointerLockControls usa o mouse para virar a câmera
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
// Os loaders abrem os modelos GLB e FBX e a imagem HDR do céu
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
// A GUI cria o painel de diagnóstico
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";

// O ?url faz o Vite entregar o endereço de cada arquivo para o loader
import houseModelUrl from "./modelos/construcoes/House-nihGGju7DW.glb?url";
import houseModelSimpleUrl from "./modelos/construcoes/House.glb?url";
import houseModelAltUrl from "./modelos/construcoes/House-RSwoYSLblu.glb?url";
import houseModelAlt2Url from "./modelos/construcoes/House-YlADpCJU8U.glb?url";

// Modelos de árvores, animais e da fogueira
import treeModelUrl from "./modelos/arvore/CommonTree_3.fbx?url";
import treeModelAltUrl from "./modelos/arvore/CommonTree_4.fbx?url";
import treeModelAlt2Url from "./modelos/arvore/CommonTree_5.fbx?url";

import animalModelUrl from "./modelos/animal/Horse.fbx?url";
import animalPugModelUrl from "./modelos/animal/Pug.fbx?url";
import bonfireModelUrl from "./modelos/construcoes/bonfire.glb?url";

// Imagem do céu, texturas do chão e máscaras das bordas da terra
import skyHdrUrl from "./texturas/ceu_estrelado_2k.hdr?url";
import grassColorUrl from "./texturas/grama_cor.jpg?url";
import grassNormalUrl from "./texturas/grama_normal.png?url";
import dirtColorUrl from "./texturas/terra_cor.jpg?url";
import dirtNormalUrl from "./texturas/terra_normal.png?url";
import pathMaskUrl from "./texturas/mascara_caminho.png?url";
import plazaMaskUrl from "./texturas/mascara_praca.png?url";

//Para clonar os modelos, melhora o desempenho
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

// A cena começa com um fundo azul-escuro enquanto o HDR carrega
const SKY_COLOR = new THREE.Color(0x071a36);

const scene = new THREE.Scene();
scene.background = SKY_COLOR;

// A câmera usa um campo de visão de 50 graus e a proporção da janela
// Os dois últimos valores são as distâncias mínima e máxima de renderização
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  200,
);
// O jogador começa a 1,7 unidade do chão, olhando para o centro da vila
const EYE_HEIGHT = 1.7;
camera.position.set(12, EYE_HEIGHT, 18);
camera.lookAt(0, EYE_HEIGHT, 0);

// O antialiasing suaviza as bordas, e o limite de pixel ratio reduz o custo em telas de alta resolução
const MAX_PIXEL_RATIO = 1.5;
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
renderer.setSize(window.innerWidth, window.innerHeight);
// Ativa sombras com filtragem para suavizar as bordas
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
// As estatísticas serão zeradas manualmente no começo de render()
renderer.info.autoReset = false;
document.body.appendChild(renderer.domElement);

// O mouse gira a câmera depois que o jogador clica na área da cena
const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(controls.object);

renderer.domElement.addEventListener("click", () => controls.lock());

// Guarda as teclas pressionadas para consultar durante a animação
const keys = {
  forward: false,
  back: false,
  left: false,
  right: false,
  run: false,
};

// Atualiza a direção ou a corrida conforme a tecla e indica se ela foi tratada
function setKey(code, pressed) {
  switch (code) {
    // W e seta para cima fazem o mesmo movimento
    case "KeyW":
    case "ArrowUp":
      keys.forward = pressed;
      break;
    // S e seta para baixo andam para trás
    case "KeyS":
    case "ArrowDown":
      keys.back = pressed;
      break;
    // A e seta para a esquerda movem o jogador de lado
    case "KeyA":
    case "ArrowLeft":
      keys.left = pressed;
      break;
    // D e seta para a direita movem para o outro lado
    case "KeyD":
    case "ArrowRight":
      keys.right = pressed;
      break;
    // Qualquer um dos dois Shift ativa a corrida
    case "ShiftLeft":
    case "ShiftRight":
      keys.run = pressed;
      break;
    // As outras teclas podem ser tratadas pelos atalhos do painel
    default:
      return false;
  }
  return true;
}

// Velocidades em unidades por segundo e raio máximo de exploração
const WALK_SPEED = 5;
const RUN_SPEED = 10;
const WORLD_RADIUS = 52;

// Mede o tempo entre os quadros para o movimento e os efeitos da fogueira
const timer = new THREE.Timer();

// Controle do balanço da câmera: a fase avança com os passos e a intensidade vai de 0 a 1
let bobPhase = 0;
let bobAmount = 0;
const BOB_HEIGHT = 0.04; // Altura do sobe e desce em unidades
const BOB_FREQUENCY = 1.6; // Passos por unidade de velocidade

// Move o jogador de acordo com as teclas e com o tempo passado desde o último quadro
function updateMovement(delta) {
  // Só processa o movimento enquanto o mouse estiver capturado
  if (!controls.isLocked) return;

  // Teclas opostas se cancelam, então cada eixo fica entre -1 e 1
  const strafe = Number(keys.right) - Number(keys.left);
  const advance = Number(keys.forward) - Number(keys.back);
  const moving = strafe !== 0 || advance !== 0;
  const speed = keys.run ? RUN_SPEED : WALK_SPEED;

  if (moving) {
    // Normaliza a direção para andar na diagonal com a mesma velocidade
    const length = Math.hypot(strafe, advance);
    const step = speed * delta;

    // As direções levam em conta para onde a câmera está virada
    controls.moveRight((strafe / length) * step);
    controls.moveForward((advance / length) * step);

    // A fase do balanço avança mais rápido quando o jogador corre
    bobPhase += delta * speed * BOB_FREQUENCY;
  }

  // A intensidade sobe suavemente ao começar a andar e desce suavemente ao parar
  bobAmount += ((moving ? 1 : 0) - bobAmount) * Math.min(1, delta * 10);

  // A altura dos olhos ganha o sobe e desce do passo
  const pos = controls.object.position;
  pos.y = EYE_HEIGHT + Math.sin(bobPhase) * BOB_HEIGHT * bobAmount;

  // Coloca o jogador de volta na borda quando ele ultrapassa o raio permitido
  const dist = Math.hypot(pos.x, pos.z);
  if (dist > WORLD_RADIUS) {
    pos.x *= WORLD_RADIUS / dist;
    pos.z *= WORLD_RADIUS / dist;
  }
}

// A luz laranja da fogueira fica um pouco acima da lenha
// A sombra da fogueira é calculado todo quadro, caso esteja muito pesado calcular a cada 3 por ex.
const fireLight = new THREE.PointLight(0xffa94d, 100, 25, 2);
fireLight.position.set(0.05, 1.5, -0.09);
fireLight.castShadow = true;
// A resolução define o detalhe da sombra, e os ajustes de bias ajudam a evitar listras
fireLight.shadow.mapSize.set(1024, 1024);
fireLight.shadow.bias = -0.003;
fireLight.shadow.radius = 4;
fireLight.shadow.normalBias = 0.03;
scene.add(fireLight);

// A lua é uma esfera clara que aparece mesmo sem receber luz e sem efeito da neblina
const lua = new THREE.Mesh(
  new THREE.SphereGeometry(4, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0xf2f2e6, fog: false }),
);
lua.position.set(-40, 55, -55);
scene.add(lua);

// A luz azulada sai da posição da lua e tem intensidade maior por estar longe da vila
const luzLua = new THREE.PointLight(0xaec6ff, 5000, 220, 2);
luzLua.position.copy(lua.position);
luzLua.castShadow = true;
luzLua.shadow.mapSize.set(1024, 1024);
luzLua.shadow.bias = -0.0015;
luzLua.shadow.radius = 2;
luzLua.shadow.autoUpdate = false;
scene.add(luzLua);

// Um pouco de luz ambiente evita que as áreas na sombra fiquem totalmente pretas
const luzAmbiente = new THREE.AmbientLight(0x4060a0, 0.12);
scene.add(luzAmbiente);

// Cada vetor indica onde fica o centro de uma casa, na ordem usada em buildVillage()
const HOUSE_POSITIONS = [
  new THREE.Vector3(-18, 0, -10),
  new THREE.Vector3(-18, 0, 10),
  new THREE.Vector3(-8, 0, -20),
  new THREE.Vector3(-8, 0, 20),
  new THREE.Vector3(18, 0, -10),
  new THREE.Vector3(18, 0, 10),
];

// A porta da quarta casa fica no +X do modelo, enquanto as outras ficam no +Z
const HOUSE_FRONT_AXES = ["z", "z", "z", "x", "z", "z"];

const HOUSE_SCALE = 8.8;
const DOOR_GAP = 0.4; // Folga entre o fim do caminho e a fachada

// Medidas do terreno, das repetições das texturas, da praça e dos caminhos
const GROUND_RADIUS = 100;
const GRASS_TILE = 4;
const DIRT_TILE = 3;
const PLAZA_RADIUS = 7;
const PATH_WIDTH = 3.4;
const PATH_START = 3; // O caminho começa dentro da praça para ligar as duas áreas

// A neblina escurece o terreno ao longe e ajuda a esconder a borda
const FOG_COLOR = 0x0a1830;
scene.fog = new THREE.Fog(FOG_COLOR, 45, 95);

const textureLoader = new THREE.TextureLoader();
// Mantém as texturas mais nítidas quando vistas de lado, com limite de 8
const maxAnisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);

// Carrega uma textura e configura o espaço de cor e a repetição conforme as opções
function loadTexture(url, { srgb = false, repeat = false } = {}) {
  const texture = textureLoader.load(url);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

// As texturas de cor usam sRGB, e os mapas de normais simulam o relevo do chão
const grassColor = loadTexture(grassColorUrl, { srgb: true, repeat: true });
const grassNormal = loadTexture(grassNormalUrl, { repeat: true });
const dirtColor = loadTexture(dirtColorUrl, { srgb: true, repeat: true });
const dirtNormal = loadTexture(dirtNormalUrl, { repeat: true });

// As máscaras usam o UV 1 para ter bordas suaves enquanto a terra se repete no UV 0
const pathMask = loadTexture(pathMaskUrl);
const plazaMask = loadTexture(plazaMaskUrl);
pathMask.channel = 1;
plazaMask.channel = 1;

// Calcula quantas vezes a grama cabe no diâmetro do terreno
const grassRepeat = (GROUND_RADIUS * 2) / GRASS_TILE;
grassColor.repeat.set(grassRepeat, grassRepeat);
grassNormal.repeat.set(grassRepeat, grassRepeat);

// O chão é fosco e a cor é reforçada para aparecer na iluminação noturna
const groundMaterial = new THREE.MeshStandardMaterial({
  map: grassColor,
  normalMap: grassNormal,
  normalScale: new THREE.Vector2(0.9, 0.9),
  color: new THREE.Color().setScalar(1.45),
  roughness: 1,
  metalness: 0,
});

// Antes de compilar o material, acrescenta uma variação de cor para disfarçar a repetição da grama
groundMaterial.onBeforeCompile = (shader) => {
  // Usa a mesma textura em uma escala maior para criar manchas claras e escuras
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <map_fragment>",
    `#include <map_fragment>
     float macro = texture2D( map, vMapUv * 0.037 ).g;
     diffuseColor.rgb *= mix( 0.78, 1.18, smoothstep( 0.22, 0.33, macro ) );`,
  );
};

// Deita um disco no chão e permite que ele receba as sombras da vila
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(GROUND_RADIUS, 96),
  groundMaterial,
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Cria o material da terra com a máscara de transparência recebida
function createDirtMaterial(alphaMap) {
  return new THREE.MeshStandardMaterial({
    map: dirtColor,
    normalMap: dirtNormal,
    alphaMap,
    color: new THREE.Color().setScalar(1.3),
    transparent: true,
    // Evita que as bordas transparentes escrevam no buffer de profundidade
    depthWrite: false,
    // Separa a terra da grama no teste de profundidade para evitar cintilação
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    roughness: 1,
    metalness: 0,
  });
}

// A praça e os caminhos usam a mesma terra com máscaras de formatos diferentes
const plazaMaterial = createDirtMaterial(plazaMask);
const pathMaterial = createDirtMaterial(pathMask);

// Cria um pedaço de terra deitado e coloca na posição e no ângulo recebidos
function addDirtPatch(width, depth, material, position, rotationY = 0) {
  const geometry = new THREE.PlaneGeometry(width, depth);
  geometry.rotateX(-Math.PI / 2);
  // Guarda os UVs originais para a máscara cobrir a área inteira
  geometry.setAttribute("uv1", geometry.attributes.uv.clone());

  const patch = new THREE.Mesh(geometry, material);
  patch.position.copy(position);
  patch.rotation.y = rotationY;
  patch.receiveShadow = true;
  patch.renderOrder = 1;
  patch.updateMatrix();

  // Usa a posição no mundo para alinhar o desenho da terra entre a praça e os caminhos
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

// Coloca a praça no centro, um pouco acima da grama
addDirtPatch(
  PLAZA_RADIUS * 2,
  PLAZA_RADIUS * 2,
  plazaMaterial,
  new THREE.Vector3(0, 0.02, 0),
);

// Cria um caminho reto da praça até a distância indicada na direção da casa
function addHousePath(housePosition, endDistance) {
  const direction = new THREE.Vector2(
    housePosition.x,
    housePosition.z,
  ).normalize();
  const length = endDistance - PATH_START;
  // O plano é posicionado pelo centro, então usamos o meio do trecho
  const middle = (PATH_START + endDistance) / 2;

  addDirtPatch(
    length,
    PATH_WIDTH,
    pathMaterial,
    new THREE.Vector3(direction.x * middle, 0.025, direction.y * middle),
    Math.atan2(-direction.y, direction.x), // Gira o plano na direção da casa
  );
}

// O brilho do céu e a influência dele na iluminação podem ser ajustados separadamente
let skyTexture = null;
scene.backgroundIntensity = 1;
scene.environmentIntensity = 0.5;

new HDRLoader()
  .loadAsync(skyHdrUrl)
  .then((texture) => {
    // Quando o arquivo chega, usa a imagem panorâmica como ambiente da cena
    texture.mapping = THREE.EquirectangularReflectionMapping;
    skyTexture = texture;
    scene.environment = texture;
    // Atualiza o fundo sem perder a opção de profundidade, caso esteja ligada
    applyDiagnostics();
  })
  .catch((error) => {
    // Se o HDR falhar, a cena continua com o fundo azul
    console.error("Erro ao carregar o HDR do céu:", error);
  });

// Posição de referência da fogueira e intensidade média da luz
const FIRE_BASE = new THREE.Vector3(0.05, 0, -0.09);
const FIRE_LIGHT_INTENSITY = 100;

// Agrupa o brilho, as fagulhas e a fumaça para controlar a visibilidade juntos
const fireEffects = new THREE.Group();
scene.add(fireEffects);

// Desenha um degradê circular em um canvas e devolve a textura pronta para usar
function createSoftTexture(stops) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  // Cada par informa em que ponto do degradê a cor deve aparecer
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// O brilho tem centro forte, as fagulhas têm um núcleo mais definido e a fumaça é mais difusa
const glowTexture = createSoftTexture([
  [0, "rgba(255,255,255,1)"],
  [0.25, "rgba(255,255,255,0.55)"],
  [1, "rgba(255,255,255,0)"],
]);
const emberTexture = createSoftTexture([
  [0, "rgba(255,255,255,1)"],
  [0.3, "rgba(255,255,255,0.9)"],
  [0.65, "rgba(255,255,255,0.25)"],
  [1, "rgba(255,255,255,0)"],
]);
const smokeTexture = createSoftTexture([
  [0, "rgba(255,255,255,0.9)"],
  [0.5, "rgba(255,255,255,0.35)"],
  [1, "rgba(255,255,255,0)"],
]);

// Combina três oscilações para o fogo tremular com um ritmo irregular
function flicker(t, seed = 0) {
  return (
    0.5 +
    0.25 * Math.sin(t * 9.1 + seed) +
    0.15 * Math.sin(t * 17.3 + seed * 2.1) +
    0.1 * Math.sin(t * 31.7 + seed * 3.3)
  );
}

// O sprite soma sua cor à da cena para criar o brilho em volta da chama
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

// Cada fagulha ocupa três valores de posição e três de cor nos arrays
const EMBER_COUNT = 90;
const emberPositions = new Float32Array(EMBER_COUNT * 3);
const emberColors = new Float32Array(EMBER_COUNT * 3);
// Cada partícula também guarda a idade, a duração e a velocidade nos três eixos
const embers = Array.from({ length: EMBER_COUNT }, () => ({
  life: 0,
  maxLife: 1,
  vx: 0,
  vy: 0,
  vz: 0,
}));

// Reinicia uma fagulha perto do fogo com posição, velocidade e duração aleatórias
function resetEmber(i, ageFraction = 0) {
  const ember = embers[i];
  const radius = Math.random() * 0.7;
  const angle = Math.random() * Math.PI * 2;
  ember.maxLife = 1.6 + Math.random() * 2.2;
  ember.life = ageFraction * ember.maxLife;
  ember.vx = (Math.random() - 0.5) * 0.5;
  ember.vy = 0.9 + Math.random() * 1.3;
  ember.vz = (Math.random() - 0.5) * 0.5;
  // A idade inicial também desloca a partícula, como se ela já estivesse subindo
  emberPositions[i * 3] =
    FIRE_BASE.x + Math.cos(angle) * radius + ember.vx * ember.life;
  emberPositions[i * 3 + 1] = 0.8 + Math.random() * 0.9 + ember.vy * ember.life;
  emberPositions[i * 3 + 2] =
    FIRE_BASE.z + Math.sin(angle) * radius + ember.vz * ember.life;
}
// Espalha as idades das fagulhas para elas já aparecerem em alturas diferentes
for (let i = 0; i < EMBER_COUNT; i++) resetEmber(i, Math.random());

// Liga os arrays à geometria e marca os dois como dados que mudam com frequência
const emberGeometry = new THREE.BufferGeometry();
const emberPositionAttribute = new THREE.BufferAttribute(emberPositions, 3);
const emberColorAttribute = new THREE.BufferAttribute(emberColors, 3);
emberPositionAttribute.setUsage(THREE.DynamicDrawUsage);
emberColorAttribute.setUsage(THREE.DynamicDrawUsage);
emberGeometry.setAttribute("position", emberPositionAttribute);
emberGeometry.setAttribute("color", emberColorAttribute);

// Desenha as fagulhas como pontos luminosos com cor individual
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
// Desativa o descarte pela câmera porque as posições dos pontos mudam toda hora
emberPoints.frustumCulled = false;
fireEffects.add(emberPoints);

// A fumaça começa com um tom quente e vai ficando acinzentada conforme sobe
const SMOKE_COUNT = 8;
const SMOKE_WARM = new THREE.Color(0x5a3a28);
const SMOKE_COOL = new THREE.Color(0x2a2f3c);
const smokePuffs = [];

// Reinicia uma partícula de fumaça perto do topo da chama
function resetSmoke(puff, ageFraction = 0) {
  puff.maxLife = 5 + Math.random() * 3;
  puff.life = ageFraction * puff.maxLife;
  // Além de subir, a fumaça se desloca um pouco de lado
  puff.velocity.set(
    0.25 + Math.random() * 0.2,
    0.8 + Math.random() * 0.5,
    (Math.random() - 0.5) * 0.3,
  );
  puff.start.set(
    FIRE_BASE.x + (Math.random() - 0.5) * 0.8,
    2.8,
    FIRE_BASE.z + (Math.random() - 0.5) * 0.8,
  );
}

// Cria os sprites e distribui a rotação e a idade de cada um
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
  const puff = {
    sprite,
    life: 0,
    maxLife: 1,
    velocity: new THREE.Vector3(),
    start: new THREE.Vector3(),
  };
  resetSmoke(puff, Math.random());
  smokePuffs.push(puff);
}

// As pedras usam o mesmo material fosco com faces bem marcadas
const stoneMaterial = new THREE.MeshStandardMaterial({
  color: 0x5b5d63,
  roughness: 0.95,
  metalness: 0,
  flatShading: true,
});
const STONE_COUNT = 12;
// Distribui as pedras em círculo com pequenas diferenças de posição, tamanho e rotação
for (let i = 0; i < STONE_COUNT; i++) {
  const angle = (i / STONE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
  const radius = 2.2 + Math.random() * 0.2;
  const stone = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.28 + Math.random() * 0.16, 0),
    stoneMaterial,
  );
  stone.position.set(
    FIRE_BASE.x + Math.cos(angle) * radius,
    0.1,
    FIRE_BASE.z + Math.sin(angle) * radius,
  );
  stone.scale.set(1, 0.65, 1);
  stone.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
  stone.castShadow = true;
  stone.receiveShadow = true;
  scene.add(stone);
}

// Muro de pedra em círculo ao redor da vila, feito com blocos instanciados (uma única draw call)
const WALL_RADIUS = 56;
const WALL_ROWS = 3;
const BLOCK_LENGTH = 1.9; // Comprimento de cada bloco ao longo do muro
const BLOCK_HEIGHT = 0.9;
const BLOCK_THICKNESS = 1.3;

function buildWall() {
  // Quantos blocos cabem em uma volta completa
  const perRow = Math.round((2 * Math.PI * WALL_RADIUS) / BLOCK_LENGTH);

  // O eixo Z do bloco é o comprimento, e fica na direção do muro depois da rotação
  const geometry = new THREE.BoxGeometry(
    BLOCK_THICKNESS,
    BLOCK_HEIGHT,
    BLOCK_LENGTH * 1.05,
  );
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff, // A cor real vem de cada instância
    roughness: 0.95,
    metalness: 0,
    flatShading: true,
  });

  const wall = new THREE.InstancedMesh(geometry, material, perRow * WALL_ROWS);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  let index = 0;
  for (let row = 0; row < WALL_ROWS; row++) {
    // Fileiras alternadas ficam deslocadas meio bloco, como numa parede de pedra de verdade
    const offset = (row % 2) * 0.5;

    for (let k = 0; k < perRow; k++) {
      const angle = ((k + offset) / perRow) * Math.PI * 2;
      const radius = WALL_RADIUS + (Math.random() - 0.5) * 0.25;

      dummy.position.set(
        Math.cos(angle) * radius,
        BLOCK_HEIGHT * (row + 0.5),
        Math.sin(angle) * radius,
      );
      // Gira o bloco para o comprimento acompanhar a curva, com um desvio pequeno
      dummy.rotation.set(0, -angle + (Math.random() - 0.5) * 0.08, 0);
      dummy.scale.set(
        0.95 + Math.random() * 0.15,
        1,
        0.9 + Math.random() * 0.2,
      );
      dummy.updateMatrix();

      wall.setMatrixAt(index, dummy.matrix);
      // Cada pedra recebe um tom de cinza ligeiramente diferente
      wall.setColorAt(
        index,
        color.setHSL(0.6, 0.04, 0.35 + Math.random() * 0.15),
      );
      index++;
    }
  }

  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);
}
buildWall();

// Agrupa os vaga-lumes para esconder junto no modo profundidade
const fireflyGroup = new THREE.Group();
scene.add(fireflyGroup);

const FIREFLY_COUNT = 67;
const fireflyPositions = new Float32Array(FIREFLY_COUNT * 3);
const fireflyColors = new Float32Array(FIREFLY_COUNT * 3);

// Cada vaga-lume tem um ponto de origem, uma fase e velocidades próprias
const fireflies = Array.from({ length: FIREFLY_COUNT }, () => {
  const angle = Math.random() * Math.PI * 2;
  const radius = 6 + Math.random() * (WORLD_RADIUS - 8);
  return {
    x: Math.cos(angle) * radius,
    y: 0.6 + Math.random() * 2.4,
    z: Math.sin(angle) * radius,
    phase: Math.random() * Math.PI * 2,
    speed: 0.3 + Math.random() * 0.5, // Velocidade do passeio
    blink: 0.6 + Math.random() * 1.2, // Velocidade do piscar
  };
});

const fireflyGeometry = new THREE.BufferGeometry();
const fireflyPositionAttribute = new THREE.BufferAttribute(fireflyPositions, 3);
const fireflyColorAttribute = new THREE.BufferAttribute(fireflyColors, 3);
fireflyPositionAttribute.setUsage(THREE.DynamicDrawUsage);
fireflyColorAttribute.setUsage(THREE.DynamicDrawUsage);
fireflyGeometry.setAttribute("position", fireflyPositionAttribute);
fireflyGeometry.setAttribute("color", fireflyColorAttribute);

const fireflyPoints = new THREE.Points(
  fireflyGeometry,
  new THREE.PointsMaterial({
    size: 0.35,
    map: emberTexture,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    fog: false,
  }),
);
// As posições mudam toda hora, então o descarte pela câmera fica desligado
fireflyPoints.frustumCulled = false;
fireflyGroup.add(fireflyPoints);

// Faz cada vaga-lume passear em volta da origem e piscar em um ritmo próprio
function updateFireflies(t) {
  for (let i = 0; i < FIREFLY_COUNT; i++) {
    const f = fireflies[i];
    const a = t * f.speed + f.phase;

    fireflyPositions[i * 3] = f.x + Math.sin(a) * 1.5;
    fireflyPositions[i * 3 + 1] = f.y + Math.sin(a * 1.7) * 0.4;
    fireflyPositions[i * 3 + 2] = f.z + Math.cos(a * 0.8) * 1.5;

    // O brilho sobe e desce, e fica apagado na metade do ciclo
    const blink = Math.pow(Math.max(0, Math.sin(t * f.blink + f.phase * 3)), 2);
    const glow = blink * 2.2;
    // Tom amarelo-esverdeado
    fireflyColors[i * 3] = glow * 0.75;
    fireflyColors[i * 3 + 1] = glow;
    fireflyColors[i * 3 + 2] = glow * 0.25;
  }
  fireflyPositionAttribute.needsUpdate = true;
  fireflyColorAttribute.needsUpdate = true;
}
// Posiciona todos antes do primeiro quadro, para não nascerem na origem
updateFireflies(0);

// Guarda a malha da chama quando o modelo terminar de carregar
let flameMesh = null;

// Procura o material Fire no modelo e prepara a malha da chama para a animação
function setupBonfire(bonfire) {
  bonfire.traverse((child) => {
    if (!child.isMesh || child.material?.name !== "Fire") return;
    flameMesh = child;
    // A fonte de luz fica dentro da chama, então a própria malha bloquearia a iluminação
    child.castShadow = false;
    child.receiveShadow = false;
    const material = child.material;
    // A cor da emissão começa branca e recebe o degradê no shader
    material.emissive.set(0xffffff);
    material.emissiveIntensity = 1.2;
    material.metalness = 0;
    material.roughness = 1;

    // Personaliza o shader para a chama ficar amarela na base e avermelhada na ponta
    material.onBeforeCompile = (shader) => {
      // A altura local da chama está no eixo Z e vai até 0.0113 nesse modelo
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying float vFlameHeight;",
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvFlameHeight = clamp( position.z / 0.0113, 0.0, 1.0 );",
        );
      // A altura calculada nos vértices controla a mistura de cores na superfície
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying float vFlameHeight;",
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
           totalEmissiveRadiance *= mix( vec3( 1.0, 0.82, 0.32 ), vec3( 1.0, 0.2, 0.03 ), smoothstep( 0.0, 1.0, vFlameHeight ) );`,
        );
    };
    material.needsUpdate = true;
  });
}

// Reutiliza o mesmo objeto de cor em todos os quadros
const fireLightColor = new THREE.Color();

// Atualiza a luz, a chama, o brilho, as fagulhas e a fumaça a cada quadro
function updateFire(t, dt) {
  // As defasagens evitam que todos os efeitos pulsem juntos
  const n = flicker(t);
  const n2 = flicker(t, 4.2);
  const n3 = flicker(t, 8.7);

  // Varia a intensidade, o tom e a posição da luz para movimentar também as sombras
  fireLight.intensity = FIRE_LIGHT_INTENSITY * (0.78 + 0.45 * n);
  fireLight.position.set(
    FIRE_BASE.x + (n2 - 0.5) * 0.12,
    1.5 + (n - 0.5) * 0.15,
    FIRE_BASE.z + (n3 - 0.5) * 0.12,
  );
  fireLight.color.copy(fireLightColor.setHSL(0.075 + 0.02 * n2, 1, 0.65));

  // Depois que o modelo carrega, a chama muda de tamanho, inclinação e brilho
  if (flameMesh) {
    flameMesh.scale.set(1.06 - 0.12 * n, 1.06 - 0.12 * n2, 0.9 + 0.25 * n);
    flameMesh.rotation.set(
      0.04 * Math.sin(t * 2.3),
      0.04 * Math.sin(t * 1.9 + 1),
      0.12 * Math.sin(t * 1.7),
    );
    flameMesh.material.emissiveIntensity = 0.95 + 0.6 * n;
  }

  // O brilho em volta da chama aumenta e diminui junto com o fogo
  fireGlow.material.opacity = 0.45 + 0.25 * n;
  fireGlow.scale.setScalar(7 * (0.9 + 0.2 * n2));

  // As fagulhas oscilam de lado enquanto sobem e voltam para a base quando a vida acaba
  for (let i = 0; i < EMBER_COUNT; i++) {
    const ember = embers[i];
    ember.life += dt;
    if (ember.life >= ember.maxLife) resetEmber(i);

    // k vai de zero a um e reduz a velocidade de subida conforme a fagulha envelhece
    const k = ember.life / ember.maxLife;
    emberPositions[i * 3] += (ember.vx + Math.sin(t * 3 + i) * 0.35) * dt;
    emberPositions[i * 3 + 1] += ember.vy * (1 - 0.35 * k) * dt;
    emberPositions[i * 3 + 2] +=
      (ember.vz + Math.cos(t * 2.6 + i * 1.7) * 0.35) * dt;

    // Mistura a perda gradual de brilho com pequenas cintilações
    const fade = Math.pow(1 - k, 1.5) * (0.6 + 0.4 * Math.sin(t * 20 + i * 7));
    const glow = fade * 2.6;
    emberColors[i * 3] = glow;
    emberColors[i * 3 + 1] = glow * (0.55 - 0.3 * k);
    emberColors[i * 3 + 2] = glow * 0.12 * (1 - k);
  }
  // Avisa ao renderer que os dados enviados para a GPU precisam ser atualizados
  emberPositionAttribute.needsUpdate = true;
  emberColorAttribute.needsUpdate = true;

  // Cada partícula de fumaça sobe, cresce, esfria e some antes de reaparecer
  for (const puff of smokePuffs) {
    puff.life += dt;
    if (puff.life >= puff.maxLife) resetSmoke(puff);

    const k = puff.life / puff.maxLife;
    puff.sprite.position
      .copy(puff.start)
      .addScaledVector(puff.velocity, puff.life);
    puff.sprite.scale.setScalar(0.9 + 3 * k);
    // A opacidade sobe e depois volta a zero ao longo da vida da partícula
    puff.sprite.material.opacity = 0.3 * Math.sin(Math.PI * k);
    puff.sprite.material.color
      .copy(SMOKE_WARM)
      .lerp(SMOKE_COOL, Math.min(1, k * 2));
  }
}

// Configura as malhas de um modelo, aplica suas transformações e coloca na cena
function prepareModel(model, options = {}) {
  const {
    position = new THREE.Vector3(0, 0, 0),
    rotationY = 0,
    scale = 1,
    castShadow = true,
  } = options;
  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = castShadow;
      child.receiveShadow = true;

      // Força a opacidade tanto nos modelos com um material quanto nos que usam vários
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

  // Aplica posição, rotação e escala na raiz do modelo para transformar tudo junto
  model.position.copy(position);
  model.rotation.y = rotationY;
  model.scale.setScalar(scale);
  scene.add(model);

  return model;
}

// Centraliza a casa no ponto escolhido, vira a porta para a fogueira e cria o caminho
function placeHouse(house, centerTarget, frontAxis) {
  // Mede o centro real da casa na escala final, com o modelo na origem e sem rotação
  house.scale.setScalar(HOUSE_SCALE);
  house.position.set(0, 0, 0);
  house.rotation.set(0, 0, 0);
  house.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(house);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  // O vetor aponta da casa para a fogueira, e a fórmula do ângulo depende do eixo da porta
  const toFire = new THREE.Vector2(
    -centerTarget.x,
    -centerTarget.z,
  ).normalize();
  const rotationY =
    frontAxis === "x"
      ? Math.atan2(-toFire.y, toFire.x)
      : Math.atan2(toFire.x, toFire.y);

  // Gira o deslocamento do pivô e desconta esse valor para alinhar o centro da casa
  const offset = new THREE.Vector3(center.x, 0, center.z).applyAxisAngle(
    THREE.Object3D.DEFAULT_UP,
    rotationY,
  );
  const position = new THREE.Vector3(
    centerTarget.x - offset.x,
    0,
    centerTarget.z - offset.z,
  );

  prepareModel(house, { position, rotationY, scale: HOUSE_SCALE });

  // Desconta metade da profundidade e a folga para o caminho terminar antes da fachada
  const halfDepth = (frontAxis === "x" ? size.x : size.z) / 2;
  const distanceToFire = Math.hypot(centerTarget.x, centerTarget.z);
  addHousePath(centerTarget, distanceToFire - halfDepth - DOOR_GAP);
}

// Carrega um GLB e devolve a cena do modelo, propagando o erro se o carregamento falhar
function loadGLTF(url) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
  });
}

// Carrega um FBX e devolve o próprio objeto montado pelo loader
function loadFBX(url) {
  return new Promise((resolve, reject) => {
    const loader = new FBXLoader();
    loader.load(url, (model) => resolve(model), undefined, reject);
  });
}

// Guarda um mixer por animal para tocar as animações dos modelos
const animalMixers = [];
const ANIMATION_RANGE = 40; // Só anima os animais a até 40 unidades do jogador

// Procura o clipe pelo nome (idle, walk, run, jump) e começa a tocar em um ponto aleatório
function playAnimation(source, animal, name) {
  const clip =
    source.animations.find((c) => c.name.toLowerCase().includes(name)) ??
    source.animations[0];
  if (!clip) return;

  const mixer = new THREE.AnimationMixer(animal);
  const action = mixer.clipAction(clip);
  // Cada animal começa em um ponto e em uma velocidade um pouco diferentes
  action.time = Math.random() * clip.duration;
  action.timeScale = 0.9 + Math.random() * 0.2;
  action.play();
  animalMixers.push({ mixer, animal });
}

// Carrega e distribui os modelos que formam a vila
async function buildVillage() {
  // A fogueira entra primeiro e tem a malha da chama configurada separadamente
  const bonfire = await loadGLTF(bonfireModelUrl);
  prepareModel(bonfire, {
    position: new THREE.Vector3(0, 0, 0),
    rotationY: 0,
    scale: 1.5,
  });
  setupBonfire(bonfire);

  const houseSources = await Promise.all([
    loadGLTF(houseModelUrl),
    loadGLTF(houseModelSimpleUrl),
    loadGLTF(houseModelAltUrl),
    loadGLTF(houseModelAlt2Url),
  ]);
  const houses = [
    houseSources[0],
    houseSources[1],
    houseSources[2],
    houseSources[3],
    SkeletonUtils.clone(houseSources[0]),
    SkeletonUtils.clone(houseSources[1]),
  ];

  // Cada casa usa o centro e o eixo da porta do mesmo índice
  houses.forEach((house, index) => {
    placeHouse(house, HOUSE_POSITIONS[index], HOUSE_FRONT_AXES[index]);
  });

  // Carrega as 3 variantes uma vez e clona para as 32 posições
  const treeSources = await Promise.all([
    loadFBX(treeModelUrl),
    loadFBX(treeModelAltUrl),
    loadFBX(treeModelAlt2Url),
  ]);
  const trees = Array.from({ length: 32 }, (_, index) =>
    SkeletonUtils.clone(treeSources[index % treeSources.length]),
  );

  const treePositions = [
    new THREE.Vector3(-40, 0, -30),
    new THREE.Vector3(-36, 0, -12),
    new THREE.Vector3(-42, 0, 8),
    new THREE.Vector3(-38, 0, 30),
    new THREE.Vector3(-28, 0, 38),
    new THREE.Vector3(-12, 0, 40),
    new THREE.Vector3(6, 0, 38),
    new THREE.Vector3(24, 0, 40),
    new THREE.Vector3(38, 0, 28),
    new THREE.Vector3(44, 0, 8),
    new THREE.Vector3(40, 0, -18),
    new THREE.Vector3(36, 0, -36),
    new THREE.Vector3(18, 0, -42),
    new THREE.Vector3(0, 0, -40),
    new THREE.Vector3(-18, 0, -38),
    new THREE.Vector3(-30, 0, -34),
    new THREE.Vector3(-44, 0, -22),
    new THREE.Vector3(-46, 0, 24),
    new THREE.Vector3(-18, 0, 26),
    new THREE.Vector3(14, 0, 26),
    new THREE.Vector3(30, 0, 18),
    new THREE.Vector3(42, 0, -2),
    new THREE.Vector3(30, 0, -24),
    new THREE.Vector3(10, 0, -28),
    new THREE.Vector3(-8, 0, -28),
    new THREE.Vector3(-24, 0, 12),
    new THREE.Vector3(26, 0, 6),
    new THREE.Vector3(22, 0, -12),
    new THREE.Vector3(-22, 0, -12),
    new THREE.Vector3(-12, 0, 18),
    new THREE.Vector3(12, 0, 18),
    new THREE.Vector3(0, 0, 30),
  ];

  // Varia a rotação e a escala das árvores para disfarçar a repetição
  trees.forEach((tree, index) => {
    prepareModel(tree, {
      position: treePositions[index],
      rotationY: 0.3 + index * 0.38,
      scale: 0.015 + (index % 3) * 0.001,
    });
  });

  // Cria três cavalos a partir do mesmo modelo
  const horseSource = await loadFBX(animalModelUrl);
  const horses = Array.from({ length: 3 }, () =>
    SkeletonUtils.clone(horseSource),
  );

  const horsePositions = [
    new THREE.Vector3(7, 0.1, 8),
    new THREE.Vector3(-10, 0.1, -7),
    new THREE.Vector3(11, 0.1, -13), // Fora da área da quinta casa
  ];

  // Posiciona os cavalos e vira o primeiro em um ângulo diferente
  horses.forEach((horse, index) => {
    prepareModel(horse, {
      position: horsePositions[index],
      rotationY: index === 0 ? -0.9 : 0.7,
      scale: 0.003,
    });

    playAnimation(horseSource, horse, "idle");
  });

  // Usa quatro cópias do pug em pontos diferentes da vila
  const dogSource = await loadFBX(animalPugModelUrl);
  const dogs = Array.from({ length: 4 }, () => SkeletonUtils.clone(dogSource));

  const dogPositions = [
    new THREE.Vector3(4, 0.1, 10),
    new THREE.Vector3(-3, 0.1, -10),
    new THREE.Vector3(12, 0.1, -6),
    new THREE.Vector3(-12, 0.1, 5),
  ];

  // Alterna a direção dos cachorros conforme o índice
  dogs.forEach((dog, index) => {
    prepareModel(dog, {
      position: dogPositions[index],
      rotationY: index % 2 === 0 ? 0.6 : -0.9,
      scale: 0.004,
    });

    playAnimation(dogSource, dog, "idle");
  });
}

// Estado inicial das opções de diagnóstico
const diag = {
  wireframe: false, // Mostra a malha pelos contornos dos triângulos
  depth: false, // Ativa a visualização da profundidade
  depthMode: "linear", // Alterna entre distância linear e valor do z-buffer
  depthRange: 60, // Distância em que o modo linear chega ao preto
  backFaceCulling: true, // Descarta o verso das faces
  showFrustum: false, // Mostra a visão aérea com o volume visível da câmera
  frustumCulling: true, // Descarta objetos fora do volume visível da câmera
};

// Um material usa a profundidade padrão, e o outro recebe uma adaptação no shader
const rawDepthMaterial = new THREE.MeshDepthMaterial();
const linearDepthMaterial = new THREE.MeshDepthMaterial();
const linearDepthUniform = { value: diag.depthRange };
// Ajusta o shader do modo linear para usar a distância à câmera na escala de cinza
linearDepthMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uMaxDist = linearDepthUniform;
  // Procura a expressão de cor do shader padrão e troca pelo cálculo linear
  const patched = shader.fragmentShader.replace(
    /gl_FragColor\s*=\s*vec4\(\s*vec3\(\s*1\.0\s*-\s*fragCoordZ\s*\)\s*,\s*opacity\s*\)\s*;/,
    "gl_FragColor = vec4( vec3( 1.0 - clamp( vHighPrecisionZW[ 1 ] / uMaxDist, 0.0, 1.0 ) ), opacity );",
  );
  // Avisa no console se a versão do Three.js usar outra expressão
  if (patched === shader.fragmentShader) {
    console.warn(
      "Profundidade linear indisponível nesta versão do Three.js; use o modo z-buffer.",
    );
  }
  shader.fragmentShader = "uniform float uMaxDist;\n" + patched;
};

// Desenha o contorno do volume que a câmera principal consegue enxergar
const frustumHelper = new THREE.CameraHelper(camera);
frustumHelper.visible = false;
scene.add(frustumHelper);

// A câmera secundária olha direto de cima para o centro da vila
const topCamera = new THREE.PerspectiveCamera(50, 1, 1, 300);
topCamera.up.set(0, 0, -1);
topCamera.position.set(0, 75, 0);
topCamera.lookAt(0, 0, 0);

// Adiciona a moldura e o texto da visão aérea sobre o canvas
const insetFrame = document.createElement("div");
insetFrame.textContent = "Visão de cima: frustum da câmera";
Object.assign(insetFrame.style, {
  position: "fixed",
  display: "none",
  boxSizing: "border-box",
  border: "2px solid #fff",
  boxShadow: "0 0 6px rgba(0,0,0,0.6)",
  color: "#fff",
  font: "12px sans-serif",
  textShadow: "0 0 3px #000",
  padding: "3px 6px",
  pointerEvents: "none", // Deixa os cliques passarem para a cena
  zIndex: "5",
});
document.body.appendChild(insetFrame);

const INSET_MARGIN = 12;

// Calcula o tamanho e a posição do quadro da visão aérea no canvas
function getInsetRect() {
  // O lado do quadrado usa a menor dimensão da janela como referência
  const size = Math.round(
    Math.min(window.innerWidth, window.innerHeight) * 0.36,
  );
  return {
    size,
    x: window.innerWidth - size - INSET_MARGIN,
    y: INSET_MARGIN,
  };
}

// Alinha a moldura HTML com a área renderizada e mostra ou esconde conforme o painel
function layoutInset() {
  const r = getInsetRect();
  Object.assign(insetFrame.style, {
    width: `${r.size}px`,
    height: `${r.size}px`,
    right: `${INSET_MARGIN}px`,
    bottom: `${INSET_MARGIN}px`,
    display: diag.showFrustum ? "block" : "none",
  });
}

// Aplica as opções do painel às malhas, aos materiais e ao fundo da cena
function applyDiagnostics() {
  const side = diag.backFaceCulling ? THREE.FrontSide : THREE.DoubleSide;

  // Percorre as malhas e atualiza o descarte pela câmera e o modo de desenho dos materiais
  scene.traverse((obj) => {
    if (!obj.isMesh) return;

    obj.frustumCulled = diag.frustumCulling;

    const materials = Array.isArray(obj.material)
      ? obj.material
      : [obj.material];
    for (const m of materials) {
      m.wireframe = diag.wireframe;
      m.side = side;
    }
  });

  // Aplica as mesmas opções aos materiais usados na visualização da profundidade
  for (const m of [rawDepthMaterial, linearDepthMaterial]) {
    m.wireframe = diag.wireframe;
    m.side = side;
  }

  // Escolhe o material de profundidade e configura o alcance do modo linear
  linearDepthUniform.value = diag.depthRange;
  const depthMaterial =
    diag.depthMode === "linear" ? linearDepthMaterial : rawDepthMaterial;
  scene.overrideMaterial = diag.depth ? depthMaterial : null;
  // No modo de profundidade, a cena fica com fundo preto e sem os efeitos da fogueira
  fireEffects.visible = !diag.depth;
  fireflyGroup.visible = !diag.depth;
  scene.background = diag.depth
    ? new THREE.Color(0x000000)
    : (skyTexture ?? SKY_COLOR);

  layoutInset();
}

// Guarda os controles da GUI que também precisam ser atualizados pelos atalhos
const gui = new GUI({ title: "Modo diagnóstico" });
const ui = {};

ui.wireframe = gui
  .add(diag, "wireframe")
  .name("1 · Wireframe")
  .onChange(applyDiagnostics);

// Reúne o botão da profundidade, a escolha do modo e o alcance linear
const depthFolder = gui.addFolder("2 · Profundidade (z-buffer)");
ui.depth = depthFolder
  .add(diag, "depth")
  .name("Ativar")
  .onChange(applyDiagnostics);
depthFolder
  .add(diag, "depthMode", {
    "Linear (didático)": "linear",
    "z-buffer bruto": "raw",
  })
  .name("Modo")
  .onChange(applyDiagnostics);
depthFolder
  .add(diag, "depthRange", 10, 200, 1)
  .name("Alcance linear")
  .onChange(applyDiagnostics);

// Cada mudança de visibilidade é aplicada na hora
ui.backFaceCulling = gui
  .add(diag, "backFaceCulling")
  .name("3 · Back-face culling")
  .onChange(applyDiagnostics);

ui.showFrustum = gui
  .add(diag, "showFrustum")
  .name("4 · Frustum (visão de cima)")
  .onChange(applyDiagnostics);

ui.frustumCulling = gui
  .add(diag, "frustumCulling")
  .name("5 · Frustum culling")
  .onChange(applyDiagnostics);

// Exibe o FPS, as chamadas de desenho e os triângulos da renderização principal
const stats = { fps: 0, drawCalls: 0, triangles: 0 };
const infoFolder = gui.addFolder("5 · renderer.info (câmera principal)");
infoFolder.add(stats, "fps").name("FPS").listen().disable();
infoFolder.add(stats, "drawCalls").name("Draw calls").listen().disable();
infoFolder.add(stats, "triangles").name("Triângulos").listen().disable();

// Permite ajustar as distâncias de corte da câmera pelo painel
const cameraFolder = gui.addFolder("Câmera (near / far)");
// Recalcula a projeção e atualiza o contorno quando um plano muda
function onCameraPlanesChange() {
  camera.updateProjectionMatrix();
  frustumHelper.update();
}
cameraFolder.add(camera, "near", 0.01, 10, 0.01).onChange(onCameraPlanesChange);
cameraFolder.add(camera, "far", 20, 500, 1).onChange(onCameraPlanesChange);

// Os dois sliders ajustam o brilho visível do céu e o quanto ele ilumina o cenário
const skyFolder = gui.addFolder("Céu (HDR)");
skyFolder.add(scene, "backgroundIntensity", 0, 4, 0.05).name("Brilho do céu");
skyFolder
  .add(scene, "environmentIntensity", 0, 2, 0.05)
  .name("Luz do céu no cenário");

// Liga cada tecla numérica à opção correspondente no painel
const shortcuts = {
  Digit1: "wireframe",
  Digit2: "depth",
  Digit3: "backFaceCulling",
  Digit4: "showFrustum",
  Digit5: "frustumCulling",
};

// Ao pressionar uma tecla, tenta registrar o movimento antes de procurar um atalho
window.addEventListener("keydown", (e) => {
  if (setKey(e.code, true)) {
    e.preventDefault(); // Evita que as setas rolem a página
    return;
  }
  const prop = shortcuts[e.code];
  // Ignora a repetição automática para alternar a opção uma vez por toque
  if (prop && !e.repeat) {
    diag[prop] = !diag[prop];
    applyDiagnostics();
    ui[prop].updateDisplay();
  }
});
// Ao soltar a tecla, limpa o estado do movimento correspondente
window.addEventListener("keyup", (e) => {
  if (setKey(e.code, false)) e.preventDefault();
});

// Aplica as opções iniciais aos objetos que já estão na cena
applyDiagnostics();

// Carrega a vila e reaplica as opções aos modelos que entraram na cena
buildVillage()
  .catch((error) => {
    console.error("Erro ao carregar os modelos do vilarejo:", error);
  })
  .finally(() => {
    applyDiagnostics();
    luzLua.shadow.needsUpdate = true; // desenha a sombra da lua uma única vez
  });

// Desenha a câmera principal e, quando o painel estiver com essa opção ligada, a visão aérea
function render() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  // Zera as estatísticas antes de desenhar o quadro principal
  renderer.info.reset();

  // A visão principal ocupa toda a janela e não mostra o contorno da própria câmera
  frustumHelper.visible = false;
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, w, h);
  renderer.render(scene, camera);

  // Lê os contadores antes de desenhar a segunda câmera
  stats.drawCalls = renderer.info.render.calls;
  stats.triangles = renderer.info.render.triangles;

  // Usa viewport e scissor para desenhar a visão aérea só dentro do quadro no canto
  if (diag.showFrustum) {
    const r = getInsetRect();
    frustumHelper.visible = true;
    renderer.setScissorTest(true);
    renderer.setViewport(r.x, r.y, r.size, r.size);
    renderer.setScissor(r.x, r.y, r.size, r.size);
    renderer.render(scene, topCamera);
    // Devolve o canvas inteiro ao renderer depois da visão aérea
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, w, h);
  }
}

// Conta os quadros e atualiza o FPS a cada meio segundo para o número não ficar tremendo
let fpsFrames = 0;
let fpsTime = 0;

function animate() {
  requestAnimationFrame(animate);

  timer.update();
  // O FPS usa o tempo real, e o movimento usa o passo limitado
  const rawDelta = timer.getDelta();
  const delta = Math.min(rawDelta, 0.1);

  fpsFrames++;
  fpsTime += rawDelta;
  if (fpsTime >= 0.5) {
    stats.fps = Math.round(fpsFrames / fpsTime);
    fpsFrames = 0;
    fpsTime = 0;
  }

  updateMovement(delta);
  updateFire(timer.getElapsed(), delta);
  updateFireflies(timer.getElapsed());

  // Só atualiza o esqueleto dos animais que estão perto do jogador
  const playerPos = controls.object.position;
  for (const { mixer, animal } of animalMixers) {
    if (
      animal.position.distanceToSquared(playerPos) <
      ANIMATION_RANGE * ANIMATION_RANGE
    ) {
      mixer.update(delta);
    }
  }

  render();
}

// Inicia a animação
animate();

// Quando a janela muda de tamanho, reajusta a câmera, o canvas e o quadro da visão aérea
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  frustumHelper.update();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  layoutInset();
});
