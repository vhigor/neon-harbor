// Neon Harbor: every tuning number and colour in one place.
// The world is a fixed 3200 x 2300 sun-soaked coastal city; the renderer
// scales the 1280 x 720 view to the window, so no rule depends on screen size.

export const WORLD = { width: 3200, height: 2300 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** Logical view the camera shows, before it is scaled to the window. */
export const VIEW = { width: 1280, height: 720 };

export const ROAD = {
  width: 96,
  // Avenues run north-south, streets east-west.
  avenues: [260, 660, 1060, 1460, 1860, 2260, 2660],
  streets: [240, 600, 960, 1320, 1680, 2040],
  // The harbour water starts here (east) and the sea here (south).
  waterX: 2960,
  beachY: 2120,
  seaY: 2220,
};

export const PLAYER = {
  radius: 11,
  walkSpeed: 175,
  health: 100,
  pistolDamage: 34,
  bulletSpeed: 920,
  bulletRange: 520,
  startAmmo: 24,
  maxAmmo: 120,
  startMoney: 150,
  invulnerable: 1.5,
};

export const CAR = {
  length: 46,
  width: 22,
  // Top speed by kind, in world units per second.
  topSpeed: { sedan: 300, taxi: 300, truck: 230, sport: 350, police: 315 },
  accel: { sedan: 210, taxi: 210, truck: 150, sport: 290, police: 260 },
  turnRate: 2.6,
  health: { sedan: 100, taxi: 100, truck: 160, sport: 90, police: 140 },
  // Entering a car that is not yours is a crime.
  carjackWanted: 1,
};

export const TRAFFIC = { cars: 14, peds: 26, carSpeed: 150, pedSpeed: 55 };

export const POLICE = {
  // How many units the wanted level asks for (foot cops + cars together).
  unitsFor: [0, 1, 3, 4, 5, 6],
  carSpeed: 315,
  copSpeed: 168,
  arrestTime: 0.8,
  arrestRange: 17,
  // Seconds of quiet before one star fades.
  decaySeconds: 20,
  spawnRange: 620,
};

export const WANTED = {
  max: 5,
  carjack: 1,
  shoot: 1,
  hitPed: 1,
  killPed: 1,
  shootCop: 1,
  destroyCar: 1,
};

export const MISSION = {
  reward: [250, 400, 600, 800, 1500, 3000],
  failMoneyLoss: 0.1,
  fareMin: 60,
  fareMax: 120,
};

export const SAVE_KEY = 'neon-harbor.save.v1';

export const PALETTE = {
  sky: '#ffe9b8',
  grass: '#7fb069',
  grassDark: '#6a9e58',
  sand: '#f2d492',
  water: '#2e86ab',
  waterDeep: '#1f6a8c',
  asphalt: '#4a4a52',
  asphaltDark: '#3d3d45',
  sidewalk: '#b8b0a4',
  lane: '#f5d76e',
  buildingRoof: ['#c96f4a', '#4a7d8c', '#d9a441', '#8c5a7d', '#5a8c6a', '#b05252', '#6a6a9e', '#c9c2b4'],
  buildingEdge: '#00000033',
  park: '#5d8a4a',
  tree: '#3f7a34',
  treeLight: '#5da244',
  player: '#ffd23f',
  playerDark: '#c9a227',
  police: '#2b4acb',
  policeLight: '#d92038',
  viper: '#7d3cff',
  ped: ['#e2622b', '#2b8ce2', '#e2b32b', '#7d3cff', '#2be28c', '#e22b7d'],
  carColors: ['#d94040', '#3f7fd9', '#f2c94c', '#3fae6a', '#e2e2e2', '#7a4a9e', '#e2802b', '#2bd9c7'],
  taxi: '#f7c948',
  sport: '#e63946',
  text: '#fff8e7',
  muted: '#d8cdb4',
  panel: 'rgba(12, 16, 28, 0.72)',
  panelEdge: 'rgba(255, 255, 255, 0.16)',
  star: '#ffd23f',
  starEmpty: 'rgba(255, 255, 255, 0.28)',
  marker: '#ffd23f',
  markerBad: '#ff4d4d',
  cash: '#7ee081',
  health: '#ff6b6b',
  ammo: '#f2c94c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
