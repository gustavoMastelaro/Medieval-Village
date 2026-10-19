import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

import houseModelUrl from './modelos/casa/House-nihGGju7DW.glb?url';
import treeModelUrl from './modelos/arvore/CommonTree_3.fbx?url';
import animalModelUrl from './modelos/animal/Horse.fbx?url';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe6ff);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  200,
);
camera.position.set(12, 8, 18);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 2, 0);

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

buildVillage().catch((error) => {
  console.error('Erro ao carregar os modelos do vilarejo:', error);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});
