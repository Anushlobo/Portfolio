import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createRoadsideScenery } from './scenery.js';

// Shared scene settings; model and scenery upgrades can extend this palette.
export const SCENE_CONFIG = {
  colors: {
    sky: '#acd8ef', fog: '#d4e2c7', grass: '#90b76b', road: '#a89a83',
    shoulder: '#d3bc8e', stripe: '#fff1ce', sun: '#ffedce', leaves: '#78ae65',
    trunk: '#9a7550', wall: '#fff0d3', window: '#ffd57b', door: '#558f82',
    wood: '#996743', skin: '#e7ab80', hair: '#493229', cap: '#df5549',
    vest: '#477d70', scarf: '#ffc164', shorts: '#526d87', shoes: '#fff3de',
  },
  curve: { strength: 0.012, start: 25, ramp: 18, flatRadius: 22 },
  camera: { height: 7.5, distance: 20, focusHeight: 0.55, fov: 60, visitFov: 55, response: 4 },
  neighborhood: { ahead: 82, behind: 26, copiesPerStop: 3 },
  layout: { houseSetback: 10, signSetback: 2.5, signRoadOffset: 3.4, signAngle: 20, plotHeight: 0.28 },
  sign: { width: 3.2, height: 1.4, thickness: 0.22, centerHeight: 1.9, textureWidth: 1024, textureHeight: 512, padding: 0.1 },
  houses: {
    about: { style: 'cottage', width: 4.2, depth: 3.8, height: 2.7, rise: 1.3, wall: '#f2ddbb', roof: '#b96045', trim: '#72533d', shutter: '#659c8b' },
    skills: { style: 'barn', width: 4.6, depth: 3.8, height: 2.9, rise: 1.65, wall: '#a66149', roof: '#4d817b', trim: '#f0d7ab', shutter: '#d29e52' },
    projects: { style: 'two-storey', width: 4.3, depth: 3.9, height: 4.5, rise: 1.2, wall: '#ded4ef', roof: '#75619c', trim: '#655069', shutter: '#8cb7b0' },
    experience: { style: 'cabin', width: 4.6, depth: 4.0, height: 2.7, rise: 1.25, wall: '#b38a5f', roof: '#526f55', trim: '#664933', shutter: '#b66f45' },
    education: { style: 'tower', width: 4.0, depth: 4.0, height: 4.6, rise: 1.65, wall: '#dcc9a4', roof: '#497e9a', trim: '#826e51', shutter: '#a78a50' },
    contact: { style: 'mail-cottage', width: 4.3, depth: 3.8, height: 2.8, rise: 1.35, wall: '#f4d8cc', roof: '#a65669', trim: '#87644a', shutter: '#6a9395' },
  },
  houseDetails: { wood: '#a07143', stone: '#a49b87', window: '#ffe2a0', emission: '#ffc771', lantern: '#ffd28b', soil: '#58452f', leaves: '#618950', mat: '#816347', brass: '#d7ad54', flowers: ['#e27c84', '#edbd56', '#ad8ecb'] },
  smoke: { count: 8, lifetime: 4.5, rise: 1.9 },
  lighting: { exposure: 0.95, hemisphere: 1.65, sunlight: 2.5 },
  garden: {
    seed: 4817, width: 11, depth: 11.6, centerZ: 1.9, fenceZ: 6.65,
    flowersPerBed: 24, grassCount: 70, stoneCount: 28,
    colors: { plot: '#a6c782', fence: '#efe2bc', grass: '#729e56', stone: '#b5b09c', flowers: ['#df7e8f', '#eac15b', '#a893cf', '#ec9d64'] },
  },
  scenery: {
    seed: 18473, trees: 32, bushes: 38, fences: 10, lakes: 2, patches: 10, grass: 240, stones: 72, flowers: 100,
    colors: {
      trunk: '#8c6748', fence: '#dec9a0', leaves: ['#588b57', '#75a65c', '#8db967', '#b0bc70'],
      pines: ['#52865e', '#699962', '#83a364'],
      grass: ['#739653', '#8ba765', '#b0bf7c'], stones: ['#b8b49d', '#999f8b', '#cfbea1'],
      flowers: ['#e6a16f', '#e8c264', '#cc85a1', '#a99bc8'],
      shore: '#c6c5a0', water: '#69acae', ripple: '#c4e3cb', patches: ['#9abb76', '#87af67', '#a6c27e'],
    },
  },
  roadWidth: 5.6,
  maxPixelRatio: 1.5,
  fogNear: 30,
  fogFar: 112,
};

// Main-camera uniforms are shared by visible and shadow passes. A shadow camera
// must not change the bend, otherwise the model and its shadow would disagree.
const WORLD_CURVE_UNIFORMS = {
  worldCurve: { value: SCENE_CONFIG.curve.strength },
  curveStart: { value: SCENE_CONFIG.curve.start },
  curveRamp: { value: SCENE_CONFIG.curve.ramp },
  flatRadius: { value: SCENE_CONFIG.curve.flatRadius },
  curveCamera: { value: new THREE.Vector3() },
};

// Apply the same world bend to visible meshes and their shadow-map passes.
function curveMaterial(material) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, WORLD_CURVE_UNIFORMS);
    shader.vertexShader = `
      uniform float worldCurve;
      uniform float curveStart;
      uniform float curveRamp;
      uniform float flatRadius;
      uniform vec3 curveCamera;
      ${shader.vertexShader}
    `;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
      vec4 curvedPosition = vec4(transformed, 1.0);
      #ifdef USE_BATCHING
        curvedPosition = batchingMatrix * curvedPosition;
      #endif
      #ifdef USE_INSTANCING
        curvedPosition = instanceMatrix * curvedPosition;
      #endif
      curvedPosition = modelMatrix * curvedPosition;
      float cameraDistance = length(curvedPosition.xz - curveCamera.xz);
      float bendDistance = max(0.0, cameraDistance - curveStart);
      float bendRamp = smoothstep(0.0, curveRamp, bendDistance);
      // Keep the current house plot rigid even with a pulled-back mobile camera.
      float localRamp = smoothstep(flatRadius, flatRadius + 8.0, length(curvedPosition.xz));
      curvedPosition.y -= worldCurve * bendDistance * bendDistance * bendRamp * localRamp;
      vec4 mvPosition = viewMatrix * curvedPosition;
      gl_Position = projectionMatrix * mvPosition;
    `).replace('#include <worldpos_vertex>', 'vec4 worldPosition = curvedPosition;');
  };
  material.customProgramCacheKey = () => 'cartoon-curved-world-v2';
  return material;
}

function bentPoint(point, cameraPosition = WORLD_CURVE_UNIFORMS.curveCamera.value) {
  // Match the shader exactly when projecting HTML hints over 3D objects.
  const depth = Math.max(0, Math.hypot(point.x - cameraPosition.x, point.z - cameraPosition.z) - SCENE_CONFIG.curve.start);
  const ramp = THREE.MathUtils.smoothstep(depth, 0, SCENE_CONFIG.curve.ramp);
  const localRamp = THREE.MathUtils.smoothstep(Math.hypot(point.x, point.z), SCENE_CONFIG.curve.flatRadius, SCENE_CONFIG.curve.flatRadius + 8);
  point.y -= SCENE_CONFIG.curve.strength * depth * depth * ramp * localRamp;
  return point;
}

function material(color, options = {}) {
  return curveMaterial(new THREE.MeshStandardMaterial({ color, roughness: 0.78, ...options }));
}

function mesh(parent, geometry, surface, position = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, surface);
  object.position.set(...position);
  object.castShadow = true;
  object.receiveShadow = true;
  object.customDepthMaterial = curvedDepth;
  parent.add(object);
  return object;
}

const curvedDepth = curveMaterial(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));

function rounded(parent, size, surface, position, radius = 0.1) {
  return mesh(parent, new RoundedBoxGeometry(...size, 1, radius), surface, position);
}

function sphere(parent, scale, surface, position) {
  const object = mesh(parent, new THREE.SphereGeometry(1, 20, 14), surface, position);
  object.scale.set(...scale);
  return object;
}

function createCharacter() {
  const root = new THREE.Group();
  root.name = 'adventurer';
  const hips = new THREE.Group();
  hips.name = 'hips';
  hips.position.y = 0.85;
  root.add(hips);
  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.position.y = 0.4;
  hips.add(torso);
  const palette = SCENE_CONFIG.colors;
  const skin = material(palette.skin, { roughness: 0.58 });
  const vest = material(palette.vest);
  const shorts = material(palette.shorts);
  const shoes = material(palette.shoes);
  const hairSurface = material(palette.hair, { roughness: 0.58 });
  const accessory = material('#304d5f', { roughness: 0.42, metalness: 0.1 });
  const blush = material('#d78172', { roughness: 0.72 });
  const scarf = material(palette.scarf);
  mesh(torso, new THREE.CapsuleGeometry(0.24, 0.43, 5, 16), vest);
  rounded(hips, [0.49, 0.28, 0.34], shorts, [0, 0.05, 0]);
  mesh(torso, new THREE.CylinderGeometry(0.105, 0.13, 0.15, 16), skin, [0, 0.46, 0]);
  sphere(torso, [0.28, 0.09, 0.23], scarf, [0, 0.36, 0]);
  rounded(torso, [0.17, 0.22, 0.025], accessory, [-0.12, 0.22, 0.24], 0.025);
  rounded(torso, [0.17, 0.22, 0.025], accessory, [0.12, 0.22, 0.24], 0.025);
  const scarfTail = new THREE.Group();
  scarfTail.name = 'scarf-tail';
  scarfTail.position.set(0.14, 0.26, -0.24);
  torso.add(scarfTail);
  rounded(scarfTail, [0.14, 0.42, 0.06], scarf, [0, -0.21, 0], 0.03);
  scarfTail.rotation.x = 0.18;

  const head = new THREE.Group();
  head.name = 'head';
  head.position.y = 0.77;
  torso.add(head);
  sphere(head, [0.37, 0.4, 0.35], skin, [0, 0, 0]);
  sphere(head, [0.38, 0.2, 0.34], hairSurface, [0, 0.22, -0.045]);
  const cap = material(palette.cap);
  mesh(head, new THREE.SphereGeometry(0.405, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), cap, [0, 0.18, 0]);
  sphere(head, [0.38, 0.045, 0.27], cap, [0, 0.18, 0.29]);
  const hairTufts = [];
  for (const [x, y, z, scale] of [[-0.27, 0.38, 0.02, 0.16], [-0.08, 0.43, -0.02, 0.18], [0.1, 0.44, -0.01, 0.16], [0.27, 0.35, 0.02, 0.14]]) {
    hairTufts.push(sphere(head, [scale, scale * 1.15, scale], hairSurface, [x, y, z]));
  }
  const white = material('#fffefa', { roughness: 0.25 });
  const pupil = material('#302c28', { roughness: 0.12 });
  const eyes = [];
  const pupils = [];
  const eyeHighlights = [];
  const earbuds = [];
  for (const side of [-1, 1]) {
    sphere(head, [0.09, 0.15, 0.11], skin, [side * 0.36, -0.035, 0]);
    const eye = sphere(head, [0.11, 0.135, 0.05], white, [side * 0.145, 0.015, 0.325]);
    const eyePupil = sphere(head, [0.057, 0.076, 0.027], pupil, [side * 0.145, 0.012, 0.366]);
    eyes.push(eye);
    pupils.push(eyePupil);
    eyeHighlights.push(sphere(head, [0.02, 0.024, 0.013], white, [side * 0.145 - 0.018, 0.04, 0.386]));
    sphere(head, [0.075, 0.075, 0.075], accessory, [side * 0.34, 0.02, -0.08]);
    earbuds.push(sphere(head, [0.035, 0.035, 0.035], blush, [side * 0.34, -0.03, 0.0]));
  }
  sphere(head, [0.075, 0.065, 0.07], skin, [0, -0.095, 0.345]);
  const smile = mesh(head, new THREE.TorusGeometry(0.09, 0.014, 6, 16, Math.PI), material('#9c5546'), [0, -0.145, 0.327]);
  smile.rotation.z = Math.PI;

  const arms = [];
  const legs = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.31, 0.25, 0);
    torso.add(arm);
    mesh(arm, new THREE.CapsuleGeometry(0.075, 0.39, 4, 12), skin, [0, -0.24, 0]);
    sphere(arm, [0.095, 0.13, 0.1], vest, [0, -0.035, 0]);
    sphere(arm, [0.08, 0.1, 0.08], skin, [0, -0.49, 0]);
    arms.push(arm);
    const leg = new THREE.Group();
    leg.position.set(side * 0.145, -0.04, 0);
    hips.add(leg);
    mesh(leg, new THREE.CapsuleGeometry(0.1, 0.38, 4, 12), skin, [0, -0.3, 0]);
    rounded(leg, [0.24, 0.22, 0.3], shorts, [0, -0.075, 0]);
    rounded(leg, [0.27, 0.2, 0.43], shoes, [0, -0.69, 0.09], 0.085);
    legs.push(leg);
  }
  root.rotation.y = Math.PI;
  return {
    root, hips, torso, head, arms, legs, eyes, pupils, eyeHighlights, earbuds, scarfTail,
    eyeRest: eyes.map((eye, index) => ({
      eyeScale: eye.scale.clone(), pupilScale: pupils[index].scale.clone(),
      highlightScale: eyeHighlights[index].scale.clone(), highlightY: eyeHighlights[index].position.y,
    })),
    scarfRestRotation: scarfTail.rotation.clone(),
    hairRestRotations: hairTufts.map((tuft) => tuft.rotation.clone()),
    hairTufts, phase: 0, stride: 0, blinkTimer: 2.2, blinkProgress: 0,
    breath: 0,
  };
}

function createContactShadow(scene) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 5, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(69, 51, 32, 0.45)');
  gradient.addColorStop(1, 'rgba(69, 51, 32, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const surface = curveMaterial(new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
  const shadow = mesh(scene, new THREE.PlaneGeometry(1.65, 1.25).rotateX(-Math.PI / 2), surface, [0, 0.055, 0]);
  shadow.castShadow = false;
  shadow.receiveShadow = false;
}

function animateCharacter(rig, delta, walking, direction, reduceMotion) {
  if (!reduceMotion) rig.phase += delta * (walking ? 10 : 2);
  rig.stride = THREE.MathUtils.damp(rig.stride, walking ? 1 : 0, 12, delta);
  const swing = Math.sin(rig.phase) * 0.5 * rig.stride;
  rig.legs[0].rotation.x = reduceMotion ? 0 : swing;
  rig.legs[1].rotation.x = reduceMotion ? 0 : -swing;
  rig.arms[0].rotation.x = reduceMotion ? 0 : -swing * 0.8;
  rig.arms[1].rotation.x = reduceMotion ? 0 : swing * 0.8;
  if (!reduceMotion) rig.breath += delta * 1.8;
  const breath = reduceMotion ? 0 : Math.sin(rig.breath) * 0.018;
  const bob = reduceMotion ? 0 : Math.abs(Math.sin(rig.phase)) * 0.035 * rig.stride;
  rig.hips.position.y = 0.85 + bob;
  rig.torso.scale.set(1 + breath * 0.35, 1 - breath * 0.25, 1 + breath * 0.35);
  rig.head.rotation.z = reduceMotion ? 0 : Math.sin(rig.phase * 0.5) * 0.018;
  rig.head.scale.set(1 + breath, 1 - breath * 0.55, 1 + breath);
  rig.scarfTail.rotation.copy(rig.scarfRestRotation);
  if (!reduceMotion) {
    rig.scarfTail.rotation.x += rig.stride * (0.38 + Math.sin(rig.phase * 1.4) * 0.07);
    rig.scarfTail.rotation.z += Math.sin(rig.breath) * 0.025 + Math.sin(rig.phase) * rig.stride * 0.08;
  }
  rig.hairTufts.forEach((tuft, index) => {
    tuft.rotation.copy(rig.hairRestRotations[index]);
    if (!reduceMotion) {
      tuft.rotation.x += Math.sin(rig.phase * 0.7 + index * 0.8) * rig.stride * 0.06;
      tuft.rotation.z += Math.sin(rig.breath + index * 0.8) * 0.012;
    }
  });

  if (!reduceMotion) {
    rig.blinkTimer -= delta;
    if (rig.blinkTimer <= 0 && rig.blinkProgress === 0) rig.blinkProgress = 0.001;
    if (rig.blinkProgress > 0) {
      rig.blinkProgress += delta;
      if (rig.blinkProgress > 0.18) {
        rig.blinkProgress = 0;
        rig.blinkTimer = 2.4 + Math.random() * 2.6;
      }
    }
  } else {
    rig.blinkProgress = 0;
  }
  const blinkAmount = rig.blinkProgress > 0 ? Math.sin(Math.min(1, rig.blinkProgress / 0.18) * Math.PI) : 0;
  rig.eyes.forEach((eye, index) => {
    const rest = rig.eyeRest[index];
    const compression = 1 - blinkAmount * 0.88;
    // Animate relative to the modeled dimensions, never a unit-size sphere.
    eye.scale.copy(rest.eyeScale);
    eye.scale.y *= compression;
    rig.pupils[index].scale.copy(rest.pupilScale);
    rig.pupils[index].scale.y *= 1 - blinkAmount * 0.9;
    const highlight = rig.eyeHighlights[index];
    highlight.scale.copy(rest.highlightScale);
    highlight.scale.y *= compression;
    highlight.position.y = eye.position.y + (rest.highlightY - eye.position.y) * compression;
  });
  rig.earbuds.forEach((earbud) => {
    earbud.material.emissive?.set('#8fe0df');
    earbud.material.emissiveIntensity = walking ? 0.35 : 0.15;
  });
  const target = direction > 0 ? Math.PI : 0;
  const difference = Math.atan2(Math.sin(target - rig.root.rotation.y), Math.cos(target - rig.root.rotation.y));
  rig.root.rotation.y += difference * (reduceMotion ? 1 : 1 - Math.exp(-10 * delta));
}

function createHouseTexture(kind) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  const image = context.createImageData(256, 256);
  let seed = 7351;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let index = 0; index < image.data.length; index += 4) {
    const value = 220 + Math.floor(random() * 28);
    image.data.set([value, value, value, 255], index);
  }
  context.putImageData(image, 0, 0);
  context.strokeStyle = '#978f8050';
  context.lineWidth = kind === 'stone' ? 4 : 2;
  if (kind === 'wood') {
    for (let row = 0; row < 24; row += 1) {
      context.beginPath();
      for (let x = 0; x <= 256; x += 8) {
        const y = row * 11 + Math.sin(x * 0.045 + row) * 2;
        if (x === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
    }
  } else if (kind !== 'stucco') {
    const cellWidth = kind === 'stone' ? 64 : 48;
    const cellHeight = kind === 'roof' ? 32 : 40;
    for (let row = 0; row < Math.ceil(256 / cellHeight); row += 1) {
      for (let x = -cellWidth; x < 256; x += cellWidth) {
        context.strokeRect(x + (row % 2) * cellWidth / 2, row * cellHeight, cellWidth, cellHeight);
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

function houseSurface(color, kind, textures, roughness = 0.8) {
  if (!textures.has(kind)) textures.set(kind, createHouseTexture(kind));
  const texture = textures.get(kind);
  return material(color, { map: texture, bumpMap: texture, bumpScale: 0.035, roughness });
}

function createRoof(parent, spec, roofSurface, trimSurface) {
  const root = new THREE.Group();
  root.name = 'tiled-roof';
  root.position.y = spec.height + 0.34;
  parent.add(root);
  const halfWidth = spec.width / 2 + 0.4;
  const depth = spec.depth + 0.8;
  const tileGeometry = new RoundedBoxGeometry(1, 0.07, 1, 1, 0.025);
  const tileMatrices = [];
  const tile = new THREE.Object3D();

  if (spec.style === 'tower') {
    mesh(root, new THREE.ConeGeometry(halfWidth, spec.rise, 40), roofSurface, [0, spec.rise / 2, 0]);
    mesh(root, new THREE.CylinderGeometry(halfWidth, halfWidth, 0.18, 40), trimSurface);
    const slope = Math.atan2(spec.rise, halfWidth);
    const length = Math.hypot(halfWidth, spec.rise);
    for (let row = 0; row < 6; row += 1) {
      const fraction = (row + 0.5) / 6;
      for (let column = 0; column < 32; column += 1) {
        const angle = column * Math.PI * 2 / 32 + (row % 2) * Math.PI / 32;
        tile.position.set(Math.sin(angle) * halfWidth * fraction, spec.rise * (1 - fraction) + 0.08, Math.cos(angle) * halfWidth * fraction);
        tile.rotation.set(slope, angle, 0, 'YXZ');
        tile.scale.set(halfWidth * fraction * Math.PI * 2 / 32 + 0.035, 1, length / 6 + 0.05);
        tile.updateMatrix();
        tileMatrices.push(tile.matrix.clone());
      }
    }
  } else {
    const profile = spec.style === 'barn'
      ? [[0, spec.rise], [halfWidth * 0.45, spec.rise * 0.82], [halfWidth, 0]]
      : [[0, spec.rise], [halfWidth, 0]];
    for (const side of [-1, 1]) {
      for (let segment = 0; segment < profile.length - 1; segment += 1) {
        const [x0, y0] = profile[segment];
        const [x1, y1] = profile[segment + 1];
        const length = Math.hypot(x1 - x0, y1 - y0);
        const angle = Math.atan2(y0 - y1, x1 - x0);
        const panel = rounded(root, [length + 0.08, 0.18, depth], roofSurface, [side * (x0 + x1) / 2, (y0 + y1) / 2, 0], 0.05);
        panel.rotation.z = -side * angle;
        for (const end of [-1, 1]) {
          const fascia = rounded(root, [length + 0.12, 0.22, 0.16], trimSurface, [side * (x0 + x1) / 2, (y0 + y1) / 2 - 0.06, end * depth / 2], 0.035);
          fascia.rotation.z = -side * angle;
        }
        const rows = Math.max(2, Math.ceil(length / 0.48));
        const columns = Math.ceil(depth / 0.5);
        for (let row = 0; row < rows; row += 1) {
          const fraction = (row + 0.5) / rows;
          for (let column = 0; column < columns; column += 1) {
            tile.position.set(side * THREE.MathUtils.lerp(x0, x1, fraction), THREE.MathUtils.lerp(y0, y1, fraction) + 0.13, -depth / 2 + (column + 0.5) * depth / columns);
            tile.rotation.set(0, 0, -side * angle);
            tile.scale.set(length / rows + 0.025, 1, depth / columns - 0.015);
            tile.updateMatrix();
            tileMatrices.push(tile.matrix.clone());
          }
        }
      }
    }
    const gable = new THREE.Shape();
    gable.moveTo(-spec.width / 2, 0);
    for (const [x, y] of [...profile].reverse()) gable.lineTo(-x * spec.width / (halfWidth * 2), y);
    for (const [x, y] of profile.slice(1)) gable.lineTo(x * spec.width / (halfWidth * 2), y);
    gable.closePath();
    for (const end of [-1, 1]) {
      mesh(root, new THREE.ExtrudeGeometry(gable, { depth: 0.12, bevelEnabled: false }), trimSurface, [0, 0, end * spec.depth / 2 - 0.06]);
    }
    rounded(root, [0.18, 0.2, depth + 0.1], roofSurface, [0, spec.rise + 0.07, 0], 0.045);
  }

  const tiles = new THREE.InstancedMesh(tileGeometry, roofSurface, tileMatrices.length);
  tiles.name = 'roof-tiles';
  tiles.castShadow = tiles.receiveShadow = true;
  tiles.customDepthMaterial = curvedDepth;
  tileMatrices.forEach((matrix, index) => {
    tiles.setMatrixAt(index, matrix);
    tiles.setColorAt(index, new THREE.Color('#ffffff').multiplyScalar(0.9 + (index % 7) * 0.015));
  });
  tiles.computeBoundingSphere();
  root.add(tiles);
  return root;
}

function createHouseWindow(parent, x, y, z, surfaces, turn = 0) {
  const root = new THREE.Group();
  root.name = 'shuttered-window';
  root.position.set(x, y, z);
  root.rotation.y = turn;
  parent.add(root);
  rounded(root, [0.98, 1.05, 0.14], surfaces.trim, [0, 0, 0], 0.07);
  rounded(root, [0.72, 0.8, 0.055], surfaces.glow, [0, 0, 0.09], 0.045);
  rounded(root, [0.045, 0.86, 0.06], surfaces.trim, [0, 0, 0.14], 0.012);
  rounded(root, [0.78, 0.045, 0.06], surfaces.trim, [0, 0, 0.14], 0.012);
  for (const side of [-1, 1]) {
    rounded(root, [0.25, 1, 0.09], surfaces.shutter, [side * 0.64, 0, 0.035], 0.03);
    for (let row = 0; row < 5; row += 1) rounded(root, [0.22, 0.035, 0.03], surfaces.trim, [side * 0.64, -0.36 + row * 0.18, 0.09], 0.01);
  }
  rounded(root, [1.07, 0.22, 0.35], surfaces.wood, [0, -0.62, 0.17], 0.035);
  rounded(root, [0.96, 0.035, 0.25], surfaces.soil, [0, -0.495, 0.17], 0.01);
  for (let index = 0; index < 5; index += 1) {
    const flowerX = -0.4 + index * 0.2;
    mesh(root, new THREE.CylinderGeometry(0.018, 0.018, 0.22, 5), surfaces.leaf, [flowerX, -0.39, 0.2]);
    sphere(root, [0.09, 0.065, 0.08], surfaces.flowers[index % surfaces.flowers.length], [flowerX, -0.26, 0.2]);
  }
  return root;
}

function createHouseDoor(parent, frontDepth, surfaces) {
  const arch = (radius) => {
    const shape = new THREE.Shape();
    shape.moveTo(-radius, 0);
    shape.lineTo(radius, 0);
    shape.lineTo(radius, 1.3);
    shape.absarc(0, 1.3, radius, 0, Math.PI, false);
    shape.closePath();
    return shape;
  };
  mesh(parent, new THREE.ExtrudeGeometry(arch(0.57), { depth: 0.14, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2 }), surfaces.trim, [0, 0.34, frontDepth + 0.015]);
  const hinge = new THREE.Group();
  hinge.name = 'door-hinge';
  hinge.position.set(-0.46, 0.35, frontDepth + 0.17);
  parent.add(hinge);
  const geometry = new THREE.ExtrudeGeometry(arch(0.46), { depth: 0.075, bevelEnabled: true, bevelSize: 0.018, bevelThickness: 0.018, bevelSegments: 2 });
  geometry.translate(0.46, 0, 0);
  mesh(hinge, geometry, surfaces.wood);
  for (let index = 1; index < 5; index += 1) rounded(hinge, [0.012, 1.24, 0.015], surfaces.trim, [index * 0.184, 0.65, 0.088], 0.004);
  sphere(hinge, [0.065, 0.065, 0.06], surfaces.brass, [0.75, 0.87, 0.14]);
  return hinge;
}

function createHousePorch(parent, spec, surfaces) {
  const front = spec.depth / 2;
  const cabin = spec.style === 'cabin';
  const width = cabin ? spec.width - 0.3 : 1.8;
  const depth = cabin ? 0.9 : 0.45;
  rounded(parent, [width, 0.32, depth], surfaces.stone, [0, 0.16, front + depth / 2], 0.06);
  for (let step = 0; step < 3; step += 1) {
    const height = 0.27 - step * 0.08;
    rounded(parent, [1.6 + step * 0.1, height, 0.24], surfaces.stone, [0, height / 2, front + depth + 0.12 + step * 0.22], 0.035);
  }
  rounded(parent, [0.85, 0.025, 0.32], surfaces.mat, [0, 0.34, front + 0.23], 0.025);
  const awningWidth = cabin ? width + 0.15 : 1.65;
  const awningDepth = cabin ? 1.05 : 0.66;
  const awning = rounded(parent, [awningWidth, 0.16, awningDepth], surfaces.roof, [0, 2.42, front + awningDepth / 2], 0.05);
  awning.rotation.x = 0.12;
  for (const side of [-1, 1]) {
    const height = cabin ? 2.1 : 0.48;
    rounded(parent, [0.11, height, 0.11], surfaces.trim, [side * (awningWidth / 2 - 0.15), cabin ? 1.35 : 2.12, front + awningDepth - 0.11], 0.025);
  }
}

function createHouseLantern(parent, frontDepth, surfaces) {
  const root = new THREE.Group();
  root.name = 'door-lantern';
  root.position.set(0.78, 1.45, frontDepth + 0.27);
  parent.add(root);
  rounded(root, [0.08, 0.16, 0.26], surfaces.trim, [0, 0.38, -0.05], 0.025);
  rounded(root, [0.25, 0.34, 0.22], surfaces.glow, [0, 0.05, 0.06], 0.04);
  for (const side of [-1, 1]) rounded(root, [0.31, 0.07, 0.28], surfaces.trim, [0, 0.05 + side * 0.2, 0.06], 0.025);
  for (const side of [-1, 1]) rounded(root, [0.025, 0.38, 0.025], surfaces.trim, [side * 0.12, 0.05, 0.18], 0.008);
  const light = new THREE.PointLight(SCENE_CONFIG.houseDetails.lantern, 3, 4, 2);
  light.position.set(0, 0.05, 0.26);
  root.add(light);
  return light;
}

function createSmokeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 253, 245, 0.7)');
  gradient.addColorStop(0.45, 'rgba(249, 247, 239, 0.4)');
  gradient.addColorStop(1, 'rgba(249, 247, 239, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createHouseChimney(parent, spec, surfaces, smokeTexture) {
  // Start inside the sloped roof so the chimney never appears to float.
  const anchor = new THREE.Vector3(-spec.width * 0.25, spec.height + 0.34 + spec.rise * 0.32, -spec.depth * 0.2);
  rounded(parent, [0.5, 0.95, 0.5], surfaces.stone, [anchor.x, anchor.y + 0.475, anchor.z], 0.06);
  rounded(parent, [0.67, 0.13, 0.67], surfaces.trim, [anchor.x, anchor.y + 0.97, anchor.z], 0.035);
  rounded(parent, [0.37, 0.025, 0.37], surfaces.soil, [anchor.x, anchor.y + 1.05, anchor.z], 0.015);
  anchor.y += 1.12;
  const particles = [];
  for (let index = 0; index < SCENE_CONFIG.smoke.count; index += 1) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTexture, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    sprite.name = 'chimney-smoke';
    parent.add(sprite);
    particles.push({ sprite, age: index * SCENE_CONFIG.smoke.lifetime / SCENE_CONFIG.smoke.count, anchor: anchor.clone(), phase: index * 1.7 });
  }
  return particles;
}

function animateHouseSmoke(house, deltaTime, reduceMotion) {
  for (const particle of house.active.smoke) {
    if (!reduceMotion) particle.age = (particle.age + deltaTime) % SCENE_CONFIG.smoke.lifetime;
    const progress = particle.age / SCENE_CONFIG.smoke.lifetime;
    particle.sprite.position.copy(particle.anchor);
    particle.sprite.position.x += Math.sin(progress * 3 + particle.phase) * 0.14 + progress * 0.45;
    particle.sprite.position.y += progress * SCENE_CONFIG.smoke.rise;
    particle.sprite.position.z += Math.cos(progress * 2 + particle.phase) * progress * 0.16;
    particle.sprite.scale.setScalar(0.3 + progress * 0.65);
    particle.sprite.material.opacity = Math.sin(progress * Math.PI) * 0.45;
  }
}

function createHouseModel(id, spec, textures, smokeTexture) {
  const root = new THREE.Group();
  root.name = `${id}-${spec.style}`;
  root.userData.style = spec.style;
  const details = SCENE_CONFIG.houseDetails;
  const surfaces = {
    wall: houseSurface(spec.wall, spec.style === 'cabin' || spec.style === 'barn' ? 'wood' : spec.style === 'tower' ? 'stone' : 'stucco', textures),
    roof: houseSurface(spec.roof, 'roof', textures, 0.7),
    trim: houseSurface(spec.trim, 'wood', textures),
    wood: houseSurface(details.wood, 'wood', textures),
    stone: houseSurface(details.stone, 'stone', textures, 0.88),
    shutter: houseSurface(spec.shutter, 'wood', textures),
    glow: material(details.window, { emissive: details.emission, emissiveIntensity: 0.9, roughness: 0.3 }),
    soil: material(details.soil), leaf: material(details.leaves), mat: material(details.mat),
    brass: material(details.brass, { roughness: 0.3, metalness: 0.35 }),
    flowers: details.flowers.map((color) => material(color)),
  };
  let wall;
  if (spec.style === 'tower') {
    mesh(root, new THREE.CylinderGeometry(spec.width / 2 + 0.13, spec.width / 2 + 0.18, 0.34, 40), surfaces.stone, [0, 0.17, 0]);
    wall = mesh(root, new THREE.CylinderGeometry(spec.width / 2, spec.width / 2, spec.height, 48), surfaces.wall, [0, 0.34 + spec.height / 2, 0]);
    mesh(root, new THREE.CylinderGeometry(spec.width / 2 + 0.055, spec.width / 2 + 0.055, 0.13, 40), surfaces.trim, [0, spec.height * 0.55 + 0.34, 0]);
  } else {
    rounded(root, [spec.width + 0.18, 0.34, spec.depth + 0.18], surfaces.stone, [0, 0.17, 0], 0.075);
    wall = rounded(root, [spec.width, spec.height, spec.depth], surfaces.wall, [0, 0.34 + spec.height / 2, 0], 0.15);
    for (const side of [-1, 1]) {
      for (const end of [-1, 1]) rounded(root, [0.14, spec.height, 0.15], surfaces.trim, [side * (spec.width / 2 - 0.025), spec.height / 2 + 0.34, end * (spec.depth / 2 - 0.025)], 0.025);
    }
    for (const end of [-1, 1]) rounded(root, [spec.width, 0.13, 0.1], surfaces.trim, [0, spec.height + 0.28, end * spec.depth / 2], 0.025);
    if (spec.style === 'two-storey') rounded(root, [spec.width + 0.05, 0.18, spec.depth + 0.05], surfaces.trim, [0, 2.65, 0], 0.04);
    if (spec.style === 'cabin' || spec.style === 'barn') {
      for (let row = 0; row < 7; row += 1) rounded(root, [spec.width - 0.1, 0.028, 0.025], surfaces.trim, [0, 0.52 + row * 0.32, spec.depth / 2 + 0.015], 0.008);
    }
  }
  wall.name = 'house-wall';
  createRoof(root, spec, surfaces.roof, surfaces.trim);
  const frontDepth = spec.depth / 2;
  const windows = [];
  if (spec.style === 'tower') {
    for (const angle of [-0.66, 0.66]) windows.push(createHouseWindow(root, Math.sin(angle) * frontDepth, 3.65, Math.cos(angle) * frontDepth, surfaces, angle));
  } else {
    for (const side of [-1, 1]) windows.push(createHouseWindow(root, side * spec.width * 0.3, 1.65, frontDepth + 0.055, surfaces));
    if (spec.style === 'two-storey') {
      for (const side of [-1, 1]) windows.push(createHouseWindow(root, side * spec.width * 0.3, 3.6, frontDepth + 0.055, surfaces));
    }
    const sideWindow = createHouseWindow(root, spec.width / 2 + 0.055, 1.65, 0, surfaces, Math.PI / 2);
    windows.push(sideWindow);
  }
  const door = createHouseDoor(root, frontDepth, surfaces);
  createHousePorch(root, spec, surfaces);
  const lantern = createHouseLantern(root, frontDepth, surfaces);
  const smoke = createHouseChimney(root, spec, surfaces, smokeTexture);
  if (spec.style === 'mail-cottage') {
    const mailbox = new THREE.Group();
    mailbox.name = 'porch-mailbox';
    mailbox.position.set(-1.6, 0, frontDepth + 0.65);
    root.add(mailbox);
    rounded(mailbox, [0.1, 1.05, 0.1], surfaces.trim, [0, 0.53, 0], 0.02);
    rounded(mailbox, [0.46, 0.38, 0.6], surfaces.shutter, [0, 1.16, 0], 0.12);
    rounded(mailbox, [0.34, 0.035, 0.025], surfaces.trim, [0, 1.16, 0.31], 0.01);
    rounded(mailbox, [0.04, 0.32, 0.04], surfaces.brass, [0.27, 1.32, 0], 0.01);
  }
  return { id, root, spec, wall, windows, frontDepth, door, lantern, smoke, roofMaterial: surfaces.roof };
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function gardenInstances(parent, name, geometry, surface, placements) {
  const object = new THREE.InstancedMesh(geometry, surface, placements.length);
  object.name = name;
  object.castShadow = object.receiveShadow = true;
  object.customDepthMaterial = curvedDepth;
  const transform = new THREE.Object3D();
  placements.forEach((placement, index) => {
    transform.position.set(...placement.position);
    transform.rotation.set(0, placement.turn ?? 0, 0);
    transform.scale.set(...(placement.scale ?? [1, 1, 1]));
    transform.updateMatrix();
    object.setMatrixAt(index, transform.matrix);
    if (placement.color) object.setColorAt(index, new THREE.Color(placement.color));
  });
  object.computeBoundingBox();
  object.computeBoundingSphere();
  parent.add(object);
  return object;
}

function createFenceSection(parent, start, end, surfaces) {
  const root = new THREE.Group();
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
  root.position.set((start[0] + end[0]) / 2, 0, (start[1] + end[1]) / 2);
  root.rotation.y = -Math.atan2(end[1] - start[1], end[0] - start[0]);
  parent.add(root);
  const shape = new THREE.Shape();
  shape.moveTo(-0.055, 0);
  shape.lineTo(0.055, 0);
  shape.lineTo(0.055, 0.8);
  shape.lineTo(0, 0.92);
  shape.lineTo(-0.055, 0.8);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.09, bevelEnabled: false });
  geometry.translate(0, 0, -0.045);
  const count = Math.ceil(length / 0.25) + 1;
  gardenInstances(root, 'fence-pickets', geometry, surfaces.fence, Array.from({ length: count }, (_, index) => ({ position: [-length / 2 + index * length / (count - 1), 0, 0] })));
  for (const height of [0.25, 0.63]) rounded(root, [length + 0.08, 0.065, 0.07], surfaces.wood, [0, height, -0.03], 0.015);
  return root;
}

function createFlowerBed(parent, x, z, surfaces, random) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  parent.add(root);
  rounded(root, [2.35, 0.2, 1.5], surfaces.soil, [0, 0.1, 0], 0.06);
  for (const side of [-1, 1]) {
    rounded(root, [2.4, 0.13, 0.1], surfaces.stone, [0, 0.15, side * 0.75], 0.025);
    rounded(root, [0.1, 0.13, 1.5], surfaces.stone, [side * 1.175, 0.15, 0], 0.025);
  }
  const stems = [];
  const petals = [];
  for (let index = 0; index < SCENE_CONFIG.garden.flowersPerBed; index += 1) {
    const flowerX = -0.96 + (index % 6) * 0.38 + (random() - 0.5) * 0.09;
    const flowerZ = -0.52 + Math.floor(index / 6) * 0.34 + (random() - 0.5) * 0.07;
    const height = 0.17 + random() * 0.14;
    stems.push({ position: [flowerX, 0.22 + height / 2, flowerZ], scale: [1, height, 1] });
    petals.push({ position: [flowerX, 0.22 + height, flowerZ], scale: [0.11, 0.07, 0.11], color: SCENE_CONFIG.garden.colors.flowers[index % 4] });
  }
  gardenInstances(root, 'flower-stems', new THREE.CylinderGeometry(0.014, 0.014, 1, 5), surfaces.leaves, stems);
  gardenInstances(root, 'garden-flowers', new THREE.SphereGeometry(1, 8, 6), surfaces.flowers, petals);
  return root;
}

function createGardenPath(parent, model, surfaces, random) {
  const start = model.frontDepth + (model.spec.style === 'cabin' ? 0.9 : 0.45) + 1.05;
  const end = model.frontDepth + SCENE_CONFIG.layout.houseSetback - 0.25;
  const count = Math.ceil((end - start) / 0.66) + 1;
  const plotFront = SCENE_CONFIG.garden.centerZ + SCENE_CONFIG.garden.depth / 2;
  const stones = Array.from({ length: count }, (_, index) => {
    const z = THREE.MathUtils.lerp(start, end, index / (count - 1));
    // Lower the outer stones smoothly from the raised plot to road level.
    const y = 0.035 - SCENE_CONFIG.layout.plotHeight * THREE.MathUtils.smoothstep(z, plotFront, plotFront + 1);
    return { position: [(index % 2 ? 0.1 : -0.1) + (random() - 0.5) * 0.05, y, z], scale: [0.43, 1, 0.29], turn: random() * 0.8 };
  });
  const path = gardenInstances(parent, 'stepping-stone-path', new THREE.CylinderGeometry(1, 1, 0.08, 9), surfaces.stone, stones);
  path.castShadow = false;
  return { object: path, start, end, halfWidth: 0.75 };
}

function createGardenScatter(parent, model, colliders, surfaces, random) {
  const boxes = [model.root, ...colliders.map((prop) => prop.object)].map((object) => {
    object.updateWorldMatrix(true, true);
    return new THREE.Box3().setFromObject(object, true).expandByScalar(0.18);
  });
  const placements = [];
  const count = SCENE_CONFIG.garden.grassCount + SCENE_CONFIG.garden.stoneCount;
  for (let attempt = 0; placements.length < count && attempt < 3000; attempt += 1) {
    const x = (random() - 0.5) * 9.8;
    const z = -3.15 + random() * 9.3;
    if (Math.abs(x) < 0.95) continue;
    if (boxes.some((box) => x >= box.min.x && x <= box.max.x && z >= box.min.z && z <= box.max.z)) continue;
    placements.push({ x, z, turn: random() * Math.PI * 2, size: 0.7 + random() * 0.6 });
  }
  const grass = placements.slice(0, SCENE_CONFIG.garden.grassCount).map(({ x, z, turn, size }) => ({ position: [x, 0.13 * size, z], scale: [0.08 * size, 0.26 * size, 0.08 * size], turn }));
  const rocks = placements.slice(SCENE_CONFIG.garden.grassCount).map(({ x, z, turn, size }) => ({ position: [x, 0.055 * size, z], scale: [0.12 * size, 0.055 * size, 0.09 * size], turn }));
  const tufts = gardenInstances(parent, 'garden-grass', new THREE.ConeGeometry(1, 1, 3), surfaces.grass, grass);
  tufts.castShadow = false;
  const stones = gardenInstances(parent, 'garden-stones', new THREE.SphereGeometry(1, 8, 6), surfaces.stone, rocks);
  stones.castShadow = false;
  return placements;
}

function createHouseGarden(model, surfaces) {
  const root = new THREE.Group();
  root.name = `${model.id}-garden`;
  const seed = [...model.id].reduce((value, letter) => Math.imul(value, 31) + letter.charCodeAt(0), SCENE_CONFIG.garden.seed);
  const random = seededRandom(seed);
  const colliders = [];
  const register = (name, object) => {
    object.name = name;
    colliders.push({ name: `${model.id}/${name}`, object });
    return object;
  };
  const fenceZ = SCENE_CONFIG.garden.fenceZ;
  const sections = [
    ['fence-left', [-5.1, -3.4], [-5.1, 6.4]],
    ['fence-right', [5.1, -3.4], [5.1, 6.4]],
    ['fence-back', [-5, -3.65], [5, -3.65]],
    ['fence-front-left', [-5.1, fenceZ], [-0.95, fenceZ]],
    ['fence-front-right', [0.95, fenceZ], [5.1, fenceZ]],
  ];
  for (const [name, start, end] of sections) register(name, createFenceSection(root, start, end, surfaces));
  const gate = new THREE.Group();
  gate.position.set(-0.95, 0, fenceZ - 0.2);
  gate.rotation.y = Math.PI / 2;
  root.add(gate);
  createFenceSection(gate, [0, 0], [1.6, 0], surfaces);
  register('open-gate', gate);
  for (const side of [-1, 1]) register(`flower-bed-${side}`, createFlowerBed(root, side * 3.45, 4.5, surfaces, random));
  for (const [x, z] of [[-4.2, 0.6], [4.2, 0.6], [-3.65, -2.7], [3.65, -2.7]]) {
    const bush = new THREE.Group();
    bush.position.set(x, 0, z);
    root.add(bush);
    mesh(bush, new THREE.SphereGeometry(1, 10, 8), surfaces.leaves, [0, 0.34, 0]).scale.set(0.48, 0.38, 0.48);
    register(`bush-${x}-${z}`, bush);
  }
  const path = createGardenPath(root, model, surfaces, random);
  const scatter = createGardenScatter(root, model, colliders, surfaces, random);
  return { root, colliders, path, scatter, seed, surfaces };
}

function createSectionProp(model, garden) {
  const root = new THREE.Group();
  root.name = `${model.id}-section-prop`;
  const surfaces = garden.surfaces;
  const wood = surfaces.wood;
  const metal = surfaces.brass;
  const board = surfaces.trim;
  const register = (name, object) => {
    object.name = name;
    garden.colliders.push({ name: `${model.id}/${name}`, object });
    return object;
  };

  if (model.id === 'about') {
    rounded(root, [2.1, 0.16, 0.48], wood, [0, 0.98, 0], 0.04);
    for (const side of [-1, 1]) {
      rounded(root, [0.12, 1, 0.12], wood, [side * 0.78, 0.5, 0], 0.02);
      rounded(root, [0.09, 0.7, 0.09], wood, [side * 0.58, 0.38, 0], 0.02);
    }
    rounded(root, [1.5, 0.1, 0.25], surfaces.mat, [0, 1.06, 0.05], 0.02);
  } else if (model.id === 'skills') {
    rounded(root, [2.4, 0.18, 1.05], wood, [0, 0.8, 0], 0.04);
    for (const side of [-1, 1]) rounded(root, [0.12, 1.25, 0.12], wood, [side * 0.95, 0.35, 0], 0.02);
    rounded(root, [2.1, 0.12, 0.8], board, [0, 1.45, -0.05], 0.03);
    rounded(root, [0.1, 0.65, 0.1], metal, [-0.58, 0.36, 0.05], 0.02);
    rounded(root, [0.1, 0.65, 0.1], metal, [0.58, 0.36, 0.05], 0.02);
    for (let index = 0; index < 4; index += 1) rounded(root, [0.35, 0.06, 0.12], surfaces.glow, [-0.7 + index * 0.48, 0.92, 0.15], 0.02);
  } else if (model.id === 'projects') {
    for (const side of [-1, 1]) {
      const easel = new THREE.Group();
      easel.position.set(side * 1.1, 0, 0);
      root.add(easel);
      rounded(easel, [0.11, 2.1, 0.11], wood, [0, 0.95, 0], 0.02);
      rounded(easel, [1.1, 0.12, 0.12], wood, [0, 1.7, 0], 0.02);
      rounded(easel, [0.95, 0.8, 0.08], board, [0, 1.4, 0.06], 0.03);
      rounded(easel, [0.6, 0.08, 0.08], surfaces.flowers[side === -1 ? 0 : 2], [0, 1.42, 0.12], 0.02);
    }
  } else if (model.id === 'experience') {
    for (let index = 0; index < 4; index += 1) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 1.6, 10), wood);
      log.position.set(-0.4 + (index % 2) * 0.45, 0.25 + Math.floor(index / 2) * 0.27, 0);
      log.rotation.z = Math.PI / 2;
      log.castShadow = log.receiveShadow = true;
      log.customDepthMaterial = curvedDepth;
      root.add(log);
    }
    rounded(root, [1.5, 0.12, 0.12], board, [0, 0.12, 0.55], 0.02);
  } else if (model.id === 'education') {
    const post = new THREE.Group();
    post.position.set(0.2, 0, 0);
    root.add(post);
    rounded(post, [0.12, 1.7, 0.12], wood, [0, 0.85, 0], 0.02);
    const roof = new THREE.ConeGeometry(0.5, 0.32, 4);
    roof.rotateY(Math.PI / 4);
    mesh(post, roof, board, [0, 1.72, 0]);
    rounded(post, [0.62, 0.42, 0.55], board, [0, 1.38, 0], 0.04);
    rounded(post, [0.2, 0.18, 0.08], surfaces.glow, [0, 1.38, 0.3], 0.02);
  } else if (model.id === 'contact') {
    const mailbox = new THREE.Group();
    mailbox.position.set(0, 0, 0);
    root.add(mailbox);
    rounded(mailbox, [0.12, 1.6, 0.12], metal, [0, 0.8, 0], 0.02);
    rounded(mailbox, [1.1, 0.6, 0.72], surfaces.shutter, [0, 1.65, 0], 0.13);
    rounded(mailbox, [0.82, 0.08, 0.04], metal, [0, 1.65, 0.38], 0.01);
    rounded(mailbox, [0.12, 0.45, 0.08], metal, [0.62, 1.75, 0], 0.02);
    const lamp = new THREE.Group();
    lamp.position.set(-1.2, 0, 0.1);
    root.add(lamp);
    rounded(lamp, [0.12, 2.7, 0.12], metal, [0, 1.35, 0], 0.02);
    rounded(lamp, [0.8, 0.1, 0.1], metal, [0.35, 2.65, 0], 0.02);
    sphere(lamp, [0.18, 0.18, 0.18], surfaces.glow, [0.7, 2.52, 0]);
    const light = new THREE.PointLight(SCENE_CONFIG.houseDetails.lantern, 3, 5, 2);
    light.position.set(0.7, 2.4, 0);
    lamp.add(light);
  }

  const propPosition = {
    about: [-4.2, 2.5],
    skills: [4.2, 2.5],
    projects: [-3.8, 2.5],
    experience: [4.2, 2.5],
    education: [-4.2, 2.5],
    contact: [4.2, 2.5],
  }[model.id];
  // Keep each prop assembly comfortably inside the fenced garden footprint.
  root.position.set(propPosition[0], 0, propPosition[1]);
  root.scale.setScalar(0.65);

  register(`${model.id}-section-prop`, root);
  return root;
}

// Combine static parts by material while preserving the door rig and instances.
// Neighboring houses can then render together without hundreds of tiny draw calls.
function batchStaticParts(root) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const groups = new Map();
  root.traverse((object) => {
    if (!object.isMesh || object.isInstancedMesh) return;
    for (let parent = object.parent; parent !== root; parent = parent.parent) {
      if (parent.name === 'door-hinge') return;
    }
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
    const key = object.material;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(geometry);
    // Keep the modeled hierarchy available for bounds checks and future animation.
    object.visible = false;
  });
  const batches = new THREE.Group();
  batches.name = 'static-details';
  for (const [surface, geometries] of groups) {
    const geometry = mergeGeometries(geometries);
    mesh(batches, geometry, surface).frustumCulled = false;
    geometries.forEach((part) => part.dispose());
  }
  root.add(batches);
}

function createHouseModels() {
  const textures = new Map();
  const smokeTexture = createSmokeTexture();
  const models = new Map(Object.entries(SCENE_CONFIG.houses).map(([id, spec]) => [id, createHouseModel(id, spec, textures, smokeTexture)]));
  const palette = SCENE_CONFIG.garden.colors;
  const surfaces = {
    wood: houseSurface(SCENE_CONFIG.houseDetails.wood, 'wood', textures),
    fence: houseSurface(palette.fence, 'wood', textures),
    soil: material(SCENE_CONFIG.houseDetails.soil),
    leaves: material(SCENE_CONFIG.houseDetails.leaves),
    grass: material(palette.grass),
    stone: houseSurface(palette.stone, 'stone', textures),
    flowers: material('#ffffff'),
  };
  for (const model of models.values()) {
    model.garden = createHouseGarden(model, surfaces);
    model.garden.surfaces = surfaces;
    model.garden.sectionProp = createSectionProp(model, model.garden);
    model.garden.root.add(model.garden.sectionProp);
    batchStaticParts(model.root);
    batchStaticParts(model.garden.root);
    model.distantRoot = createDistantHouse(model);
  }
  return { models, textures, smokeTexture };
}

function createDistantHouse(model) {
  const root = new THREE.Group();
  root.name = `${model.id}-distant-house`;
  const addPart = (part, parent = root) => {
    const copy = part.clone();
    copy.visible = true;
    parent.add(copy);
  };
  addPart(model.root.children.find((object) => object.isMesh));
  addPart(model.wall);
  const roof = model.root.getObjectByName('tiled-roof');
  const roofRoot = new THREE.Group();
  roofRoot.position.copy(roof.position);
  root.add(roofRoot);
  for (const part of roof.children) if (part.isMesh && !part.isInstancedMesh) addPart(part, roofRoot);
  for (const window of model.windows) {
    const windowRoot = new THREE.Group();
    windowRoot.position.copy(window.position);
    windowRoot.rotation.copy(window.rotation);
    root.add(windowRoot);
    for (const part of window.children.slice(0, 2)) addPart(part, windowRoot);
  }
  const door = new THREE.Group();
  door.position.copy(model.door.position);
  root.add(door);
  addPart(model.door.children[0], door);
  for (const part of model.root.children) {
    if (part.isMesh && part.position.y > model.spec.height + 0.4) addPart(part);
  }
  batchStaticParts(root);
  return root;
}

function createNeighborhood(scene, stops, library) {
  const copies = [];
  const byStop = new Map();
  for (const stop of stops) {
    const model = library.models.get(stop.id);
    const stopCopies = [];
    const texture = signTexture(stop);
    const signTemplate = createSign();
    signTemplate.section = stop.id;
    signTemplate.faceMaterial.map = texture;
    const plotTemplate = createHousePlot(scene);
    for (let index = 0; index < SCENE_CONFIG.neighborhood.copiesPerStop; index += 1) {
      const root = new THREE.Group();
      root.name = 'resume-house';
      root.userData.stopId = stop.id;
      const modelRoot = model.root.clone(true);
      const distantRoot = model.distantRoot.clone(true);
      root.add(modelRoot, distantRoot);
      const gardenRoot = new THREE.Group();
      gardenRoot.name = 'house-garden';
      const garden = model.garden.root.clone(true);
      gardenRoot.add(garden);
      const smoke = model.smoke.map((particle, particleIndex) => {
        const sprite = modelRoot.getObjectsByProperty('name', 'chimney-smoke')[particleIndex];
        sprite.material = sprite.material.clone();
        return { ...particle, anchor: particle.anchor.clone(), sprite };
      });
      const active = {
        ...model, root: modelRoot, smoke,
        wall: modelRoot.getObjectByName('house-wall'),
        door: modelRoot.getObjectByName('door-hinge'),
        lantern: modelRoot.getObjectByName('door-lantern').getObjectByProperty('type', 'PointLight'),
        windows: modelRoot.getObjectsByProperty('name', 'shuttered-window'),
        garden: {
          ...model.garden, root: garden,
          colliders: model.garden.colliders.map((prop) => ({ ...prop, object: garden.getObjectByName(prop.object.name) })),
          sectionProp: garden.getObjectByName(`${stop.id}-section-prop`),
          path: { ...model.garden.path, object: garden.getObjectByName('stepping-stone-path') },
        },
      };
      const signRoot = index === 0 ? signTemplate.root : signTemplate.root.clone(true);
      const sign = {
        ...signTemplate, root: signRoot,
        face: signRoot.getObjectByName('sign-lettering'),
        hintAnchor: signRoot.getObjectByName('sign-hint-anchor'),
      };
      const plot = index === 0 ? plotTemplate : plotTemplate.clone();
      plot.customDepthMaterial = curvedDepth;
      if (index !== 0) scene.add(plot);
      const house = { root, gardenRoot, active, frontDepth: model.frontDepth, door: active.door, models: library.models };
      const copy = { stop, index, house, sign, plot, distantRoot, cycle: null, z: 0, visible: false };
      scene.add(root, gardenRoot, sign.root);
      for (const group of [root, gardenRoot, sign.root]) group.traverse((object) => {
        if (object.isMesh) {
          object.customDepthMaterial = curvedDepth;
          object.frustumCulled = false;
        }
      });
      copy.lights = modelRoot.getObjectsByProperty('type', 'PointLight')
        .concat(garden.getObjectsByProperty('type', 'PointLight'));
      copy.shadowCasters = [];
      for (const group of [root, gardenRoot, sign.root, plot]) group.traverse((object) => {
        if (object.castShadow) copy.shadowCasters.push(object);
      });
      copies.push(copy);
      stopCopies.push(copy);
    }
    byStop.set(stop.id, stopCopies);
  }
  return { copies, byStop, ...library };
}

function placeNeighborhood(neighborhood, progress, loopLength, behind) {
  for (const copies of neighborhood.byStop.values()) {
    for (const copy of copies) copy.visible = false;
    const distance = copies[0].stop.distance;
    const firstCycle = Math.ceil((progress - behind - distance) / loopLength);
    const lastCycle = Math.floor((progress + SCENE_CONFIG.neighborhood.ahead - distance) / loopLength);
    for (let cycle = firstCycle; cycle <= lastCycle; cycle += 1) {
      const copy = copies[((cycle % copies.length) + copies.length) % copies.length];
      copy.cycle = cycle;
      copy.z = progress - distance - cycle * loopLength;
      copy.visible = true;
      placeHouseStop(copy.house, copy.sign, copy.plot, copy.stop.side === 'left' ? -1 : 1, copy.z);
    }
    for (const copy of copies) {
      for (const object of [copy.house.root, copy.house.gardenRoot, copy.sign.root, copy.plot]) object.visible = copy.visible;
      const detailed = Math.abs(copy.z) < 25;
      copy.house.active.root.visible = detailed;
      copy.distantRoot.visible = !detailed;
      for (const object of copy.shadowCasters) object.castShadow = copy.visible && Math.abs(copy.z) < 17;
      // Only the closest lanterns need actual light sources; distant windows glow.
      for (const light of copy.lights) light.visible = copy.visible && Math.abs(copy.z) < 8;
    }
  }
}

function signTexture(stop) {
  const settings = SCENE_CONFIG.sign;
  const canvas = document.createElement('canvas');
  canvas.width = settings.textureWidth;
  canvas.height = settings.textureHeight;
  const context = canvas.getContext('2d');
  context.fillStyle = '#fae8c6';
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Deterministic wood grain keeps the lettering background quiet and cream.
  context.lineWidth = 2;
  for (let row = 0; row < 50; row += 1) {
    context.strokeStyle = row % 3 === 0 ? '#dac49e38' : '#ffffff50';
    context.beginPath();
    for (let x = 0; x <= canvas.width; x += 16) {
      const y = row * 11 + Math.sin(x * 0.013 + row * 2.4) * 3;
      if (x === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }

  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#856749';
  context.font = 'bold 44px sans-serif';
  context.fillText(`${stop.number} / 06`, canvas.width / 2, canvas.height * 0.27);

  const availableWidth = canvas.width * (1 - settings.padding * 2);
  let fontSize = 132;
  do {
    context.font = `bold ${fontSize}px sans-serif`;
    if (context.measureText(stop.label).width <= availableWidth || fontSize <= 12) break;
    fontSize -= 2;
  } while (true);
  context.fillStyle = '#493223';
  context.fillText(stop.label, canvas.width / 2, canvas.height * 0.62);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.userData = { title: stop.label, fontSize, textWidth: context.measureText(stop.label).width, availableWidth };
  return texture;
}

function createSign() {
  const root = new THREE.Group();
  root.name = 'section-sign';
  const settings = SCENE_CONFIG.sign;
  const wood = material(SCENE_CONFIG.colors.wood);
  const darkWood = material('#765035');
  for (const side of [-1, 1]) {
    rounded(root, [0.15, 2.8, 0.18], wood, [side * 1.12, 1.4, 0], 0.035);
    rounded(root, [0.16, settings.height + 0.16, 0.28], darkWood, [side * (settings.width / 2 + 0.04), settings.centerHeight, 0], 0.035);
  }
  rounded(root, [settings.width, settings.height, settings.thickness], wood, [0, settings.centerHeight, 0], 0.06);
  for (const side of [-1, 1]) {
    rounded(root, [settings.width + 0.24, 0.16, 0.28], darkWood, [0, settings.centerHeight + side * (settings.height / 2 + 0.04), 0], 0.035);
  }
  rounded(root, [settings.width + 0.46, 0.16, 0.55], wood, [0, settings.centerHeight + settings.height / 2 + 0.2, 0], 0.05);

  // Independent front lettering prevents frame shadows from hiding characters.
  const faceMaterial = curveMaterial(new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
  const face = mesh(root, new THREE.PlaneGeometry(settings.width - 0.12, settings.height - 0.12), faceMaterial, [0, settings.centerHeight, settings.thickness / 2 + 0.025]);
  face.name = 'sign-lettering';
  face.castShadow = false;
  face.receiveShadow = false;
  const hintAnchor = new THREE.Object3D();
  hintAnchor.name = 'sign-hint-anchor';
  hintAnchor.position.set(0, settings.centerHeight + settings.height / 2 + 0.65, 0);
  root.add(hintAnchor);
  return { root, face, faceMaterial, hintAnchor, section: null };
}

function createHousePlot(scene) {
  const settings = SCENE_CONFIG.garden;
  const plot = rounded(scene, [settings.width, 0.32, settings.depth], material(settings.colors.plot), [0, SCENE_CONFIG.layout.plotHeight - 0.16, 0], 0.12);
  plot.geometry.translate(0, 0, settings.centerZ);
  plot.name = 'raised-grass-plot';
  return plot;
}

function placeHouseStop(house, sign, plot, side, z) {
  const edge = SCENE_CONFIG.roadWidth / 2;
  const layout = SCENE_CONFIG.layout;
  const houseX = side * (edge + layout.houseSetback + house.frontDepth);
  house.root.position.set(houseX, layout.plotHeight, z);
  house.root.rotation.y = -side * Math.PI / 2;
  house.gardenRoot.position.copy(house.root.position);
  house.gardenRoot.rotation.copy(house.root.rotation);
  plot.position.x = houseX;
  plot.position.z = z;
  plot.rotation.y = house.root.rotation.y;
  sign.root.position.set(side * (edge + layout.signSetback), 0, z + layout.signRoadOffset);
  // The face points inward, then 20 degrees toward the approaching character.
  sign.root.rotation.y = -side * (Math.PI / 2 - THREE.MathUtils.degToRad(layout.signAngle));
}

function checkPropOverlaps(props) {
  // Register whole props, not individual parts that intentionally touch.
  const boxes = props.map(({ name, object }) => {
    object.updateWorldMatrix(true, true);
    return { name, box: new THREE.Box3().setFromObject(object, true) };
  });
  const overlaps = [];
  for (let index = 0; index < boxes.length; index += 1) {
    for (let other = index + 1; other < boxes.length; other += 1) {
      if (!boxes[index].box.intersectsBox(boxes[other].box)) continue;
      const pair = [boxes[index].name, boxes[other].name];
      overlaps.push(pair);
      console.warn(`[House layout] Prop overlap: ${pair.join(' and ')}`);
    }
  }
  return overlaps;
}

function checkGardenPath(garden) {
  garden.root.updateWorldMatrix(true, true);
  const inverse = garden.root.matrixWorld.clone().invert();
  const blocked = [];
  for (const prop of garden.colliders) {
    const box = new THREE.Box3().setFromObject(prop.object, true).applyMatrix4(inverse);
    if (box.min.x >= garden.path.halfWidth || box.max.x <= -garden.path.halfWidth) continue;
    if (box.max.z <= garden.path.start - 0.4 || box.min.z >= garden.path.end + 0.35) continue;
    blocked.push(prop.name);
    console.warn(`[House layout] Walking path blocked by ${prop.name}`);
  }
  return blocked;
}

function createGroundTextures(kind, width, depth, anisotropy) {
  const size = 256;
  const tileSize = kind === 'grass' ? 6 : 4;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  const image = context.createImageData(size, size);
  const random = seededRandom(kind === 'grass' ? 9271 : 6317);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // Periodic broad variation hides tile edges; fine grain stays subtle.
      const u = x / size * Math.PI * 2;
      const v = y / size * Math.PI * 2;
      const variation = Math.sin(u + Math.cos(v)) * Math.cos(v * 2)
        + Math.sin(u * 3 - v * 2) * 0.45;
      const grain = (random() - 0.5) * (kind === 'grass' ? 13 : 18);
      const value = Math.round(239 + variation * (kind === 'grass' ? 7 : 3) + grain);
      image.data.set([value, value, value, 255], (y * size + x) * 4);
    }
  }
  context.putImageData(image, 0, 0);
  if (kind === 'grass') {
    context.lineWidth = 1;
    for (let index = 0; index < 1300; index += 1) {
      const x = random() * size;
      const y = random() * size;
      const length = 1.5 + random() * 3;
      context.strokeStyle = index % 3 ? '#78934f18' : '#ffffea30';
      // Copy edge-crossing blades to the neighboring tile for seamless repeats.
      for (const offsetX of [-size, 0, size]) {
        for (const offsetY of [-size, 0, size]) {
          context.beginPath();
          context.moveTo(x + offsetX, y + offsetY);
          context.lineTo(x + offsetX + 1, y + offsetY - length);
          context.stroke();
        }
      }
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.name = `${kind}-color`;
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(width / tileSize, depth / tileSize);
  map.anisotropy = anisotropy;
  const bumpMap = map.clone();
  bumpMap.name = `${kind}-height`;
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.needsUpdate = true;
  return { map, bumpMap, tileSize };
}

function createGround(scene, anisotropy) {
  const palette = SCENE_CONFIG.colors;
  const layers = [];
  const textures = [];
  for (const [kind, width, y, color] of [
    ['grass', 180, -0.04, palette.grass],
    ['shoulder', SCENE_CONFIG.roadWidth + 0.9, 0.005, palette.shoulder],
    ['road', SCENE_CONFIG.roadWidth, 0.025, palette.road],
  ]) {
    const geometry = new THREE.PlaneGeometry(width, 230, Math.max(2, Math.ceil(width / 3)), 140);
    geometry.rotateX(-Math.PI / 2);
    const surface = createGroundTextures(kind, width, 230, anisotropy);
    const ground = mesh(scene, geometry, material(color, {
      map: surface.map, bumpMap: surface.bumpMap,
      bumpScale: kind === 'grass' ? 0.025 : 0.012, roughness: 0.94,
    }), [0, y, -65]);
    ground.name = `ground-${kind}`;
    ground.castShadow = false;
    ground.frustumCulled = false;
    layers.push(ground);
    textures.push(surface);
  }
  const marks = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.1, 1.3).rotateX(-Math.PI / 2), material(palette.stripe), 44);
  marks.name = 'road-markings';
  marks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  marks.customDepthMaterial = curvedDepth;
  marks.frustumCulled = false;
  scene.add(marks);
  return { marks, layers, textures };
}

function createAtmosphere(scene) {
  // Camera-relative silhouettes sit behind the bent terrain like a sky backdrop.
  // Their colors already include atmospheric haze, so foreground fog stays separate.
  const hills = new THREE.Group();
  hills.name = 'distant-hills';
  for (const [name, depth, height, phase, color] of [
    ['far', 112, 18, 0.4, '#bdd1c2'],
    ['middle', 98, 17, 1.7, '#a6c194'],
    ['near', 84, 16, 3.1, '#88ab6d'],
  ]) {
    const ridge = new THREE.Shape();
    ridge.moveTo(-145, -100);
    for (let x = -145; x <= 145; x += 2) {
      const roll = 0.5 + Math.sin(x * 0.065 + phase) * 0.3
        + Math.sin(x * 0.127 + phase * 2) * 0.16;
      const roadValley = Math.exp(-x * x / 650) * 4;
      ridge.lineTo(x, -31 + depth * 0.25 + height * roll - roadValley);
    }
    ridge.lineTo(145, -100);
    ridge.closePath();
    const band = new THREE.Mesh(new THREE.ShapeGeometry(ridge), new THREE.MeshBasicMaterial({
      color, fog: false, toneMapped: false,
    }));
    band.name = `hill-band-${name}`;
    band.position.z = -depth;
    hills.add(band);
  }
  scene.add(hills);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  const glow = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  glow.addColorStop(0, 'rgba(255, 250, 218, 1)');
  glow.addColorStop(0.12, 'rgba(255, 244, 199, 1)');
  glow.addColorStop(0.2, 'rgba(255, 233, 175, 0.6)');
  glow.addColorStop(0.46, 'rgba(255, 228, 169, 0.16)');
  glow.addColorStop(1, 'rgba(255, 228, 169, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'sun-glow';
  texture.colorSpace = THREE.SRGBColorSpace;
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture, transparent: true, depthWrite: false, fog: false, toneMapped: false,
  }));
  sun.name = 'sun-glow';
  sun.scale.set(28, 28, 1);
  scene.add(sun);
  return { hills, sun };
}

export function createWalkingScene(canvas, { stops, roadLength, unitScale }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, SCENE_CONFIG.maxPixelRatio));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = SCENE_CONFIG.lighting.exposure;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE_CONFIG.colors.sky);
  scene.fog = new THREE.Fog(SCENE_CONFIG.colors.fog, SCENE_CONFIG.fogNear, SCENE_CONFIG.fogFar);
  const camera = new THREE.PerspectiveCamera(SCENE_CONFIG.camera.fov, 1, 0.1, 150);
  const hemisphere = new THREE.HemisphereLight('#e8f3ff', '#90a07a', SCENE_CONFIG.lighting.hemisphere);
  hemisphere.name = 'sky-fill';
  scene.add(hemisphere);
  const sunlight = new THREE.DirectionalLight(SCENE_CONFIG.colors.sun, SCENE_CONFIG.lighting.sunlight);
  sunlight.name = 'sunlight';
  sunlight.position.set(-24, 38, 16);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunlight.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 160 });
  sunlight.shadow.normalBias = 0.04;
  sunlight.shadow.bias = -0.00015;
  scene.add(sunlight);
  const ground = createGround(scene, renderer.capabilities.getMaxAnisotropy());
  const { marks } = ground;
  const atmosphere = createAtmosphere(scene);
  const character = createCharacter();
  const library = createHouseModels();
  for (const texture of library.textures.values()) texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const worldStops = stops.map((stop) => ({ ...stop, distance: stop.distance * unitScale }));
  const loopLength = roadLength * unitScale;
  const neighborhood = createNeighborhood(scene, worldStops, library);
  const scenery = createRoadsideScenery(scene, { config: SCENE_CONFIG, stops: worldStops, loopLength, material, depthMaterial: curvedDepth });
  for (const copy of neighborhood.copies) copy.sign.faceMaterial.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
  scene.add(character.root);
  createContactShadow(scene);

  // Validate the complete repeating neighborhood, including adjacent plots.
  const layoutWarnings = [];
  placeNeighborhood(neighborhood, 0, loopLength, SCENE_CONFIG.neighborhood.behind);
  for (const copies of neighborhood.byStop.values()) {
    const { house, sign } = copies.find((copy) => copy.visible);
    layoutWarnings.push(...checkPropOverlaps([
      { name: `${house.active.id}/house`, object: house.root },
      { name: `${house.active.id}/signboard`, object: sign.root },
      ...house.active.garden.colliders,
    ]));
    layoutWarnings.push(...checkGardenPath(house.active.garden));
  }
  layoutWarnings.push(...checkPropOverlaps(neighborhood.copies.filter((copy) => copy.visible)
    .map((copy) => ({ name: `${copy.stop.id}/${copy.cycle}/plot`, object: copy.plot }))));
  const matrix = new THREE.Matrix4();
  const hint = new THREE.Vector3();
  let framing = 0;
  let width = 1;
  let height = 1;

  function resize(nextWidth, nextHeight) {
    width = Math.max(1, nextWidth);
    height = Math.max(1, nextHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function render({ travel, cameraTravel, stop, stopDistance, walking, direction, deltaTime = 0, reduceMotion = false }) {
    // A floating origin keeps coordinates small even after many complete laps.
    const progress = travel * unitScale;
    const localHouseZ = (travel - stopDistance) * unitScale;
    for (let index = 0; index < marks.count; index += 1) {
      const z = -130 + index * 3.5 + ((progress % 3.5) + 3.5) % 3.5;
      matrix.makeTranslation(0, 0.04, z);
      marks.setMatrixAt(index, matrix);
    }
    marks.instanceMatrix.needsUpdate = true;
    for (const surface of ground.textures) {
      const offset = ((progress / surface.tileSize) % 1 + 1) % 1;
      surface.map.offset.y = surface.bumpMap.offset.y = offset;
    }
    animateCharacter(character, deltaTime, walking, direction, reduceMotion);
    const cameraLag = (travel - cameraTravel) * unitScale;
    const portrait = camera.aspect < 0.8;
    // Blend both neighbors' influence instead of snapping focus at the midpoint.
    const influences = worldStops.map((worldStop) => {
      const z = progress - worldStop.distance - Math.round((progress - worldStop.distance) / loopLength) * loopLength;
      return { weight: 1 - THREE.MathUtils.smoothstep(Math.abs(z), 2, 7), side: worldStop.side === 'left' ? -1 : 1 };
    });
    const visit = Math.max(...influences.map((influence) => influence.weight));
    const weight = influences.reduce((sum, influence) => sum + influence.weight, 0);
    const targetFraming = influences.reduce((sum, influence) => sum + influence.side * influence.weight, 0) / Math.max(1, weight);
    framing = deltaTime === 0 || reduceMotion ? targetFraming : THREE.MathUtils.damp(framing, targetFraming, SCENE_CONFIG.camera.response, deltaTime);
    const targetFov = THREE.MathUtils.lerp(SCENE_CONFIG.camera.fov, SCENE_CONFIG.camera.visitFov, visit);
    camera.fov = deltaTime === 0 || reduceMotion ? targetFov : THREE.MathUtils.damp(camera.fov, targetFov, SCENE_CONFIG.camera.response, deltaTime);
    camera.updateProjectionMatrix();
    const portraitDistance = 26 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    const followDistance = portrait ? Math.max(SCENE_CONFIG.camera.distance, portraitDistance) : SCENE_CONFIG.camera.distance;
    // Pulling back on narrow screens should not fog out the nearby garden.
    const fogOffset = followDistance - SCENE_CONFIG.camera.distance + cameraLag;
    scene.fog.near = SCENE_CONFIG.fogNear + fogOffset;
    scene.fog.far = SCENE_CONFIG.fogFar + fogOffset;
    camera.position.set(-framing * 1.6, SCENE_CONFIG.camera.height + (portrait ? 2.5 : 0), followDistance + cameraLag);
    camera.lookAt(framing * (portrait ? 8.8 : 4.6), SCENE_CONFIG.camera.focusHeight, -2.2);
    placeNeighborhood(neighborhood, progress, loopLength, Math.max(SCENE_CONFIG.neighborhood.behind, followDistance + cameraLag + 6));
    scenery.update(progress, Math.max(SCENE_CONFIG.neighborhood.behind, followDistance + cameraLag + 6));
    const current = neighborhood.byStop.get(stop.id).filter((copy) => copy.visible)
      .reduce((nearest, copy) => Math.abs(copy.z - localHouseZ) < Math.abs(nearest.z - localHouseZ) ? copy : nearest);
    atmosphere.hills.position.copy(camera.position);
    atmosphere.hills.quaternion.copy(camera.quaternion);
    const skySpan = 95 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    atmosphere.sun.position.set(-skySpan * camera.aspect * 0.62, skySpan * 0.62, -95)
      .applyQuaternion(camera.quaternion).add(camera.position);
    WORLD_CURVE_UNIFORMS.curveCamera.value.copy(camera.position);
    scene.updateMatrixWorld(true);
    for (const copy of neighborhood.copies) {
      if (!copy.visible || !copy.house.active.root.visible) continue;
      animateHouseSmoke(copy.house, deltaTime, reduceMotion);
      for (const particle of copy.house.active.smoke) {
        const point = particle.sprite.position.clone();
        particle.sprite.parent.localToWorld(point);
        bentPoint(point);
        particle.sprite.position.copy(particle.sprite.parent.worldToLocal(point));
      }
    }
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    current.sign.hintAnchor.getWorldPosition(hint);
    bentPoint(hint).project(camera);
    renderer.render(scene, camera);
    view.house = current.house;
    view.sign = current.sign;
    view.plot = current.plot;
    return { x: (hint.x * 0.5 + 0.5) * width, y: (-hint.y * 0.5 + 0.5) * height, visible: Math.abs(hint.x) < 1 && Math.abs(hint.y) < 1 && hint.z > -1 && hint.z < 1 };
  }

  function dispose() {
    const geometries = new Set();
    const materials = new Set();
    const collect = (object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) materials.add(object.material);
      if (object.customDepthMaterial) materials.add(object.customDepthMaterial);
    };
    scene.traverse(collect);
    // Detached cached variants still own GPU resources.
    for (const model of library.models.values()) {
      model.root.traverse(collect);
      model.garden.root.traverse(collect);
      model.distantRoot.traverse(collect);
    }
    const textures = new Set();
    for (const surface of materials) {
      for (const value of Object.values(surface)) if (value?.isTexture) textures.add(value);
    }
    geometries.forEach((geometry) => geometry.dispose());
    textures.forEach((texture) => texture.dispose());
    materials.forEach((surface) => surface.dispose());
    renderer.dispose();
  }

  // Expose rigs so future entry animations can steer the door and character.
  const view = { resize, render, dispose, renderer, scene, camera, character, neighborhood, scenery, ground, atmosphere, layoutWarnings };
  return view;
}
