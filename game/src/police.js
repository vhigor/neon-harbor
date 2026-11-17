// The wanted level and the Harbor Police who answer it. Stars rise with
// crimes and fade with quiet time; the department sends foot cops and
// patrol cars in proportion, and they chase, ram and arrest. Being caught
// on foot means BUSTED; losing all health means WASTED; both cost money
// and end the active mission.

import { ROAD, POLICE, WANTED, CAR, PALETTE } from './config.js';
import { randomRoadPoint, blockedAt } from './city.js';

let nextPoliceId = 10000;

/** Raise the wanted level (capped), and restart the quiet-time clock. */
export function addWanted(state, amount) {
  if (amount <= 0) return;
  const before = state.wanted;
  state.wanted = Math.min(WANTED.max, state.wanted + amount);
  state.quietTime = 0;
  if (state.wanted > before) state.wantedFlash = 1.2;
}

/** One star fades after `decaySeconds` with no crime and no police near. */
export function updateWanted(state, dt) {
  if (state.wanted === 0) return;
  state.quietTime += dt;
  let policeNear = false;
  for (const cop of state.peds) {
    if (cop.kind !== 'cop') continue;
    const dx = cop.x - state.player.x;
    const dy = cop.y - state.player.y;
    if (dx * dx + dy * dy < 520 * 520) { policeNear = true; break; }
  }
  if (!policeNear) {
    for (const car of state.cars) {
      if (car.driver !== 'police') continue;
      const dx = car.x - state.player.x;
      const dy = car.y - state.player.y;
      if (dx * dx + dy * dy < 520 * 520) { policeNear = true; break; }
    }
  }
  if (!policeNear && state.quietTime >= POLICE.decaySeconds) {
    state.wanted -= 1;
    state.quietTime = 0;
  }
  if (state.wantedFlash > 0) state.wantedFlash -= dt;
}

function policeCount(state) {
  let count = 0;
  for (const car of state.cars) if (car.driver === 'police') count += 1;
  for (const ped of state.peds) if (ped.kind === 'cop' && ped.state !== 'down') count += 1;
  return count;
}

function spawnPoliceCar(state) {
  const point = randomRoadPoint(state.random);
  const car = {
    id: nextPoliceId,
    x: point.axis === 'v' ? point.line : point.x,
    y: point.axis === 'h' ? point.line : point.y,
    angle: point.axis === 'v' ? Math.PI / 2 : 0,
    speed: 60,
    cruise: POLICE.carSpeed,
    kind: 'police',
    color: PALETTE.police,
    health: CAR.health.police,
    maxHealth: CAR.health.police,
    driver: 'police',
    axis: point.axis,
    line: point.line,
    dir: 1,
    stopped: false,
    siren: 0,
  };
  nextPoliceId += 1;
  state.cars.push(car);
  return car;
}

function spawnCop(state) {
  const point = randomRoadPoint(state.random);
  const cop = {
    x: point.x,
    y: point.y,
    angle: 0,
    speed: POLICE.copSpeed,
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
    shootT: state.random.range(0.5, 1.5),
  };
  state.peds.push(cop);
  return cop;
}

function angleToward(from, to, maxTurn) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > maxTurn) diff = maxTurn;
  if (diff < -maxTurn) diff = -maxTurn;
  return from + diff;
}

function updatePoliceCar(state, car, dt) {
  const player = state.player;
  const targetX = player.inCar
    ? state.cars.find((c) => c.id === player.inCar)?.x ?? player.x
    : player.x;
  const targetY = player.inCar
    ? state.cars.find((c) => c.id === player.inCar)?.y ?? player.y
    : player.y;
  const want = Math.atan2(targetY - car.y, targetX - car.x);
  // If a building sits straight ahead, bias the steering around it.
  const aheadX = car.x + Math.cos(car.angle) * 60;
  const aheadY = car.y + Math.sin(car.angle) * 60;
  let steer = want;
  if (blockedAt(state.city, aheadX, aheadY, 20)) steer = want + Math.PI / 2.5;
  car.angle = angleToward(car.angle, steer, CAR.turnRate * dt);
  const dist = Math.hypot(targetX - car.x, targetY - car.y);
  const top = dist > 300 ? POLICE.carSpeed : POLICE.carSpeed * 0.75;
  car.speed += (top - car.speed) * Math.min(1, dt * 0.9);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Ramming the player's car damages it.
  if (player.inCar) {
    const pc = state.cars.find((c) => c.id === player.inCar);
    if (pc) {
      const dx = pc.x - car.x;
      const dy = pc.y - car.y;
      const d = Math.hypot(dx, dy);
      if (d < 42 && d > 0.01) {
        pc.health -= 14 * dt;
        pc.x += (dx / d) * 26 * dt;
        pc.y += (dy / d) * 26 * dt;
        if (state.random.chance(dt * 2)) state.audio.crash();
        if (pc.health <= 0) state.carDestroyed = pc;
      }
    }
  }
  car.siren += dt;
}

function updateCop(state, cop, dt) {
  const player = state.player;
  const dx = player.x - cop.x;
  const dy = player.y - cop.y;
  const dist = Math.hypot(dx, dy);
  cop.angle = Math.atan2(dy, dx);
  if (dist > 14) {
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
  }
  // On foot and caught: the arrest meter fills.
  if (!player.inCar && dist < POLICE.arrestRange) {
    cop.arrestT += dt;
    if (cop.arrestT >= POLICE.arrestTime) state.busted = true;
  } else {
    cop.arrestT = Math.max(0, cop.arrestT - dt * 2);
  }
  // At three stars and up, foot cops open fire from range.
  if (state.wanted >= 3 && dist < 340 && dist > 40) {
    cop.shootT -= dt;
    if (cop.shootT <= 0) {
      cop.shootT = state.random.range(1.0, 1.6);
      const aim = Math.atan2(dy, dx) + state.random.range(-0.14, 0.14);
      state.bullets.push({
        x: cop.x + Math.cos(aim) * 16,
        y: cop.y + Math.sin(aim) * 16,
        vx: Math.cos(aim) * 700,
        vy: Math.sin(aim) * 700,
        life: 0.8,
        from: 'cop',
        damage: 6,
      });
      state.audio.enemyShot();
    }
  }
}

export function updatePolice(state, dt) {
  const wanted = state.wanted;
  const desired = POLICE.unitsFor[wanted];
  let count = policeCount(state);
  // Bring the response up to the wanted level, spawning on nearby roads.
  let guard = 0;
  while (count < desired && guard < 6) {
    guard += 1;
    if (state.random.chance(wanted >= 2 ? 0.6 : 0.35)) spawnPoliceCar(state);
    else spawnCop(state);
    count += 1;
  }
  // When the heat fades, the farthest units stand down.
  if (count > desired) {
    const units = [];
    for (const car of state.cars) {
      if (car.driver === 'police') units.push({ kind: 'car', ref: car, d: Math.hypot(car.x - state.player.x, car.y - state.player.y) });
    }
    for (const ped of state.peds) {
      if (ped.kind === 'cop') units.push({ kind: 'cop', ref: ped, d: Math.hypot(ped.x - state.player.x, ped.y - state.player.y) });
    }
    units.sort((a, b) => b.d - a.d);
    for (let i = 0; i < count - desired; i += 1) {
      const unit = units[i];
      if (!unit) break;
      if (unit.kind === 'car') state.cars = state.cars.filter((c) => c !== unit.ref);
      else state.peds = state.peds.filter((p) => p !== unit.ref);
    }
  }
  for (const car of state.cars) {
    if (car.driver === 'police') updatePoliceCar(state, car, dt);
  }
  for (const cop of state.peds) {
    if (cop.kind === 'cop' && cop.state !== 'down') updateCop(state, cop, dt);
  }
  // The siren wails while any unit is close.
  let near = false;
  for (const car of state.cars) {
    if (car.driver !== 'police') continue;
    const dx = car.x - state.player.x;
    const dy = car.y - state.player.y;
    if (dx * dx + dy * dy < 700 * 700) { near = true; break; }
  }
  state.audio.siren(near && wanted > 0);
}
