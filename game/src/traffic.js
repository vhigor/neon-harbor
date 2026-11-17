// The city's other road users: traffic cars that drive the road grid and
// pedestrians who walk the sidewalks, flee gunfire and hop into the
// player's car for a fare. Police and the story's armed Vipers live in
// police.js and missions.js; this file only moves the civilians.

import { WORLD, ROAD, TRAFFIC, PALETTE, CAR } from './config.js';
import { randomRoadPoint, randomSidewalkPoint, roadAt } from './city.js';

const HALF = ROAD.width / 2;
let nextId = 1;

/** The right-hand lane for a direction on a road: southbound hugs the west side. */
function laneFor(axis, line, dir) {
  if (axis === 'v') return line + (dir > 0 ? -24 : 24);
  return line + (dir > 0 ? 24 : -24);
}

function makeTrafficCar(random, city, near) {
  const point = randomRoadPoint(random);
  const dir = random.chance(0.5) ? 1 : -1;
  const kind = random.pick(['sedan', 'sedan', 'sedan', 'taxi', 'taxi', 'truck']);
  const car = {
    id: nextId,
    x: point.axis === 'v' ? laneFor('v', point.line, dir) : point.x,
    y: point.axis === 'h' ? laneFor('h', point.line, dir) : point.y,
    angle: point.axis === 'v' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
    speed: 0,
    cruise: TRAFFIC.carSpeed * random.range(0.85, 1.1),
    kind,
    color: kind === 'taxi' ? PALETTE.taxi : random.pick(PALETTE.carColors),
    health: CAR.health[kind],
    maxHealth: CAR.health[kind],
    driver: 'traffic',
    axis: point.axis,
    line: point.line,
    dir,
    stopped: false,
  };
  nextId += 1;
  void city;
  void near;
  return car;
}

function makePed(random, city) {
  const point = randomSidewalkPoint(random);
  const road = roadAt(city, point.x, point.y);
  return {
    x: point.x,
    y: point.y,
    angle: random.range(0, Math.PI * 2),
    speed: TRAFFIC.pedSpeed * random.range(0.8, 1.2),
    color: random.pick(PALETTE.ped),
    kind: 'walker',
    health: 100,
    state: 'walk',
    fleeT: 0,
    downT: 0,
    axis: road ? road.axis : 'h',
    dir: random.chance(0.5) ? 1 : -1,
    waitT: 0,
    fareDest: null,
    fareTimer: 0,
  };
}

export function spawnTraffic(state) {
  while (state.cars.filter((c) => c.driver === 'traffic').length < TRAFFIC.cars) {
    const car = makeTrafficCar(state.random, state.city);
    // Keep new cars out of the player's immediate view so they pop in unseen.
    const dx = car.x - state.player.x;
    const dy = car.y - state.player.y;
    if (dx * dx + dy * dy < 500 * 500) continue;
    state.cars.push(car);
  }
}

export function spawnPeds(state) {
  while (state.peds.filter((p) => p.kind === 'walker').length < TRAFFIC.peds) {
    const ped = makePed(state.random, state.city);
    const dx = ped.x - state.player.x;
    const dy = ped.y - state.player.y;
    if (dx * dx + dy * dy < 420 * 420) continue;
    state.peds.push(ped);
  }
}

/** A fare customer: stands waving on a sidewalk until a car stops for them. */
export function spawnFare(state) {
  if (state.fare) return;
  const point = randomSidewalkPoint(state.random);
  const dest = randomRoadPoint(state.random);
  const ped = makePed(state.random, state.city);
  ped.x = point.x;
  ped.y = point.y;
  ped.kind = 'fare';
  ped.fareDest = { x: dest.x, y: dest.y };
  ped.fareTimer = 75;
  state.peds.push(ped);
  state.fare = { ped, dest: ped.fareDest, timer: ped.fareTimer, pickedUp: false };
}

function carAhead(state, car) {
  let nearest = null;
  let nearestDist = 78;
  for (const other of state.cars) {
    if (other === car) continue;
    if (other.axis !== car.axis || other.dir !== car.dir) continue;
    const along = car.axis === 'v' ? (other.y - car.y) * car.dir : (other.x - car.x) * car.dir;
    const across = car.axis === 'v' ? Math.abs(other.x - car.x) : Math.abs(other.y - car.y);
    if (along > 0 && along < nearestDist && across < 26) {
      nearest = other;
      nearestDist = along;
    }
  }
  return nearest;
}

function maybeTurn(state, car) {
  const random = state.random;
  if (random.chance(0.72)) return;
  if (car.axis === 'v') {
    const street = ROAD.streets.find((s) => Math.abs(car.y - s) < 14);
    if (street === undefined) return;
    const dir = random.chance(0.5) ? 1 : -1;
    car.axis = 'h';
    car.line = street;
    car.dir = dir;
    car.y = laneFor('h', street, dir);
    car.angle = dir > 0 ? 0 : Math.PI;
  } else {
    const avenue = ROAD.avenues.find((a) => Math.abs(car.x - a) < 14);
    if (avenue === undefined) return;
    const dir = random.chance(0.5) ? 1 : -1;
    car.axis = 'v';
    car.line = avenue;
    car.dir = dir;
    car.x = laneFor('v', avenue, dir);
    car.angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
}

export function updateTraffic(state, dt) {
  const player = state.player;
  for (const car of state.cars) {
    if (car.driver !== 'traffic') continue;
    const ahead = carAhead(state, car);
    const target = ahead ? Math.max(0, ahead.speed - 20) : car.cruise;
    car.speed += Math.max(-260, Math.min(160, (target - car.speed))) * dt;
    if (car.speed < 0) car.speed = 0;
    if (car.axis === 'v') {
      car.y += car.dir * car.speed * dt;
      car.x += (laneFor('v', car.line, car.dir) - car.x) * Math.min(1, dt * 3);
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (car.y < 60 || car.y > ROAD.beachY - 60) car.dir *= -1;
    } else {
      car.x += car.dir * car.speed * dt;
      car.y += (laneFor('h', car.line, car.dir) - car.y) * Math.min(1, dt * 3);
      car.angle = car.dir > 0 ? 0 : Math.PI;
      if (car.x < 60 || car.x > ROAD.waterX - 60) car.dir *= -1;
    }
    maybeTurn(state, car);
    // Far from the player, recycle the car onto a road near the player.
    const dx = car.x - player.x;
    const dy = car.y - player.y;
    if (dx * dx + dy * dy > 1100 * 1100) {
      const fresh = makeTrafficCar(state.random, state.city);
      car.x = fresh.x;
      car.y = fresh.y;
      car.axis = fresh.axis;
      car.line = fresh.line;
      car.dir = fresh.dir;
      car.angle = fresh.angle;
      car.speed = 0;
      car.kind = fresh.kind;
      car.color = fresh.color;
    }
  }
}

export function updatePeds(state, dt) {
  const player = state.player;
  const playerCar = player.inCar ? state.cars.find((c) => c.id === player.inCar) : null;
  for (const ped of state.peds) {
    if (ped.state === 'down') {
      ped.downT -= dt;
      continue;
    }
    if (ped.kind === 'fare' && !state.fare?.pickedUp) {
      // Waving on the sidewalk: wait for a slow car to stop nearby.
      ped.waitT += dt;
      if (playerCar && playerCar.speed < 40) {
        const dx = ped.x - playerCar.x;
        const dy = ped.y - playerCar.y;
        if (dx * dx + dy * dy < 55 * 55) {
          ped.state = 'riding';
          state.fare.pickedUp = true;
          state.fare.timer = 60;
          state.message = 'Fare aboard — take them to the marker.';
          state.audio.pickup();
        }
      }
      if (ped.waitT > 75) {
        // Gave up waiting: walks off and another fare appears later.
        ped.kind = 'walker';
        state.fare = null;
        state.fareTimer = state.random.range(8, 18);
      }
      continue;
    }
    if (ped.state === 'riding') continue;
    if (ped.fleeT > 0) {
      ped.fleeT -= dt;
      ped.x += Math.cos(ped.angle) * ped.speed * 2.1 * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * 2.1 * dt;
      ped.x = Math.max(20, Math.min(WORLD.width - 20, ped.x));
      ped.y = Math.max(20, Math.min(WORLD.height - 20, ped.y));
      continue;
    }
    // Ambling along the sidewalk; turn at intersections sometimes.
    const step = ped.speed * ped.dir * dt;
    if (ped.axis === 'v') ped.y += step;
    else ped.x += step;
    if (state.random.chance(dt * 0.12)) {
      const road = roadAt(state.city, ped.x, ped.y);
      if (road && road.axis !== ped.axis) {
        ped.axis = road.axis;
        ped.dir = state.random.chance(0.5) ? 1 : -1;
      } else if (state.random.chance(0.3)) {
        ped.dir *= -1;
      }
    }
    if (ped.axis === 'v') ped.angle = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    else ped.angle = ped.dir > 0 ? 0 : Math.PI;
    if (ped.x < 40 || ped.x > WORLD.width - 40 || ped.y < 40 || ped.y > WORLD.height - 40) {
      ped.dir *= -1;
    }
    // A car bearing down makes them run.
    const threat = playerCar || null;
    if (threat && threat.speed > 120) {
      const dx = ped.x - threat.x;
      const dy = ped.y - threat.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 90 * 90) {
        ped.angle = Math.atan2(dy, dx);
        ped.fleeT = 1.6;
      }
    }
  }
  // The fallen fade away.
  state.peds = state.peds.filter((p) => !(p.state === 'down' && p.downT <= 0));
  // A new fare customer appears now and then.
  if (!state.fare) {
    state.fareTimer -= dt;
    if (state.fareTimer <= 0) spawnFare(state);
  } else if (state.fare.pickedUp) {
    state.fare.timer -= dt;
    const dest = state.fare.dest;
    const dx = dest.x - player.x;
    const dy = dest.y - player.y;
    if (dx * dx + dy * dy < 60 * 60) {
      const pay = state.random.int(60, 120);
      player.money += pay;
      state.stats.earned += pay;
      state.stats.fares += 1;
      state.message = `Fare delivered: +$${pay}.`;
      state.audio.cash();
      state.fare = null;
      state.fareTimer = state.random.range(10, 20);
      state.peds = state.peds.filter((p) => p.state !== 'riding');
    } else if (state.fare.timer <= 0) {
      state.message = 'Fare gave up and left.';
      state.fare = null;
      state.fareTimer = state.random.range(10, 20);
      state.peds = state.peds.filter((p) => p.state !== 'riding');
    }
  }
}

/** Make every pedestrian near a gunshot run for it. */
export function scarePeds(state, x, y, radius) {
  for (const ped of state.peds) {
    if (ped.state !== 'walk' || ped.kind !== 'walker') continue;
    const dx = ped.x - x;
    const dy = ped.y - y;
    if (dx * dx + dy * dy < radius * radius) {
      ped.angle = Math.atan2(dy, dx);
      ped.fleeT = 2;
    }
  }
}
