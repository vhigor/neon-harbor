// The screenshot scenes behind ?shot=start|drive|chase|heist. Each one
// plays the real rules forward from a fresh city for a fixed number of
// steps, steered by a small autopilot (a road-following driver, a shooter
// who aims at the nearest Viper), so the frame is what a short game
// really looks like and the same seed always gives the same frame.

import { STEP, ROAD } from './config.js';
import { resetGame, stepWorld } from './world.js';
import { startMission } from './missions.js';
import { landmarkPoint } from './city.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';

const START_SECONDS = 5;
const DRIVE_SECONDS = 6;
const CHASE_SECONDS = 5;
const HEIST_SECONDS = 4;

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

function stageChase(state) {
  resetGame(state);
  startMission(state, 0);
  const garage = landmarkPoint(state.city.landmarks.garage);
  state.player.x = garage.x;
  state.player.y = garage.y;
  stepWorld(state, STEP, idleInput());
  putPlayerInSportCar(state, 1060, 500);
  state.wanted = 3;
  state.quietTime = 0;
  for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
    const car = state.cars.find((c) => c.id === state.player.inCar);
    if (!car) break;
    const input = driveToward(car, 1036, car.y + 500);
    input.aim = car.angle;
    input.firing = false;
    input.shootPressed = false;
    input.enter = false;
    stepWorld(state, STEP, input);
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
  for (let i = 0; i < HEIST_SECONDS / STEP; i += 1) {
    const viper = nearestViper(state);
    const aim = viper ? Math.atan2(viper.y - state.player.y, viper.x - state.player.x) : state.player.angle;
    const input = { mx: 0, my: 0, aim, firing: !!viper, shootPressed: false, enter: false };
    if (i === Math.floor(HEIST_SECONDS / STEP) - 1) state.fireCooldown = 0;
    stepWorld(state, STEP, input);
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
