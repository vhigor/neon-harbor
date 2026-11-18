// The screenshot scenes behind ?shot=start|drive|chase|heist. Each one
// plays the real rules forward from a fresh city for a fixed number of
// steps, steered by a small autopilot (a road-following driver, a shooter
// who aims at the nearest Viper), so the frame is what a short game
// really looks like and the same seed always gives the same frame.

import { STEP, ROAD, PALETTE } from './config.js';
import { resetGame, stepWorld } from './world.js';
import { startMission, spawnViper } from './missions.js';
import { landmarkPoint, blockedAt } from './city.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';

const START_SECONDS = 5;
const DRIVE_SECONDS = 6;
const CHASE_SECONDS = 2.5;
const HEIST_SECONDS = 3;

/** Steer a car toward a point: returns the { mx, my } the loop feeds in. */
function driveToward(car, tx, ty) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return { mx: diff > 0.08 ? 1 : diff < -0.08 ? -1 : 0, my: -1 };
}

function idleInput() {
  return { mx: 0, my: 0, aim: 0, firing: false, shootPressed: false, enter: false };
}

function nearestViper(state) {
  let best = null;
  let bestD = Infinity;
  for (const ped of state.peds) {
    if (ped.kind !== 'viper' || ped.state === 'down') continue;
    const d = Math.hypot(ped.x - state.player.x, ped.y - state.player.y);
    if (d < bestD) { bestD = d; best = ped; }
  }
  return best;
}

/** Put the player behind the wheel of a sport car on the given avenue. */
function putPlayerInSportCar(state, avenueX, y) {
  const car = state.cars.find((c) => c.kind === 'sport') || state.cars[0];
  car.x = avenueX - 24;
  car.y = y;
  car.angle = Math.PI / 2;
  car.speed = 0;
  car.driver = 'player';
  car.health = car.maxHealth;
  state.player.inCar = car.id;
  state.player.x = car.x;
  state.player.y = car.y;
  state.player.angle = car.angle;
  return car;
}

function stageStart(state) {
  resetGame(state);
  // Rook on foot by the casino, the city alive around him.
  state.player.x = state.city.landmarks.casino.x;
  state.player.y = state.city.landmarks.casino.y + 130;
  state.player.angle = -Math.PI / 2;
  for (let i = 0; i < START_SECONDS / STEP; i += 1) stepWorld(state, STEP, idleInput());
  return { screen: SCREEN_TITLE, extra: { missionsDone: 0, earned: 0, hasSave: false, endKind: null } };
}

function stageDrive(state) {
  resetGame(state);
  startMission(state, 0);
  // Stand on the package: the first stage completes, the delivery begins.
  const garage = landmarkPoint(state.city.landmarks.garage);
  state.player.x = garage.x;
  state.player.y = garage.y;
  stepWorld(state, STEP, idleInput());
  // Then take the Comet GT south down the avenue toward the marina.
  putPlayerInSportCar(state, 1460, 300);
  for (let i = 0; i < DRIVE_SECONDS / STEP; i += 1) {
    const car = state.cars.find((c) => c.id === state.player.inCar);
    const input = driveToward(car, 1436, car.y + 500);
    input.aim = car.angle;
    input.firing = false;
    input.shootPressed = false;
    input.enter = false;
    stepWorld(state, STEP, input);
  }
  return { screen: SCREEN_PLAY, extra: { missionsDone: 0, earned: 0, hasSave: false, endKind: null } };
}

function makePoliceCar(id, x, y) {
  return {
    id,
    x, y,
    angle: Math.PI / 2,
    speed: 315,
    cruise: 315,
    kind: 'police',
    color: PALETTE.police,
    health: 140,
    maxHealth: 140,
    driver: 'police',
    axis: 'v',
    line: 1460,
    dir: 1,
    stopped: false,
    siren: 0,
  };
}

function makeFootCop(x, y) {
  return {
    x, y,
    angle: 0,
    speed: 168,
    color: PALETTE.police,
    kind: 'cop',
    health: 100,
    state: 'walk',
    fleeT: 0,
    downT: 0,
    axis: 'h',
    dir: 1,
    waitT: 0,
    fareDest: null,
    fareTimer: 0,
    arrestT: 0,
    shootT: 1,
  };
}

/**
 * Move every car out of the chase corridor (the avenue the run uses, and
 * the two streets it crosses) onto roads the camera never sees, so the
 * frame is a pursuit and not a pile-up. Parked cars go to the far avenue's
 * edge; traffic keeps driving, just elsewhere.
 */
function clearChaseCorridor(state, avenue) {
  for (const other of state.cars) {
    // The patrol cars are staged separately, and the player's own car is
    // the one the corridor is cleared for — neither moves.
    if (other.driver === 'police' || other.driver === 'player') continue;
    const onAvenue = other.axis === 'v' && other.line === avenue;
    const crosses = other.axis === 'h' && (other.line === 600 || other.line === 960);
    const parkedInCorridor = other.driver !== 'traffic'
      && Math.abs(other.x - avenue) < 90 && other.y > 120 && other.y < 1500;
    if (!onAvenue && !crosses && !parkedInCorridor) continue;
    if (other.driver === 'traffic') {
      other.axis = 'v';
      other.line = 2260;
      other.dir = 1;
      other.x = 2236;
      other.angle = Math.PI / 2;
    } else {
      other.x = 2260 + 62;
      other.angle = Math.PI / 2;
    }
  }
}

function stageChase(state) {
  resetGame(state);
  startMission(state, 0);
  const garage = landmarkPoint(state.city.landmarks.garage);
  state.player.x = garage.x;
  state.player.y = garage.y;
  stepWorld(state, STEP, idleInput());
  // A clean high-speed pursuit down one long avenue: the Comet GT already
  // rolling at speed, two patrol cars trailing in formation behind it.
  const AVENUE = 1460;
  const car = putPlayerInSportCar(state, AVENUE, 300);
  car.speed = 300;
  car.health = 78; // dented by the chase so far, not fresh off the lot
  clearChaseCorridor(state, AVENUE);
  // Two patrol cars on the player's tail, and two foot cops far away, so
  // the department's wanted-3 response is full and no surprise unit
  // spawns into the frame mid-run.
  state.cars.push(makePoliceCar(9001, AVENUE - 24, 100));
  state.cars.push(makePoliceCar(9002, AVENUE + 24, 60));
  state.peds.push(makeFootCop(300, 300));
  state.peds.push(makeFootCop(340, 340));
  state.wanted = 3;
  state.quietTime = 0;
  for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
    const c = state.cars.find((cc) => cc.id === state.player.inCar);
    if (!c) break;
    const input = driveToward(c, AVENUE, c.y + 500);
    input.aim = c.angle;
    input.firing = false;
    input.shootPressed = false;
    input.enter = false;
    stepWorld(state, STEP, input);
  }
  // Hold the pursuit in frame: the patrol cars settle into formation
  // behind the Comet GT for the shot, light bars flashing.
  const pc = state.cars.find((cc) => cc.id === state.player.inCar);
  if (pc) {
    const followers = state.cars.filter((cc) => cc.driver === 'police' && (cc.id === 9001 || cc.id === 9002));
    if (followers[0]) {
      followers[0].x = pc.x - 24;
      followers[0].y = pc.y - 210;
      followers[0].angle = Math.PI / 2;
      followers[0].speed = 315;
    }
    if (followers[1]) {
      followers[1].x = pc.x + 24;
      followers[1].y = pc.y - 330;
      followers[1].angle = Math.PI / 2;
      followers[1].speed = 315;
    }
  }
  return { screen: SCREEN_PLAY, extra: { missionsDone: 0, earned: 0, hasSave: false, endKind: null } };
}

function stageHeist(state) {
  resetGame(state);
  startMission(state, 4);
  // Walk into the casino: the vault-cracking stage begins, guards and all.
  const casino = landmarkPoint(state.city.landmarks.casino);
  state.player.x = casino.x;
  state.player.y = casino.y;
  for (let i = 0; i < 30; i += 1) stepWorld(state, STEP, idleInput());
  const steps = HEIST_SECONDS / STEP;
  for (let i = 0; i < steps; i += 1) {
    const viper = nearestViper(state);
    const aim = viper ? Math.atan2(viper.y - state.player.y, viper.x - state.player.x) : state.player.angle;
    const input = { mx: 0, my: 0, aim, firing: !!viper, shootPressed: false, enter: false };
    // A stream of tracers in the frame: fire on the last steps, not just one.
    if (i >= steps - 3) state.fireCooldown = 0;
    stepWorld(state, STEP, input);
  }
  // One Viper still standing and closing in, so the fight reads in the
  // frame instead of only its aftermath.
  const spots = [
    { x: state.player.x + 150, y: state.player.y - 90 },
    { x: state.player.x - 150, y: state.player.y - 60 },
    { x: state.player.x + 90, y: state.player.y + 150 },
  ];
  for (const spot of spots) {
    if (!blockedAt(state.city, spot.x, spot.y, 12)) {
      spawnViper(state, spot.x, spot.y);
      break;
    }
  }
  return { screen: SCREEN_PLAY, extra: { missionsDone: 0, earned: 0, hasSave: false, endKind: null } };
}

/**
 * Set `state` to the named scene (start, drive, chase, heist; any other
 * name is start) and return the screen to draw over it.
 */
export function stageShot(name, state) {
  if (name === 'drive') return stageDrive(state);
  if (name === 'chase') return stageChase(state);
  if (name === 'heist') return stageHeist(state);
  return stageStart(state);
}

export { ROAD };
