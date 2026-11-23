import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import './style.css';

const canvas = document.querySelector('#island-canvas');
const loadingScreen = document.querySelector('#loading-screen');
const loadingMessage = document.querySelector('#loading-message');
const loadingProgress = document.querySelector('#loading-progress');
const liveRegion = document.querySelector('#live-region');
const errorMessage = document.querySelector('#error-message');
const compactScreen = window.matchMedia('(max-width: 760px)').matches;
const loader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
const assets = Object.create(null);
const textures = Object.create(null);
const mixers = [];
const movingClouds = [];
const random = seededRandom(9017);
const shrubMaterials = ['#547952', '#66865e', '#799267'].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }));

let renderer;
let camera;
let controls;
let scene;
let waterTexture;
let waterfallTexture;
let cameraMotion = null;

try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !compactScreen,
    alpha: false,
    powerPreference: 'high-performance',
  });
} catch (error) {
  console.error('Não foi possível iniciar o WebGL:', error);
  errorMessage.hidden = false;
  loadingScreen.hidden = true;
}

if (renderer) {
  initializeRenderer();
  initializeScene();
  renderer.setAnimationLoop(renderFrame);
  prepareIsland().catch((error) => {
    console.error('Falha ao preparar a ilha:', error);
    loadingMessage.textContent = 'Alguns recursos não puderam ser carregados.';
    loadingScreen.classList.add('loading-screen--error');
    window.setTimeout(() => loadingScreen.classList.add('is-hidden'), 1200);
  });
}

function initializeRenderer() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compactScreen ? 1.35 : 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#afd0d9');
  scene.fog = new THREE.FogExp2('#afd0d9', 0.0085);

  camera = new THREE.PerspectiveCamera(compactScreen ? 48 : 39, window.innerWidth / window.innerHeight, 0.1, 220);
  const initialPosition = compactScreen
    ? new THREE.Vector3(41, 34, 49)
    : new THREE.Vector3(28, 25, 34);
  camera.position.copy(initialPosition);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, -0.7, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.enablePan = false;
  controls.minDistance = 20;
  controls.maxDistance = 76;
  controls.minPolarAngle = 0.42;
  controls.maxPolarAngle = 1.43;
  controls.rotateSpeed = compactScreen ? 0.72 : 0.62;
  controls.zoomSpeed = 0.78;
  controls.update();

  scene.add(new THREE.HemisphereLight('#e4f5ee', '#504d49', 2.2));
  const sun = new THREE.DirectionalLight('#fff4dc', 3.3);
  sun.position.set(-22, 34, 19);
  sun.castShadow = true;
  sun.shadow.mapSize.set(compactScreen ? 1024 : 2048, compactScreen ? 1024 : 2048);
  sun.shadow.camera.left = -26;
  sun.shadow.camera.right = 26;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -25;
  sun.shadow.bias = -0.00018;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);

  const fill = new THREE.DirectionalLight('#9ed8df', 0.85);
  fill.position.set(22, 12, -22);
  scene.add(fill);

  window.addEventListener('resize', resizeRenderer);
  bindInterface();
}

function initializeScene() {
  createSkyPuffs();
  const haze = new THREE.Mesh(
    new THREE.SphereGeometry(155, 24, 16),
    new THREE.MeshBasicMaterial({ color: '#bdd9df', side: THREE.BackSide, fog: false }),
  );
  haze.position.y = 14;
  scene.add(haze);
}

async function prepareIsland() {
  const textureSpecs = {
    rock: '/assets/textures/polyhaven/dark_rock_02_4k/color.jpg',
    stone: '/assets/textures/polyhaven/mossy_brick_4k/color.jpg',
    planks: '/assets/textures/polyhaven/weathered_planks_4k/color.jpg',
    earth: '/assets/textures/polyhaven/coast_sand_rocks_02_4k/color.jpg',
    riverbed: '/assets/textures/polyhaven/dry_riverbed_rock_4k/color.jpg',
  };
  const modelSpecs = {
    oak: '/assets/models/kenney/nature/tree_oak.glb',
    tree: '/assets/models/kenney/nature/tree_default.glb',
    rock: '/assets/models/kenney/nature/rock_largeA.glb',
    yellowFlower: '/assets/models/kenney/nature/flower_yellowA.glb',
    redFlower: '/assets/models/kenney/nature/flower_redA.glb',
    purpleFlower: '/assets/models/kenney/nature/flower_purpleA.glb',
    stallGreen: '/assets/models/kenney/fantasy-town/stall-green.glb',
    stallRed: '/assets/models/kenney/fantasy-town/stall-red.glb',
    stallBench: '/assets/models/kenney/fantasy-town/stall-bench.glb',
    sheep: '/assets/models/creatures/Sheep.glb',
    femalePeasant: '/assets/models/quaternius/Female_Peasant.gltf',
    malePeasant: '/assets/models/quaternius/Male_Peasant.gltf',
    maleRanger: '/assets/models/quaternius/Male_Ranger.gltf',
  };
  const resources = [
    ...Object.entries(textureSpecs).map(([key, path]) => ({ key, type: 'texture', path })),
    ...Object.entries(modelSpecs).map(([key, path]) => ({ key, type: 'model', path })),
  ];
  let completed = 0;
  const updateProgress = (label) => {
    completed += 1;
    const percent = Math.round((completed / resources.length) * 100);
    loadingProgress.style.width = `${percent}%`;
    loadingMessage.textContent = label;
  };

  await Promise.all(resources.map(async ({ key, type, path }) => {
    try {
      const loaded = type === 'texture' ? await loadTexture(path) : await loadModel(path);
      if (loaded) (type === 'texture' ? textures : assets)[key] = loaded;
    } catch (error) {
      console.warn(`Recurso opcional indisponível (${key}):`, error);
    } finally {
      updateProgress(type === 'texture' ? 'Aplicando materiais do mundo…' : 'Montando as regiões da ilha…');
    }
  }));

  createIslandBody();
  createTopography();
  createIslandDetails();
  loadingProgress.style.width = '100%';
  loadingMessage.textContent = 'Auralis está pronta para ser explorada.';
  window.setTimeout(() => loadingScreen.classList.add('is-hidden'), 520);
}

function loadTexture(path) {
  return new Promise((resolve, reject) => {
    textureLoader.load(path, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      resolve(texture);
    }, undefined, reject);
  });
}

function loadModel(path) {
  return loader.loadAsync(path).then((gltf) => ({ scene: gltf.scene, animations: gltf.animations || [] }));
}

function createIslandBody() {
  const profiles = [
    { y: 5.18, rx: 14.3, rz: 10.55 },
    { y: 2.7, rx: 14.05, rz: 10.2 },
    { y: 0.0, rx: 11.8, rz: 8.55 },
    { y: -3.6, rx: 8.9, rz: 6.45 },
    { y: -7.5, rx: 5.55, rz: 4.1 },
    { y: -11.2, rx: 2.9, rz: 2.2 },
    { y: -14.1, rx: 0.95, rz: 0.82 },
  ];
  const segments = 96;
  const positions = [];
  const uvs = [];
  const indices = [];

  profiles.forEach((profile, ringIndex) => {
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const edge = islandEdge(angle, ringIndex);
      const yWobble = Math.sin(angle * 7.0 + ringIndex * 0.78) * (ringIndex === 0 ? 0.1 : 0.28);
      const x = Math.cos(angle) * profile.rx * edge;
      const z = Math.sin(angle) * profile.rz * edge;
      positions.push(x, profile.y + yWobble, z);
      uvs.push((segment / segments) * 5.2, (ringIndex / (profiles.length - 1)) * 3.8);
    }
  });

  for (let ring = 0; ring < profiles.length - 1; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const topCurrent = ring * segments + segment;
      const topNext = ring * segments + next;
      const lowerCurrent = (ring + 1) * segments + segment;
      const lowerNext = (ring + 1) * segments + next;
      indices.push(topCurrent, topNext, lowerNext, topCurrent, lowerNext, lowerCurrent);
    }
  }

  const tipIndex = positions.length / 3;
  positions.push(0.2, -16.3, -0.16);
  uvs.push(2.6, 4.4);
  const lastRing = (profiles.length - 1) * segments;
  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments;
    indices.push(lastRing + segment, lastRing + next, tipIndex);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    map: repeatTexture(textures.rock, 2.1, 3.4),
    color: '#9a9b8f',
    roughness: 0.96,
    flatShading: true,
  });
  const body = new THREE.Mesh(geometry, material);
  body.castShadow = true;
  body.receiveShadow = true;
  scene.add(body);

  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.12, 6, 96),
    new THREE.MeshStandardMaterial({ map: repeatTexture(textures.earth, 4, 1), color: '#b8a77e', roughness: 1 }),
  );
  lip.rotation.x = Math.PI / 2;
  lip.scale.set(14.35, 10.62, 1);
  lip.position.y = 4.94;
  lip.castShadow = true;
  lip.receiveShadow = true;
  scene.add(lip);

  const shardGeometry = new THREE.IcosahedronGeometry(1, 0);
  const shardMaterial = new THREE.MeshStandardMaterial({ map: textures.rock || null, color: '#777c7d', flatShading: true, roughness: 1 });
  const shards = [
    [-12.8, -5.0, 3.9, 0.8, 1.6, 0.7],
    [12.2, -2.7, -1.4, 0.6, 1.4, 0.7],
    [-8.2, -8.2, -4.1, 0.8, 1.7, 0.6],
    [8.7, -6.7, 4.0, 0.65, 1.2, 0.8],
    [-3.1, -10.5, 6.3, 0.55, 1.3, 0.5],
  ];
  shards.forEach(([x, y, z, sx, sy, sz], index) => {
    const shard = new THREE.Mesh(shardGeometry, shardMaterial);
    shard.position.set(x, y, z);
    shard.scale.set(sx, sy, sz);
    shard.rotation.set(0.3 * index, index * 0.7, 0.2 * index);
    shard.castShadow = true;
    scene.add(shard);
  });
}

function createTopography() {
  const rings = 15;
  const segments = 96;
  const positions = [0, surfaceHeight(0, 0), 0];
  const uvs = [0.5, 0.5];
  const indices = [];
  for (let ring = 1; ring <= rings; ring += 1) {
    const radius = ring / rings;
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const edge = islandEdge(angle, 0);
      const x = Math.cos(angle) * 14.3 * radius * edge;
      const z = Math.sin(angle) * 10.55 * radius * edge;
      positions.push(x, surfaceHeight(x, z) - Math.pow(radius, 7) * 0.1, z);
      uvs.push(x / 5.4 + 0.5, z / 5.4 + 0.5);
    }
  }

  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments;
    indices.push(0, 1 + next, 1 + segment);
  }
  for (let ring = 1; ring < rings; ring += 1) {
    const innerStart = 1 + (ring - 1) * segments;
    const outerStart = 1 + ring * segments;
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const inner = innerStart + segment;
      const innerNext = innerStart + next;
      const outer = outerStart + segment;
      const outerNext = outerStart + next;
      indices.push(inner, outerNext, outer, inner, innerNext, outerNext);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    map: makeMeadowTexture(),
    color: '#c3d4a3',
    roughness: 1,
    side: THREE.DoubleSide,
  });
  const meadow = new THREE.Mesh(geometry, material);
  meadow.receiveShadow = true;
  meadow.castShadow = false;
  scene.add(meadow);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.19, 6, 96),
    new THREE.MeshStandardMaterial({ map: repeatTexture(textures.earth, 3, 2), color: '#b6ab7e', roughness: 1 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(14.25, 10.48, 1);
  rim.position.y = 5.01;
  rim.receiveShadow = true;
  scene.add(rim);
}

function createIslandDetails() {
  const materials = createWorldMaterials();
  createMountain(materials);
  createLake(materials);
  createPaths(materials);
  createVillage(materials);
  createSheepField(materials);
  createForest();
  createFlowers();
  createWaterfalls();
  createCloudRing();
  createFloatingStones();
}

function createWorldMaterials() {
  const woodTexture = repeatTexture(textures.planks, 2.5, 1.5);
  const stoneTexture = repeatTexture(textures.stone, 2, 2);
  return {
    wood: new THREE.MeshStandardMaterial({ map: woodTexture, color: '#c09a6a', roughness: 0.85 }),
    roof: new THREE.MeshStandardMaterial({ color: '#8c5142', roughness: 0.85, flatShading: true, side: THREE.DoubleSide }),
    plaster: new THREE.MeshStandardMaterial({ color: '#e4d5b3', roughness: 1, flatShading: true }),
    stone: new THREE.MeshStandardMaterial({ map: stoneTexture, color: '#b6b29c', roughness: 0.98, flatShading: true }),
    darkStone: new THREE.MeshStandardMaterial({ map: repeatTexture(textures.riverbed, 2.3, 2.1), color: '#878a7d', roughness: 1, flatShading: true }),
    glass: new THREE.MeshStandardMaterial({ color: '#8bc9c5', roughness: 0.25, metalness: 0.1, emissive: '#264d4c', emissiveIntensity: 0.3 }),
    path: new THREE.MeshStandardMaterial({ color: '#c3a97e', roughness: 1, flatShading: true }),
    bank: new THREE.MeshStandardMaterial({ map: repeatTexture(textures.earth, 2, 2), color: '#c8b88d', roughness: 1 }),
    water: makeWaterMaterial(),
    river: new THREE.MeshStandardMaterial({ color: '#67bac5', roughness: 0.18, metalness: 0.06, transparent: true, opacity: 0.92 }),
  };
}

function createMountain(materials) {
  const mountain = new THREE.Group();
  mountain.position.set(0.15, surfaceHeight(0.15, 6.85), 6.85);
  scene.add(mountain);

  const peakSpecs = [
    { x: 0, z: -0.35, radius: 3.0, height: 7.7, color: '#777c7b' },
    { x: -2.5, z: 0.45, radius: 2.35, height: 5.25, color: '#8a8579' },
    { x: 2.35, z: 0.72, radius: 2.55, height: 5.65, color: '#6e7879' },
    { x: 0.65, z: 2.25, radius: 2.2, height: 4.1, color: '#928b79' },
  ];
  peakSpecs.forEach(({ x, z, radius, height, color }, index) => {
    const peak = new THREE.Mesh(
      new THREE.ConeGeometry(radius, height, 7, 3),
      new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }),
    );
    peak.position.set(x, height * 0.48, z);
    peak.rotation.y = index * 0.65;
    peak.castShadow = true;
    peak.receiveShadow = true;
    mountain.add(peak);

    const shoulder = new THREE.Mesh(
      new THREE.DodecahedronGeometry(radius * 0.72, 0),
      index % 2 ? materials.darkStone : materials.stone,
    );
    shoulder.position.set(x * 1.08 + 0.25, 1.05 + index * 0.07, z + 1.15);
    shoulder.scale.set(1.5, 0.8, 1.1);
    shoulder.rotation.set(0.2, index * 0.45, -0.12);
    shoulder.castShadow = true;
    mountain.add(shoulder);
  });

  const ledge = new THREE.Mesh(
    new THREE.CylinderGeometry(3.25, 3.85, 1.05, 9, 1),
    materials.darkStone,
  );
  ledge.position.set(0, 0.2, 0.65);
  ledge.rotation.y = 0.2;
  ledge.castShadow = true;
  mountain.add(ledge);

  const greenShelf = new THREE.Mesh(
    new THREE.CylinderGeometry(2.7, 3.15, 0.28, 10),
    new THREE.MeshStandardMaterial({ color: '#769064', roughness: 1, flatShading: true }),
  );
  greenShelf.position.set(0, 0.82, 0.65);
  greenShelf.castShadow = true;
  mountain.add(greenShelf);

  const pinePositions = [[-2.35, 1.0], [2.1, 0.65], [1.5, 2.1], [-1.1, 2.15]];
  pinePositions.forEach(([x, z], index) => makePine(x, 1.02, z, 0.8 + (index % 2) * 0.2, mountain));
}

function makePine(x, y, z, scale = 1, parent = scene) {
  const pine = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12 * scale, 0.2 * scale, 1.5 * scale, 6),
    new THREE.MeshStandardMaterial({ color: '#6b4f38', roughness: 1 }),
  );
  trunk.position.y = 0.72 * scale;
  pine.add(trunk);
  [1.25, 1.85, 2.35].forEach((height, index) => {
    const tier = new THREE.Mesh(
      new THREE.ConeGeometry((1.0 - index * 0.18) * scale, 1.65 * scale, 7, 1),
      new THREE.MeshStandardMaterial({ color: index === 1 ? '#4d785b' : '#527e60', roughness: 1, flatShading: true }),
    );
    tier.position.y = height * scale;
    tier.castShadow = true;
    pine.add(tier);
  });
  pine.position.set(x, y, z);
  parent.add(pine);
  return pine;
}

function createLake(materials) {
  const lakeX = -3.5;
  const lakeZ = 0.55;
  const bank = new THREE.Mesh(new THREE.CircleGeometry(1, 64), materials.bank);
  bank.rotation.x = -Math.PI / 2;
  bank.scale.set(4.1, 2.9, 1);
  bank.position.set(lakeX, surfaceHeight(lakeX, lakeZ) + 0.04, lakeZ);
  bank.receiveShadow = true;
  scene.add(bank);

  waterTexture = createWaterTexture();
  const waterMaterial = materials.water;
  waterMaterial.map = waterTexture;
  const water = new THREE.Mesh(new THREE.CircleGeometry(1, 64), waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.scale.set(3.55, 2.38, 1);
  water.position.set(lakeX, surfaceHeight(lakeX, lakeZ) + 0.075, lakeZ);
  water.receiveShadow = true;
  scene.add(water);

  const rippleMaterial = new THREE.MeshBasicMaterial({ color: '#d9f1df', transparent: true, opacity: 0.28, side: THREE.DoubleSide });
  [[-4.2, -0.3, 0.72], [-2.3, 1.0, 0.45], [-4.25, 1.55, 0.35]].forEach(([x, z, size]) => {
    const ripple = new THREE.Mesh(new THREE.TorusGeometry(size, 0.022, 4, 32), rippleMaterial);
    ripple.rotation.x = Math.PI / 2;
    ripple.position.set(x, surfaceHeight(lakeX, lakeZ) + 0.1, z);
    ripple.scale.set(1.2, 0.65, 1);
    scene.add(ripple);
  });

  for (let i = 0; i < 10; i += 1) {
    const angle = (i / 10) * Math.PI * 2;
    const x = lakeX + Math.cos(angle) * (3.82 + random() * 0.12);
    const z = lakeZ + Math.sin(angle) * (2.63 + random() * 0.12);
    addModel('rock', x, z, 0.58 + random() * 0.48, angle);
  }
}

function createPaths(materials) {
  createPathRibbon([
    [-7.4, -7.4], [-4.9, -5.4], [-1.9, -4.4], [0.9, -3.6], [3.2, -1.1], [5.25, 1.0], [5.1, 4.1], [2.8, 6.6], [0.7, 8.0],
  ], 0.9, materials.path);
  createPathRibbon([
    [0.8, -3.6], [3.0, -4.2], [5.8, -4.8], [8.1, -4.2], [9.1, -2.25], [8.5, -0.2], [7.5, 1.3],
  ], 0.68, materials.path);
  createPathRibbon([
    [2.8, 6.6], [4.0, 5.0], [5.1, 4.1], [3.7, 2.3], [1.4, 0.9], [-0.2, 0.2], [-1.0, 0.3],
  ], 0.52, materials.river);
}

function createPathRibbon(points, width, material) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, surfaceHeight(x, z) + 0.07, z)), false, 'centripetal');
  const steps = Math.max(32, points.length * 9);
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const point = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const normal = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    const fade = Math.min(1, Math.min(t * 10, (1 - t) * 10));
    const halfWidth = width * (0.65 + 0.35 * fade) * 0.5;
    positions.push(point.x - normal.x * halfWidth, surfaceHeight(point.x - normal.x * halfWidth, point.z - normal.z * halfWidth) + 0.08, point.z - normal.z * halfWidth);
    positions.push(point.x + normal.x * halfWidth, surfaceHeight(point.x + normal.x * halfWidth, point.z + normal.z * halfWidth) + 0.08, point.z + normal.z * halfWidth);
    uvs.push(0, t * 3, 1, t * 3);
    if (i < steps) {
      const current = i * 2;
      indices.push(current, current + 2, current + 1, current + 1, current + 2, current + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const ribbon = new THREE.Mesh(geometry, material);
  ribbon.material.side = THREE.DoubleSide;
  ribbon.receiveShadow = true;
  scene.add(ribbon);
  return ribbon;
}

function createVillage(materials) {
  const square = new THREE.Mesh(new THREE.CircleGeometry(1, 32), materials.path);
  square.rotation.x = -Math.PI / 2;
  square.scale.set(2.4, 1.65, 1);
  square.position.set(-1.6, surfaceHeight(-1.6, -4.1) + 0.03, -4.1);
  scene.add(square);

  addHouse(-7.25, -7.3, 1.1, -0.18, materials, '#d8c59b');
  addHouse(-4.7, -7.4, 0.92, 0.15, materials, '#d2b88a');
  addHouse(-7.15, -4.9, 0.82, -0.3, materials, '#c6c09c');
  addHouse(-4.3, -4.35, 0.84, 0.15, materials, '#d2c4a6');

  addModel('stallGreen', -1.65, -5.95, 2.45, -0.1);
  addModel('stallRed', 0.85, -5.7, 2.42, 0.12);
  addModel('stallBench', -0.25, -4.52, 1.65, 0.18);
  addCrate(-0.3, -6.28, '#a5693d', 0.46);
  addCrate(1.75, -5.55, '#b67e48', 0.38);
  addBarrel(-2.8, -5.45, 0.46);
  addLantern(-3.35, -4.75, 2.0);
  addLantern(0.8, -3.75, 2.2);

  addTower(7.55, 1.4, materials);
  addModel('femalePeasant', -2.4, -4.65, 1.8, -0.45);
  addModel('malePeasant', -0.15, -5.15, 1.82, Math.PI * 0.82);
  addModel('maleRanger', 2.35, 0.15, 1.86, -0.7);
}

function addHouse(x, z, scale, yaw, materials, plasterColor) {
  const house = new THREE.Group();
  house.position.set(x, surfaceHeight(x, z), z);
  house.rotation.y = yaw;
  house.scale.setScalar(scale);
  scene.add(house);

  const stoneStep = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.32, 2.25), materials.darkStone);
  stoneStep.position.y = 0.16;
  stoneStep.castShadow = true;
  stoneStep.receiveShadow = true;
  house.add(stoneStep);

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.45, 1.65, 1.95), materials.plaster.clone());
  body.material.color.set(plasterColor);
  body.position.y = 1.05;
  body.castShadow = true;
  body.receiveShadow = true;
  house.add(body);

  const roofGeometry = new THREE.BufferGeometry();
  roofGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -1.55, 1.72, -1.22, -1.55, 1.72, 1.22, 0, 2.75, 1.22, 0, 2.75, -1.22,
    0, 2.75, -1.22, 0, 2.75, 1.22, 1.55, 1.72, 1.22, 1.55, 1.72, -1.22,
  ], 3));
  roofGeometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0], 2));
  roofGeometry.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  roofGeometry.computeVertexNormals();
  const roof = new THREE.Mesh(roofGeometry, materials.roof.clone());
  roof.material.color.set(['#925b48', '#7d5d48', '#9a6348'][Math.floor(random() * 3)]);
  roof.castShadow = true;
  house.add(roof);

  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.82, 0.16), materials.wood);
  [-1.11, 1.11].forEach((xBeam) => {
    [-0.91, 0.91].forEach((zBeam) => {
      const post = beam.clone();
      post.position.set(xBeam, 1.04, zBeam);
      post.castShadow = true;
      house.add(post);
    });
  });
  const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.13, 0.15), materials.wood);
  crossBeam.position.set(0, 1.78, 0.98);
  house.add(crossBeam);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.92, 0.11), materials.wood);
  door.position.set(0.68, 0.69, 1.03);
  house.add(door);
  const doorKnob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshStandardMaterial({ color: '#e8c46c', metalness: 0.5, roughness: 0.4 }));
  doorKnob.position.set(0.83, 0.68, 1.1);
  house.add(doorKnob);

  [-0.72, 0.0].forEach((windowX) => addWindow(house, windowX, 1.28, 1.0, materials));
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.05, 0.42), materials.stone);
  chimney.position.set(-0.85, 2.45, -0.45);
  chimney.castShadow = true;
  house.add(chimney);
  const chimneyCap = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.5), materials.darkStone);
  chimneyCap.position.set(-0.85, 2.98, -0.45);
  house.add(chimneyCap);

  const garden = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.1, 0.22), new THREE.MeshStandardMaterial({ color: '#668051', roughness: 1 }));
  garden.position.set(-0.2, 0.13, -1.25);
  house.add(garden);
}

function addWindow(parent, x, y, z, materials) {
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.56, 0.13), materials.wood);
  frame.position.set(x, y, z + 0.04);
  parent.add(frame);
  const pane = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.4, 0.14), materials.glass);
  pane.position.set(x, y + 0.015, z + 0.1);
  parent.add(pane);
  const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.4, 0.04), materials.wood);
  mullion.position.set(x, y, z + 0.18);
  parent.add(mullion);
}

function addTower(x, z, materials) {
  const tower = new THREE.Group();
  tower.position.set(x, surfaceHeight(x, z), z);
  scene.add(tower);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.3, 3.25, 10, 1), materials.stone);
  base.position.y = 1.63;
  base.castShadow = true;
  base.receiveShadow = true;
  tower.add(base);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.42, 0.38, 10), materials.darkStone);
  foot.position.y = 0.21;
  foot.castShadow = true;
  tower.add(foot);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.38, 1.7, 8, 1), new THREE.MeshStandardMaterial({ color: '#7a413c', roughness: 0.86, flatShading: true }));
  roof.position.y = 4.0;
  roof.castShadow = true;
  tower.add(roof);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.8, 5), new THREE.MeshStandardMaterial({ color: '#dab36c', metalness: 0.4, roughness: 0.5 }));
  cap.position.y = 5.12;
  tower.add(cap);
  [-0.54, 0.54].forEach((windowX) => {
    const windowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.65, 0.1), materials.glass);
    windowMesh.position.set(windowX, 2.15, 0.99);
    tower.add(windowMesh);
  });
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.43, 0.34), materials.stone);
    merlon.position.set(Math.cos(angle) * 1.02, 3.35, Math.sin(angle) * 1.02);
    merlon.castShadow = true;
    tower.add(merlon);
  }
}

function createSheepField(materials) {
  const centerX = 7.35;
  const centerZ = -3.4;
  const width = 7.2;
  const depth = 5.4;
  const fenceMaterial = new THREE.MeshStandardMaterial({ map: repeatTexture(textures.planks, 1.5, 1), color: '#a58458', roughness: 0.95 });
  const fence = new THREE.Group();
  fence.position.set(centerX, surfaceHeight(centerX, centerZ), centerZ);
  scene.add(fence);
  const corners = [
    [-width / 2, -depth / 2], [width / 2, -depth / 2], [width / 2, depth / 2], [-width / 2, depth / 2],
  ];
  const postGeometry = new THREE.BoxGeometry(0.16, 1.05, 0.16);
  corners.forEach(([x, z]) => {
    const post = new THREE.Mesh(postGeometry, fenceMaterial);
    post.position.set(x, 0.52, z);
    post.castShadow = true;
    fence.add(post);
  });
  [[-width / 2, 0, 0, depth], [width / 2, 0, 0, depth], [0, -depth / 2, width, 0], [0, depth / 2, width, 0]].forEach(([x, z, dx, dz]) => {
    const length = Math.hypot(dx, dz);
    [0.38, 0.79].forEach((height) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.12, 0.13), fenceMaterial);
      rail.position.set(x, height, z);
      rail.rotation.y = dx === 0 ? Math.PI / 2 : 0;
      rail.castShadow = true;
      fence.add(rail);
    });
  });
  const trough = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.28, 0.42), materials.wood);
  trough.position.set(1.05, 0.23, -0.55);
  fence.add(trough);

  const sheepSpots = [
    [-2.1, -1.0], [-0.25, -1.25], [1.8, -1.12], [-1.25, 0.35], [0.75, 0.55], [-2.05, 1.45], [2.05, 1.45],
  ];
  sheepSpots.forEach(([dx, dz], index) => {
    const sheep = addModel('sheep', centerX + dx, centerZ + dz, 1.38 + (index % 3) * 0.03, random() * Math.PI * 2);
    if (sheep && assets.sheep?.animations?.length) {
      const mixer = new THREE.AnimationMixer(sheep.model);
      const preferred = assets.sheep.animations.find((clip) => clip.name.toLowerCase() === 'graze')
        || assets.sheep.animations.find((clip) => clip.name.toLowerCase() === 'idle')
        || assets.sheep.animations[0];
      if (preferred) mixer.clipAction(preferred).play();
      mixers.push(mixer);
    }
  });
}

function createForest() {
  const points = [];
  let attempts = 0;
  while (points.length < (compactScreen ? 31 : 42) && attempts < 360) {
    attempts += 1;
    const angle = random() * Math.PI * 2;
    const radius = 0.64 + random() * 0.28;
    const x = Math.cos(angle) * 13.95 * radius;
    const z = Math.sin(angle) * 10.22 * radius;
    if (!insideIsland(x, z, 0.96) || isProtectedArea(x, z)) continue;
    if (points.some(([px, pz]) => Math.hypot(px - x, pz - z) < 2.0)) continue;
    points.push([x, z]);
  }

  points.forEach(([x, z], index) => {
    const key = assets.oak && index % 3 !== 0 ? 'oak' : 'tree';
    const height = 3.6 + random() * 1.7;
    addModel(key, x, z, height, random() * Math.PI * 2);
    if (index % 4 === 0) addModel('rock', x + (random() - 0.5) * 0.9, z + (random() - 0.5) * 0.8, 0.55 + random() * 0.65, random() * Math.PI);
    if (index % 3 === 0) makeShrub(x + (random() - 0.5) * 1.2, z + (random() - 0.5) * 1.2, 0.48 + random() * 0.38);
  });

  const outerBushes = [[-10, -5], [-10.7, -1], [-9.2, 3.2], [9.6, -7], [10.8, 4], [6.3, 7.7], [-7.1, 7.2]];
  outerBushes.forEach(([x, z], i) => makeShrub(x, z, 0.8 + (i % 3) * 0.14));
}

function isProtectedArea(x, z) {
  const near = (cx, cz, radius) => Math.hypot(x - cx, z - cz) < radius;
  if (near(-5.7, -6.0, 4.0)) return true;
  if (near(7.35, -3.4, 4.5)) return true;
  if (near(7.55, 1.4, 2.6)) return true;
  if (near(-3.5, 0.55, 4.7)) return true;
  if (near(0.15, 7.1, 4.3)) return true;
  return false;
}

function createFlowers() {
  const flowerKeys = ['yellowFlower', 'redFlower', 'purpleFlower'];
  const patches = [
    [-8.5, -2.5], [-6.1, -3.0], [-3.6, -8.7], [-1.8, -2.8], [3.4, -6.2], [4.4, 3.6], [-6.8, 4.8], [8.2, 5.8],
  ];
  patches.forEach(([cx, cz], patchIndex) => {
    for (let i = 0; i < 5; i += 1) {
      const x = cx + (random() - 0.5) * 1.25;
      const z = cz + (random() - 0.5) * 1.1;
      const key = flowerKeys[(i + patchIndex) % flowerKeys.length];
      addModel(key, x, z, 0.42 + random() * 0.22, random() * Math.PI * 2);
    }
  });
}

function createWaterfalls() {
  waterfallTexture = createWaterfallTexture();
  const falls = [
    { x: -1.4, z: 10.42, width: 2.55, top: 5.35, bottom: -10.7 },
    { x: 2.25, z: 9.88, width: 1.25, top: 4.92, bottom: -7.2 },
    { x: -4.35, z: 8.55, width: 0.88, top: 4.75, bottom: -5.2 },
  ];
  falls.forEach(({ x, z, width, top, bottom }, index) => {
    const columns = 8;
    const rows = 12;
    const positions = [];
    const uvs = [];
    const indices = [];
    for (let row = 0; row <= rows; row += 1) {
      const v = row / rows;
      const y = THREE.MathUtils.lerp(top, bottom, v);
      for (let column = 0; column <= columns; column += 1) {
        const u = column / columns;
        const wobble = Math.sin(u * Math.PI * 3 + v * 2.8 + index) * 0.16;
        positions.push(x + (u - 0.5) * width + wobble, y, z + Math.sin(v * 3.3 + u * 2.0 + index) * 0.08);
        uvs.push(u, v * 2.6);
      }
    }
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const a = row * (columns + 1) + column;
        const b = a + 1;
        const c = a + columns + 1;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const material = new THREE.MeshBasicMaterial({
      map: waterfallTexture,
      color: index === 0 ? '#b6f4f1' : '#85dce3',
      transparent: true,
      opacity: index === 0 ? 0.82 : 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const waterfall = new THREE.Mesh(geometry, material);
    waterfall.renderOrder = 3;
    scene.add(waterfall);
    const foam = new THREE.Mesh(
      new THREE.TorusGeometry(width * 0.42, 0.09, 5, 36),
      new THREE.MeshBasicMaterial({ color: '#d9f7ec', transparent: true, opacity: 0.42 }),
    );
    foam.rotation.x = Math.PI / 2;
    foam.scale.set(1, 0.58, 1);
    foam.position.set(x, bottom + 0.22, z + 0.1);
    scene.add(foam);
  });
}

function createCloudRing() {
  const cloudMaterial = new THREE.MeshStandardMaterial({ color: '#f3fbf1', roughness: 1, transparent: true, opacity: 0.72, depthWrite: false });
  const cloudSpecs = [
    [-13.2, -5.2, -7.8, 2.5], [-15.2, -7.9, 1.2, 2.4], [12.8, -5.8, -5.0, 2.6], [15.1, -8.5, 3.0, 2.9],
    [-9.2, -8.7, 8.1, 2.3], [10.6, -10.0, 8.3, 2.8], [-3.0, -12.2, 10.1, 2.3], [4.0, -10.9, -8.3, 2.2],
  ];
  cloudSpecs.forEach(([x, y, z, size], index) => {
    const cloud = new THREE.Group();
    const puffs = 5 + (index % 3);
    for (let i = 0; i < puffs; i += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9), cloudMaterial);
      puff.position.set((random() - 0.5) * size * 1.15, (random() - 0.5) * size * 0.34, (random() - 0.5) * size * 0.8);
      puff.scale.set(size * (0.48 + random() * 0.25), size * (0.25 + random() * 0.16), size * (0.38 + random() * 0.22));
      cloud.add(puff);
    }
    cloud.position.set(x, y, z);
    cloud.userData.drift = (random() - 0.5) * 0.14;
    movingClouds.push(cloud);
    scene.add(cloud);
  });
}

function createSkyPuffs() {
  const material = new THREE.MeshBasicMaterial({ color: '#f3fbfc', transparent: true, opacity: 0.65, depthWrite: false, fog: false });
  const groups = [
    [-31, 15, -24, 6.8], [31, 18, -32, 7.6], [-35, 11, 11, 5.8], [36, 13, 20, 7.2], [0, 17, -42, 8.3],
  ];
  groups.forEach(([x, y, z, scale], index) => {
    const cloud = new THREE.Group();
    for (let i = 0; i < 5; i += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), material);
      puff.position.set((i - 2) * scale * 0.36, Math.sin(i * 1.7 + index) * scale * 0.08, Math.cos(i * 0.8) * scale * 0.12);
      puff.scale.set(scale * 0.45, scale * 0.22, scale * 0.32);
      cloud.add(puff);
    }
    cloud.position.set(x, y, z);
    scene.add(cloud);
  });
}

function createFloatingStones() {
  const material = new THREE.MeshStandardMaterial({ map: textures.rock || null, color: '#828982', flatShading: true, roughness: 1 });
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const pieces = [
    [-18.6, 0.9, -4.2, 1.4, 0.65, 1.0], [18.8, -1.2, 5.5, 1.2, 0.78, 0.85], [-15.7, 2.8, 8.9, 0.72, 0.42, 0.65], [16.2, 4.7, -9.4, 0.66, 0.5, 0.7],
  ];
  pieces.forEach(([x, y, z, sx, sy, sz], index) => {
    const stone = new THREE.Mesh(geometry, material);
    stone.position.set(x, y, z);
    stone.scale.set(sx, sy, sz);
    stone.rotation.set(index * 0.35, index * 0.8, 0.4 * index);
    stone.castShadow = true;
    scene.add(stone);
  });
}

function addModel(key, x, z, targetHeight, rotation = 0) {
  const source = assets[key];
  if (!source) return null;
  const model = cloneSkinned(source.scene);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  if (!size.y || !Number.isFinite(size.y)) return null;
  model.scale.multiplyScalar(targetHeight / size.y);
  model.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(model);
  model.position.y -= scaledBox.min.y;
  model.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  const anchor = new THREE.Group();
  anchor.position.set(x, surfaceHeight(x, z), z);
  anchor.rotation.y = rotation;
  anchor.add(model);
  scene.add(anchor);
  return { anchor, model };
}

function addCrate(x, z, color, size = 0.42) {
  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(size, size * 0.82, size),
    new THREE.MeshStandardMaterial({ map: repeatTexture(textures.planks, 1, 1), color, roughness: 0.95 }),
  );
  crate.position.set(x, surfaceHeight(x, z) + size * 0.41, z);
  crate.rotation.y = random() * 0.5;
  crate.castShadow = true;
  crate.receiveShadow = true;
  scene.add(crate);
}

function addBarrel(x, z, radius) {
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.78, radius, 0.75, 10),
    new THREE.MeshStandardMaterial({ map: repeatTexture(textures.planks, 1, 1), color: '#9b6940', roughness: 0.92 }),
  );
  barrel.position.set(x, surfaceHeight(x, z) + 0.39, z);
  barrel.castShadow = true;
  scene.add(barrel);
  [0.18, 0.58].forEach((y) => {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.81, 0.035, 4, 12), new THREE.MeshStandardMaterial({ color: '#78624a', metalness: 0.2, roughness: 0.7 }));
    hoop.rotation.x = Math.PI / 2;
    hoop.position.set(x, surfaceHeight(x, z) + y, z);
    scene.add(hoop);
  });
}

function addLantern(x, z, height) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, height, 6), new THREE.MeshStandardMaterial({ color: '#604d39', roughness: 0.9 }));
  pole.position.set(x, surfaceHeight(x, z) + height * 0.5, z);
  pole.castShadow = true;
  scene.add(pole);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.34), new THREE.MeshStandardMaterial({ color: '#f2c979', emissive: '#f2a54f', emissiveIntensity: 0.6, roughness: 0.4 }));
  lamp.position.set(x, surfaceHeight(x, z) + height + 0.02, z);
  scene.add(lamp);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.24, 4), new THREE.MeshStandardMaterial({ color: '#745b40', roughness: 0.9 }));
  cap.position.set(x, surfaceHeight(x, z) + height + 0.34, z);
  cap.rotation.y = Math.PI / 4;
  scene.add(cap);
  const light = new THREE.PointLight('#ffd387', 0.9, 5, 2);
  light.position.set(x, surfaceHeight(x, z) + height + 0.12, z);
  scene.add(light);
}

function makeShrub(x, z, scale) {
  const shrub = new THREE.Group();
  for (let i = 0; i < 4; i += 1) {
    const leaf = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.75, 0),
      shrubMaterials[i % shrubMaterials.length],
    );
    leaf.position.set((random() - 0.5) * 0.85, 0.45 + random() * 0.5, (random() - 0.5) * 0.7);
    leaf.scale.set(0.72 + random() * 0.34, 0.62 + random() * 0.36, 0.68 + random() * 0.3);
    leaf.castShadow = true;
    shrub.add(leaf);
  }
  shrub.scale.setScalar(scale);
  shrub.position.set(x, surfaceHeight(x, z), z);
  scene.add(shrub);
}

function makeMeadowTexture() {
  const canvasTextureSource = document.createElement('canvas');
  canvasTextureSource.width = 512;
  canvasTextureSource.height = 512;
  const context = canvasTextureSource.getContext('2d');
  context.fillStyle = '#87a96d';
  context.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2000; i += 1) {
    const x = random() * 512;
    const y = random() * 512;
    const r = 2 + random() * 12;
    context.fillStyle = random() > 0.56 ? 'rgba(42,79,54,0.075)' : 'rgba(231,220,159,0.09)';
    context.beginPath();
    context.ellipse(x, y, r * 1.5, r * 0.6, random() * 3.14, 0, Math.PI * 2);
    context.fill();
  }
  for (let i = 0; i < 1200; i += 1) {
    const x = random() * 512;
    const y = random() * 512;
    const height = 3 + random() * 9;
    context.strokeStyle = random() > 0.5 ? 'rgba(31,74,48,0.18)' : 'rgba(204,218,148,0.24)';
    context.lineWidth = 1 + random() * 1.1;
    context.beginPath();
    context.moveTo(x, y);
    context.quadraticCurveTo(x + (random() - 0.5) * 5, y - height * 0.45, x + (random() - 0.5) * 7, y - height);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvasTextureSource);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4.4, 3.6);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function createWaterTexture() {
  const source = document.createElement('canvas');
  source.width = 256;
  source.height = 256;
  const context = source.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 256, 256);
  gradient.addColorStop(0, '#5ab5bb');
  gradient.addColorStop(0.5, '#317f91');
  gradient.addColorStop(1, '#70c4c2');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 14; row += 1) {
    const y = row * 21 + 7;
    context.beginPath();
    context.moveTo(0, y);
    context.bezierCurveTo(65, y - 9, 112, y + 11, 170, y + 1);
    context.bezierCurveTo(205, y - 5, 228, y - 1, 256, y - 7);
    context.strokeStyle = row % 3 === 0 ? 'rgba(221,249,224,0.38)' : 'rgba(164,226,218,0.24)';
    context.lineWidth = row % 3 === 0 ? 2.4 : 1.2;
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(source);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3.4, 2.6);
  return texture;
}

function createWaterfallTexture() {
  const source = document.createElement('canvas');
  source.width = 128;
  source.height = 512;
  const context = source.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 128, 0);
  gradient.addColorStop(0, 'rgba(161,239,239,0.12)');
  gradient.addColorStop(0.2, 'rgba(210,255,241,0.72)');
  gradient.addColorStop(0.43, 'rgba(75,184,206,0.76)');
  gradient.addColorStop(0.64, 'rgba(190,248,244,0.78)');
  gradient.addColorStop(0.86, 'rgba(74,178,203,0.72)');
  gradient.addColorStop(1, 'rgba(177,246,240,0.12)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 512);
  for (let i = 0; i < 25; i += 1) {
    const x = random() * 128;
    context.strokeStyle = i % 3 === 0 ? 'rgba(242,255,240,0.7)' : 'rgba(217,254,246,0.36)';
    context.lineWidth = 1 + random() * 3;
    context.beginPath();
    context.moveTo(x, 0);
    context.bezierCurveTo(x + (random() - 0.5) * 16, 120, x + (random() - 0.5) * 20, 320, x + (random() - 0.5) * 12, 512);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(source);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  return texture;
}

function makeWaterMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: '#b8e6df',
    roughness: 0.2,
    metalness: 0.03,
    clearcoat: 0.8,
    clearcoatRoughness: 0.22,
    side: THREE.DoubleSide,
  });
}

function repeatTexture(texture, x, y) {
  if (!texture) return null;
  const clone = texture.clone();
  clone.needsUpdate = true;
  clone.wrapS = THREE.RepeatWrapping;
  clone.wrapT = THREE.RepeatWrapping;
  clone.repeat.set(x, y);
  return clone;
}

function surfaceHeight(x, z) {
  return 5.2 + Math.sin(x * 0.31 + z * 0.24) * 0.09 + Math.cos(z * 0.38 - x * 0.19) * 0.07;
}

function islandEdge(angle, ringIndex = 0) {
  return 1 + Math.sin(angle * 5 + 0.42) * 0.034 + Math.sin(angle * 11 - 0.7) * 0.017 + Math.sin(angle * 17 + ringIndex * 0.31) * 0.008;
}

function insideIsland(x, z, threshold = 1) {
  return Math.hypot(x / 14.15, z / 10.42) < threshold;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function bindInterface() {
  const focusMap = {
    overview: { label: 'Visão geral da ilha', target: new THREE.Vector3(0, -0.7, 0), distance: compactScreen ? 69 : 48 },
    village: { label: 'Vila e mercado ao norte', target: new THREE.Vector3(-3.4, 5.9, -5.7), distance: 25 },
    flock: { label: 'Campo das ovelhas e torre a leste', target: new THREE.Vector3(7.4, 6.2, -2.0), distance: 22 },
    lake: { label: 'Lago central entre as florestas', target: new THREE.Vector3(-3.4, 5.8, 0.55), distance: 23 },
    mountain: { label: 'Montanha e cachoeiras ao sul', target: new THREE.Vector3(0.1, 7.0, 7.1), distance: 24 },
  };
  document.querySelectorAll('.region-button').forEach((button) => {
    button.addEventListener('click', () => {
      const region = button.dataset.region;
      const focus = focusMap[region];
      if (!focus) return;
      document.querySelectorAll('.region-button').forEach((item) => {
        const active = item === button;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      liveRegion.textContent = focus.label;
      moveCamera(focus.target, focus.distance);
    });
  });
  document.querySelector('#reset-view').addEventListener('click', () => {
    document.querySelector('[data-region="overview"]').click();
  });
}

function moveCamera(target, distance) {
  const fromPosition = camera.position.clone();
  const fromTarget = controls.target.clone();
  const direction = camera.position.clone().sub(controls.target).normalize();
  const toPosition = target.clone().add(direction.multiplyScalar(distance));
  cameraMotion = { fromPosition, fromTarget, toPosition, toTarget: target.clone(), progress: 0, duration: 0.82 };
  controls.enabled = false;
}

function resizeRenderer() {
  if (!renderer || !camera) return;
  const isCompact = window.matchMedia('(max-width: 760px)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isCompact ? 1.35 : 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = isCompact ? 48 : 39;
  camera.updateProjectionMatrix();
}

let previousFrameTime = 0;
function renderFrame(time = performance.now()) {
  if (!scene || !camera) return;
  const delta = previousFrameTime === 0 ? 0.016 : Math.min((time - previousFrameTime) / 1000, 0.05);
  previousFrameTime = time;
  if (waterTexture) waterTexture.offset.x = (waterTexture.offset.x + delta * 0.018) % 1;
  if (waterfallTexture) waterfallTexture.offset.y = (waterfallTexture.offset.y + delta * 0.34) % 1;
  mixers.forEach((mixer) => mixer.update(delta));
  movingClouds.forEach((cloud) => {
    cloud.position.x += cloud.userData.drift * delta;
    if (cloud.position.x > 18) cloud.position.x = -18;
  });

  if (cameraMotion) {
    cameraMotion.progress = Math.min(1, cameraMotion.progress + delta / cameraMotion.duration);
    const eased = 1 - Math.pow(1 - cameraMotion.progress, 3);
    camera.position.lerpVectors(cameraMotion.fromPosition, cameraMotion.toPosition, eased);
    controls.target.lerpVectors(cameraMotion.fromTarget, cameraMotion.toTarget, eased);
    controls.update();
    if (cameraMotion.progress >= 1) {
      cameraMotion = null;
      controls.enabled = true;
    }
  } else {
    controls.update();
  }
  renderer.render(scene, camera);
}
