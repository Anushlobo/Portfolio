import * as THREE from 'three';

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function circularGap(a, b, length) {
  const gap = ((a - b) % length + length) % length;
  return Math.min(gap, length - gap);
}

function intersects(a, b, length, padding = 0) {
  return Math.abs(a.x - b.x) < a.halfWidth + b.halfWidth + padding
    && circularGap(a.distance, b.distance, length) < a.halfDepth + b.halfDepth + padding;
}

// World-distance footprints include the complete garden, sign and door approach.
// They repeat with the same period as the houses, including negative laps.
export function sceneryReservations(config, stops) {
  const edge = config.roadWidth / 2;
  return stops.flatMap((stop) => {
    const side = stop.side === 'left' ? -1 : 1;
    const front = config.houses[stop.id].depth / 2;
    const houseX = edge + config.layout.houseSetback + front;
    return [
      { name: `${stop.id}/plot`, x: side * (houseX - config.garden.centerZ), distance: stop.distance,
        halfWidth: config.garden.depth / 2 + 0.4, halfDepth: config.garden.width / 2 + 0.6 },
      { name: `${stop.id}/sign`, x: side * (edge + config.layout.signSetback), distance: stop.distance - config.layout.signRoadOffset,
        halfWidth: 1.1, halfDepth: config.sign.width / 2 + 0.5 },
      { name: `${stop.id}/approach`, x: side * (edge + config.layout.houseSetback / 2), distance: stop.distance,
        halfWidth: config.layout.houseSetback / 2 + 0.3, halfDepth: 1.2 },
      // Leave a quiet roadside foreground around each garden and sign.
      { name: `${stop.id}/sightline`, x: side * 6.1, distance: stop.distance,
        halfWidth: 2.2, halfDepth: config.garden.width / 2 + 0.7 },
      { name: `${stop.id}/tree-sightline`, x: side * 11, distance: stop.distance - 2.7,
        halfWidth: 8, halfDepth: 7.8, tallOnly: true },
    ];
  });
}

export function createSceneryLayout(config, stops, loopLength) {
  const settings = config.scenery;
  const random = seededRandom(settings.seed);
  const reservations = sceneryReservations(config, stops);
  const props = [];
  const structural = [];
  const roadLimit = config.roadWidth / 2 + 0.9;
  const clear = (prop) => Math.abs(prop.x) - prop.halfWidth > roadLimit
    && !reservations.some((reserved) => (!reserved.tallOnly || prop.kind === 'tree') && intersects(prop, reserved, loopLength))
    && !structural.some((other) => intersects(prop, other, loopLength, 0.35));
  const scatter = (kind, count, candidate, solid = true) => {
    let placed = 0;
    for (let attempt = 0; placed < count && attempt < count * 150; attempt++) {
      const prop = { kind, name: `${kind}-${placed}`, distance: random() * loopLength,
        turn: random() * Math.PI * 2, variation: random(), ...candidate(random) };
      if (!clear(prop)) continue;
      props.push(prop);
      if (solid) structural.push(prop);
      placed++;
    }
  };
  // Small ponds occupy alternating gaps between same-side gardens.
  // Reserve the complete shores before placing trees and other scenery.
  for (let index = 0; index < settings.lakes; index++) {
    const lake = { kind: 'lake', name: `lake-${index}`, x: (index % 2 ? 1 : -1) * (14.2 + random() * 0.6),
      distance: stops[(index * 3 + 1) % stops.length].distance, size: 1, turn: 0, variation: random(), halfWidth: 4.4, halfDepth: 4.8 };
    if (!clear(lake)) continue;
    props.push(lake);
    structural.push(lake);
  }
  scatter('tree', settings.trees, (random) => {
    const size = 0.72 + random() * 0.48;
    const side = random() < 0.5 ? -1 : 1;
    return { x: side * (random() < 0.4 ? 6 + random() * 11 : 22 + random() * 12), size,
      style: random() < 0.3 ? 'pine' : 'round', halfWidth: size * 1.8, halfDepth: size * 1.8 };
  });
  scatter('bush', settings.bushes, (random) => {
    const size = 0.5 + random() * 0.5;
    return { x: (random() < 0.5 ? -1 : 1) * (4.6 + random() * 24), size,
      halfWidth: size * 0.95, halfDepth: size * 0.95 };
  });
  scatter('fence', settings.fences, (random) => {
    const length = 2.4 + random() * 2.2;
    return { x: (random() < 0.5 ? -1 : 1) * (6.5 + random() * 17), size: length,
      turn: 0, halfWidth: 0.22, halfDepth: length / 2 + 0.15 };
  });
  scatter('patch', settings.patches, (random) => ({ x: (random() < 0.5 ? -1 : 1) * (6 + random() * 24),
    size: 1.2 + random(), halfWidth: 2.5, halfDepth: 2.5 }), false);
  for (const [kind, count] of [['grass', settings.grass], ['stone', settings.stones], ['flower', settings.flowers]]) {
    scatter(kind, count, (random) => ({ x: (random() < 0.5 ? -1 : 1) * (3.95 + random() * 25),
      size: 0.65 + random() * 0.7, halfWidth: 0.23, halfDepth: 0.23 }), false);
  }
  return { seed: settings.seed, props, reservations, loopLength, roadLimit };
}

// Subdivided disks follow the same curved terrain shader without a rigid flat top.
function groundDisk() {
  const positions = [0, 0, 0], uvs = [0.5, 0.5], indices = [];
  const segments = 40, rings = 5;
  for (let ring = 1; ring <= rings; ring++) {
    for (let index = 0; index < segments; index++) {
      const angle = index / segments * Math.PI * 2;
      const radius = ring / rings * (1 + Math.sin(angle * 3) * 0.035 + Math.cos(angle * 5) * 0.025);
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
      positions.push(x, 0, z);
      uvs.push(x * 0.5 + 0.5, z * 0.5 + 0.5);
      const current = 1 + (ring - 1) * segments + index;
      const next = 1 + (ring - 1) * segments + (index + 1) % segments;
      if (ring === 1) indices.push(0, next, current);
      else {
        const inner = current - segments, innerNext = next - segments;
        indices.push(inner, next, current, inner, innerNext, next);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function checkSceneryClearances(layout) {
  const warnings = [];
  for (const prop of layout.props) {
    if (Math.abs(prop.x) - prop.halfWidth <= layout.roadLimit) warnings.push(`${prop.name}/road`);
    for (const reserved of layout.reservations) {
      if ((!reserved.tallOnly || prop.kind === 'tree') && intersects(prop, reserved, layout.loopLength)) warnings.push(`${prop.name}/${reserved.name}`);
    }
  }
  const solids = layout.props.filter((prop) => ['tree', 'bush', 'fence', 'lake'].includes(prop.kind));
  for (let index = 0; index < solids.length; index++) {
    for (let other = index + 1; other < solids.length; other++) {
      if (intersects(solids[index], solids[other], layout.loopLength)) warnings.push(`${solids[index].name}/${solids[other].name}`);
    }
  }
  return warnings;
}

export function createRoadsideScenery(scene, { config, stops, loopLength, material, depthMaterial }) {
  const layout = createSceneryLayout(config, stops, loopLength);
  const root = new THREE.Group();
  root.name = 'seeded-roadside-scenery';
  scene.add(root);
  const palette = config.scenery.colors;
  const sphere = new THREE.IcosahedronGeometry(1, 1);
  const trunk = new THREE.CylinderGeometry(0.14, 0.23, 1, 7);
  const batches = new Map();
  const define = (name, geometry, surface, shadows = true) => {
    batches.set(name, { name, geometry, surface, shadows, placements: [] });
  };
  define('tree-trunks', trunk, material(palette.trunk));
  define('round-canopies', sphere, material('#ffffff'));
  define('pine-canopies', new THREE.ConeGeometry(1, 1, 9), material('#ffffff'));
  define('roadside-bushes', sphere, material('#ffffff'));
  define('roadside-fence-posts', new THREE.BoxGeometry(0.16, 1, 0.16), material(palette.fence));
  define('roadside-fence-rails', new THREE.BoxGeometry(0.09, 0.1, 1), material(palette.fence));
  define('meadow-grass', new THREE.ConeGeometry(1, 1, 3), material('#ffffff'), false);
  define('roadside-pebbles', sphere, material('#ffffff'), false);
  define('wildflower-stems', new THREE.CylinderGeometry(0.012, 0.012, 1, 4), material(palette.grass[0]), false);
  define('wildflower-petals', new THREE.IcosahedronGeometry(1, 0), material('#ffffff'), false);
  const disk = groundDisk();
  define('meadow-patches', disk, material('#ffffff', { roughness: 1 }), false);
  define('pond-shores', disk, material(palette.shore), false);
  define('pond-water', disk, material(palette.water, { roughness: 0.3, metalness: 0.08 }), false);
  const ripple = new THREE.TorusGeometry(1, 0.012, 3, 40);
  ripple.rotateX(-Math.PI / 2);
  define('pond-ripples', ripple, material(palette.ripple, { roughness: 0.45 }), false);
  define('pond-reeds', new THREE.CylinderGeometry(0.025, 0.025, 1, 5), material(palette.grass[0]), false);
  define('reed-heads', new THREE.CylinderGeometry(0.055, 0.055, 0.24, 5), material('#806448'), false);
  define('lily-pads', new THREE.CylinderGeometry(1, 1, 0.018, 12), material('#719a5e'), false);
  define('lily-flowers', sphere, material('#ecc5ca'), false);
  const add = (name, prop, y, scale, color, x = 0, z = 0) => {
    batches.get(name).placements.push({ x: prop.x + x, distance: prop.distance - z, y, scale, color, turn: prop.turn });
  };
  for (const prop of layout.props) {
    const size = prop.size;
    const leafColors = prop.style === 'pine' ? palette.pines : palette.leaves;
    const leaf = leafColors[Math.floor(prop.variation * leafColors.length)];
    if (prop.kind === 'lake') {
      // Separate thin layers enough to avoid intersections as terrain bends.
      add('pond-shores', prop, 0.025, [4.1, 1, 4.45]);
      add('pond-water', prop, 0.055, [3.75, 1, 4.05]);
      const random = seededRandom(config.scenery.seed + Math.floor(prop.distance * 100));
      for (let index = 0; index < 22; index++) {
        const angle = random() * Math.PI * 2;
        const x = Math.cos(angle) * 3.85, z = Math.sin(angle) * 4.25;
        const height = 0.45 + random() * 0.45;
        add('pond-reeds', prop, height / 2, [1, height, 1], null, x, z);
        add('reed-heads', prop, height, [1, 1, 1], null, x, z);
      }
      for (let index = 0; index < 7; index++) {
        const angle = index * 2.4;
        const x = Math.cos(angle) * (1.6 + random()), z = Math.sin(angle) * (1.8 + random());
        add('lily-pads', prop, 0.085, [0.22, 1, 0.28], null, x, z);
        if (index % 2 === 0) add('lily-flowers', prop, 0.13, [0.09, 0.06, 0.09], null, x, z);
      }
      for (const [x, z, radius] of [[-1.4, -1, 0.65], [1, 1.6, 0.8], [0.8, -2, 0.55]]) {
        add('pond-ripples', prop, 0.09, [radius, 1, radius * 0.7], null, x, z);
      }
    } else if (prop.kind === 'patch') {
      add('meadow-patches', prop, 0.025, [size, 1, size], palette.patches[Math.floor(prop.variation * palette.patches.length)]);
    } else if (prop.kind === 'tree') {
      add('tree-trunks', prop, 1.15 * size, [size, 2.3 * size, size]);
      if (prop.style === 'pine') {
        for (let tier = 0; tier < 3; tier++) {
          const radius = (1.6 - tier * 0.35) * size;
          add('pine-canopies', prop, (2.9 + tier * 0.65) * size, [radius, 2.2 * size, radius], leaf);
        }
      } else {
        add('round-canopies', prop, 3.35 * size, [1.7 * size, 1.9 * size, 1.6 * size], leaf);
        add('round-canopies', prop, 3.1 * size, [size, 1.2 * size, size], leaf, 0.65 * size, 0.4 * size);
      }
    } else if (prop.kind === 'bush') {
      add('roadside-bushes', prop, 0.48 * size, [0.9 * size, 0.6 * size, 0.7 * size], leaf);
      add('roadside-bushes', prop, 0.4 * size, [0.55 * size, 0.48 * size, 0.55 * size], leaf, 0.35 * size, 0.1);
    } else if (prop.kind === 'fence') {
      const posts = Math.ceil(size / 1.3);
      for (let index = 0; index <= posts; index++) add('roadside-fence-posts', prop, 0.5, [1, 1, 1], null, 0, -size / 2 + index * size / posts);
      for (const y of [0.33, 0.74]) add('roadside-fence-rails', prop, y, [1, 1, size]);
    } else if (prop.kind === 'grass') {
      const green = palette.grass[Math.floor(prop.variation * palette.grass.length)];
      for (let blade = 0; blade < 3; blade++) add('meadow-grass', prop, 0.12 * size, [0.075 * size, 0.24 * size, 0.08 * size], green, (blade - 1) * 0.065, (blade % 2) * 0.06);
    } else if (prop.kind === 'stone') {
      add('roadside-pebbles', prop, 0.035 * size, [0.16 * size, 0.075 * size, 0.12 * size], palette.stones[Math.floor(prop.variation * palette.stones.length)]);
    } else if (prop.kind === 'flower') {
      add('wildflower-stems', prop, 0.14 * size, [1, 0.28 * size, 1]);
      add('wildflower-petals', prop, 0.28 * size, [0.08 * size, 0.055 * size, 0.08 * size], palette.flowers[Math.floor(prop.variation * palette.flowers.length)]);
    }
  }
  for (const batch of batches.values()) {
    const object = new THREE.InstancedMesh(batch.geometry, batch.surface, batch.placements.length * config.neighborhood.copiesPerStop);
    object.name = batch.name;
    object.count = 0;
    object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    object.customDepthMaterial = depthMaterial;
    object.castShadow = batch.shadows;
    object.receiveShadow = true;
    object.frustumCulled = false;
    root.add(object);
    batch.object = object;
  }
  const transform = new THREE.Object3D();
  function update(progress, behind) {
    for (const batch of batches.values()) {
      let index = 0;
      for (const placement of batch.placements) {
        const first = Math.ceil((progress - behind - placement.distance) / loopLength);
        const last = Math.floor((progress + config.neighborhood.ahead - placement.distance) / loopLength);
        for (let cycle = first; cycle <= last; cycle++) {
          transform.position.set(placement.x, placement.y, progress - placement.distance - cycle * loopLength);
          transform.rotation.set(0, placement.turn, 0);
          transform.scale.set(...placement.scale);
          transform.updateMatrix();
          batch.object.setMatrixAt(index, transform.matrix);
          if (placement.color) batch.object.setColorAt(index, new THREE.Color(placement.color));
          index++;
        }
      }
      batch.object.count = index;
      batch.object.instanceMatrix.needsUpdate = true;
      if (batch.object.instanceColor) batch.object.instanceColor.needsUpdate = true;
    }
  }
  const warnings = checkSceneryClearances(layout);
  for (const warning of warnings) console.warn(`[Scenery layout] Clearance: ${warning}`);
  return { root, layout, batches, update, warnings };
}
