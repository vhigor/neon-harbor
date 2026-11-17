// Neon Harbor itself: a road grid, the blocks between the roads, the
// buildings and parks that fill them, the harbour water to the east, the
// beach and the sea to the south, and the landmarks the story uses.
// Everything is placed by the seeded random, so one seed is one city.

import { WORLD, ROAD, PALETTE } from './config.js';

const AVENUES = ROAD.avenues;
const STREETS = ROAD.streets;
const HALF = ROAD.width / 2;

/** The rectangle of block (col, row): col 0 is west of the first avenue. */
function blockRect(col, row) {
  const x0 = col === 0 ? 48 : AVENUES[col - 1] + HALF;
  const x1 = col === AVENUES.length ? ROAD.waterX - HALF : AVENUES[col] - HALF;
  const y0 = row === 0 ? 48 : STREETS[row - 1] + HALF;
  const y1 = row === STREETS.length ? ROAD.beachY - HALF : STREETS[row] - HALF;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// Which block holds which landmark: [col, row, name, kind].
const LANDMARK_BLOCKS = [
  [0, 0, 'Harbor Precinct', 'precinct'],
  [5, 0, 'St. Marina Hospital', 'hospital'],
  [4, 1, 'Harbor Bank', 'bank'],
  [3, 2, 'Meridian Casino', 'casino'],
  [0, 2, "Dex's Garage", 'garage'],
  [2, 3, 'Palm Court', 'plaza'],
  [1, 4, 'Safehouse', 'safehouse'],
];

export function createCity(random) {
  const buildings = [];
  const parks = [];
  const lots = [];
  const trees = [];
  const parkedSpots = [];
  const landmarks = {};

  function addBuilding(x, y, w, h, name) {
    const building = {
      x, y, w, h,
      roof: random.pick(PALETTE.buildingRoof),
      name: name || null,
    };
    buildings.push(building);
    return building;
  }

  function addPark(rect) {
    const park = { x: rect.x, y: rect.y, w: rect.w, h: rect.h, trees: [] };
    const count = random.int(6, 12);
    for (let i = 0; i < count; i += 1) {
      const tree = {
        x: rect.x + random.range(16, rect.w - 16),
        y: rect.y + random.range(16, rect.h - 16),
        r: random.range(7, 12),
      };
      park.trees.push(tree);
      trees.push(tree);
    }
    parks.push(park);
    return park;
  }

  // The piers that reach into the harbour water (walkable, not water).
  const piers = [
    { x: ROAD.waterX - 40, y: 380, w: 190, h: 34 },
    { x: ROAD.waterX - 40, y: 900, w: 190, h: 34 },
    { x: ROAD.waterX - 40, y: 1420, w: 190, h: 34 },
    { x: ROAD.waterX - 40, y: 1900, w: 190, h: 34 },
  ];
  // The marina pier reaches into the sea at the south beach.
  const marinaPier = { x: 1360, y: ROAD.beachY - 10, w: 40, h: 170 };
  const yachtPier = { x: 2330, y: ROAD.beachY - 10, w: 40, h: 170 };

  const cols = AVENUES.length + 1;
  const rows = STREETS.length + 1;
  for (let col = 0; col < cols; col += 1) {
    for (let row = 0; row < rows; row += 1) {
      const rect = blockRect(col, row);
      if (rect.w < 60 || rect.h < 60) continue;
      const landmark = LANDMARK_BLOCKS.find(([c, r]) => c === col && r === row);
      if (landmark) {
        const [, , name, kind] = landmark;
        if (kind === 'plaza') {
          // Palm Court: open paving, a ring of trees, the Comet GT parked.
          const park = addPark({ x: rect.x, y: rect.y, w: rect.w, h: rect.h });
          park.plaza = true;
          landmarks.palmCourt = { name, x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, kind };
          parkedSpots.push({
            x: rect.x + rect.w / 2, y: rect.y + rect.h / 2,
            angle: Math.PI / 2, kind: 'sport', target: true,
          });
        } else {
          const bw = Math.min(rect.w - 50, kind === 'casino' ? 240 : 180);
          const bh = Math.min(rect.h - 50, kind === 'casino' ? 150 : 120);
          const bx = rect.x + (rect.w - bw) / 2;
          const by = rect.y + (rect.h - bh) / 2;
          addBuilding(bx, by, bw, bh, name);
          // The door: the spot a mission marker means. The building centre
          // is inside a wall the player can never reach, so the marker is
          // the pavement just outside the south wall.
          landmarks[kind] = {
            name, x: bx + bw / 2, y: by + bh / 2, w: bw, h: bh, kind,
            door: { x: bx + bw / 2, y: by + bh + 24 },
          };
          if (kind === 'garage') {
            // The garage forecourt: a lot with parked cars to take.
            lots.push({ x: rect.x, y: by + bh + 8, w: rect.w, h: rect.y + rect.h - (by + bh + 8) });
            for (let i = 0; i < 3; i += 1) {
              parkedSpots.push({
                x: rect.x + 40 + i * 60, y: rect.y + rect.h - 34,
                // Facing south, side by side: each one drives straight out onto the street.
                angle: Math.PI / 2, kind: random.pick(['sedan', 'taxi', 'sedan']),
              });
            }
          }
        }
        continue;
      }
      const roll = random.next();
      if (roll < 0.14) {
        addPark(rect);
      } else if (roll < 0.26) {
        lots.push({ x: rect.x, y: rect.y, w: rect.w, h: rect.h });
        const count = random.int(2, 5);
        for (let i = 0; i < count; i += 1) {
          parkedSpots.push({
            x: rect.x + random.range(40, rect.w - 40),
            y: rect.y + random.range(30, rect.h - 30),
            angle: random.chance(0.5) ? 0 : Math.PI / 2,
            kind: random.pick(['sedan', 'sedan', 'taxi', 'truck']),
          });
        }
      } else {
        const cellCols = rect.w > 200 ? 2 : 1;
        const cellRows = rect.h > 190 ? 2 : 1;
        for (let cx = 0; cx < cellCols; cx += 1) {
          for (let cy = 0; cy < cellRows; cy += 1) {
            if (random.chance(0.18)) continue;
            const cw = rect.w / cellCols;
            const ch = rect.h / cellRows;
            const margin = random.range(10, 18);
            addBuilding(
              rect.x + cx * cw + margin,
              rect.y + cy * ch + margin,
              cw - margin * 2,
              ch - margin * 2,
            );
          }
        }
      }
    }
  }

  // A few cars parallel-parked along the streets.
  for (let i = 0; i < 10; i += 1) {
    const avenue = random.pick(AVENUES);
    const street = random.pick(STREETS);
    const vertical = random.chance(0.5);
    parkedSpots.push({
      x: vertical ? avenue + (random.chance(0.5) ? 62 : -62) : random.range(200, ROAD.waterX - 200),
      y: vertical ? random.range(200, ROAD.beachY - 200) : street + (random.chance(0.5) ? 62 : -62),
      angle: vertical ? (random.chance(0.5) ? 0 : Math.PI) : (random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2),
      kind: random.pick(['sedan', 'sedan', 'taxi', 'sport']),
    });
  }

  // Landmarks that are not block buildings.
  landmarks.marina = { name: 'Sunset Marina', x: 1380, y: ROAD.beachY + 30, kind: 'marina' };
  landmarks.dock9 = { name: 'Dock 9', x: ROAD.waterX + 110, y: 1437, kind: 'dock' };
  landmarks.yacht = { name: "Mara's Yacht", x: 2350, y: ROAD.beachY + 110, kind: 'yacht' };

  const city = {
    buildings, parks, lots, trees, parkedSpots, landmarks, piers,
    marinaPier, yachtPier,
  };
  return city;
}

/** The point a mission marker means: a building's door, the place itself otherwise. */
export function landmarkPoint(mark) {
  if (mark.door) return { x: mark.door.x, y: mark.door.y, name: mark.name };
  return mark;
}

/** True when the point is on a road (avenue or street). */
export function onRoad(city, x, y) {
  void city;
  if (x < 0 || y < 0 || x > WORLD.width || y > WORLD.height) return false;
  for (const avenue of AVENUES) {
    if (Math.abs(x - avenue) <= HALF && y <= ROAD.beachY) return true;
  }
  for (const street of STREETS) {
    if (Math.abs(y - street) <= HALF && x <= ROAD.waterX) return true;
  }
  return false;
}

/** The road under the point, or null: { axis: 'v'|'h', line }. */
export function roadAt(city, x, y) {
  void city;
  for (const avenue of AVENUES) {
    if (Math.abs(x - avenue) <= HALF && y <= ROAD.beachY) return { axis: 'v', line: avenue };
  }
  for (const street of STREETS) {
    if (Math.abs(y - street) <= HALF && x <= ROAD.waterX) return { axis: 'h', line: street };
  }
  return null;
}

/** True when a circle at (x, y) with `radius` hits a building, water or the edge. */
export function blockedAt(city, x, y, radius) {
  if (x < radius || y < radius || x > WORLD.width - radius || y > WORLD.height - radius) return true;
  // Harbour water (east), except on a pier.
  if (x > ROAD.waterX) {
    const onPier = city.piers.some((p) => x >= p.x - radius && x <= p.x + p.w + radius && y >= p.y - radius && y <= p.y + p.h + radius);
    if (!onPier) return true;
  }
  // The sea (south), except on a pier.
  if (y > ROAD.seaY) {
    const onPier = (x >= city.marinaPier.x - radius && x <= city.marinaPier.x + city.marinaPier.w + radius)
      || (x >= city.yachtPier.x - radius && x <= city.yachtPier.x + city.yachtPier.w + radius);
    if (!onPier) return true;
  }
  for (const b of city.buildings) {
    if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) return true;
  }
  return false;
}

/**
 * Move a circle by (dx, dy) with axis-separated collision: it slides along
 * walls instead of stopping dead. Returns the new position and whether
 * either axis was blocked.
 */
export function moveCircle(city, x, y, dx, dy, radius) {
  let blockedX = false;
  let blockedY = false;
  if (!blockedAt(city, x + dx, y, radius)) x += dx;
  else blockedX = true;
  if (!blockedAt(city, x, y + dy, radius)) y += dy;
  else blockedY = true;
  return { x, y, blockedX, blockedY };
}

/** A random point on a road, for traffic spawns. */
export function randomRoadPoint(random) {
  if (random.chance(0.5)) {
    const avenue = random.pick(AVENUES);
    return { x: avenue, y: random.range(120, ROAD.beachY - 120), axis: 'v', line: avenue };
  }
  const street = random.pick(STREETS);
  return { x: random.range(120, ROAD.waterX - 120), y: street, axis: 'h', line: street };
}

/** A random point on a sidewalk, for pedestrian spawns. */
export function randomSidewalkPoint(random) {
  const point = randomRoadPoint(random);
  const side = random.chance(0.5) ? 1 : -1;
  if (point.axis === 'v') return { x: point.x + side * (HALF + 14), y: point.y };
  return { x: point.x, y: point.y + side * (HALF + 14) };
}
