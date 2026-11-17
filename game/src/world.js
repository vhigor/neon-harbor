// Neon Harbor's simulation: the player on foot and behind the wheel,
// stealing and driving cars, shooting, picking up cash, fares and the
// mission story, and the consequences (BUSTED, WASTED) when the city wins.
// One fixed step advances everything; the renderer only paints the state.

import { WORLD, STEP, PLAYER, CAR, TRAFFIC, WANTED, MISSION, SAVE_KEY, PALETTE } from './config.js';
import { createCity, blockedAt, moveCircle } from './city.js';
import { spawnTraffic, spawnPeds, updateTraffic, updatePeds, scarePeds } from './traffic.js';
import { addWanted, updateWanted, updatePolice } from './police.js';
import { startMission, updateMission, updateVipers, failMission, missionObjective } from './missions.js';

let nextCarId = 1;

function makeCar(state, spot, driver) {
  const kind = spot.kind;
  const car = {
    id: nextCarId,
    x: spot.x,
    y: spot.y,
    angle: spot.angle,
    speed: 0,
    cruise: TRAFFIC.carSpeed,
    kind,
    color: kind === 'taxi' ? PALETTE.taxi : kind === 'sport' ? PALETTE.sport : state.random.pick(PALETTE.carColors),
    health: CAR.health[kind],
    maxHealth: CAR.health[kind],
    driver: driver || null,
    axis: 'v',
    line: spot.x,
    dir: 1,
    stopped: false,
    isTarget: !!spot.target,
    stolen: false,
  };
  nextCarId += 1;
  return car;
}

function scatterPickups(state) {
  const kinds = ['cash', 'cash', 'cash', 'health', 'ammo'];
  for (let i = 0; i < 14; i += 1) {
    const kind = kinds[i % kinds.length];
    const x = state.random.range(120, WORLD.width - 120);
    const y = state.random.range(120, WORLD.height - 120);
    if (blockedAt(state.city, x, y, 10)) continue;
    state.pickups.push({
      x, y, kind,
      amount: kind === 'cash' ? state.random.int(25, 100) : kind === 'health' ? 30 : 24,
      missionCash: false,
      bob: state.random.range(0, Math.PI * 2),
    });
  }
}

export function createGame(random, audio) {
  const city = createCity(random);
  const state = {
    random,
    city,
    audio,
    time: 0,
    player: {
      // On the street corner by the garage: the first job's marker is a
      // short walk away, not underfoot.
      x: city.landmarks.garage.x + 120,
      y: city.landmarks.garage.y + 140,
      angle: -Math.PI / 2,
      health: PLAYER.health,
      money: PLAYER.startMoney,
      ammo: PLAYER.startAmmo,
      inCar: null,
      invuln: 0,
      aimAngle: 0,
      speed: 0,
    },
    cars: [],
    peds: [],
    bullets: [],
    particles: [],
    pickups: [],
    wanted: 0,
    quietTime: 0,
    wantedFlash: 0,
    mission: { index: 0, info: null, stage: 0, timer: 0, active: false, failed: false, holdProgress: 0, kills: 0 },
    missionIndex: 0,
    storyDone: false,
    fare: null,
    fareTimer: 10,
    busted: false,
    wasted: false,
    endScreen: null,
    carDestroyed: null,
    message: 'Welcome to Neon Harbor. Reach the M marker for your first job.',
    messageT: 5,
    banner: null,
    stats: { earned: 0, missions: 0, fares: 0, kills: 0, carsStolen: 0 },
    camera: { x: 0, y: 0 },
    shake: 0,
    autosave: false,
    pickupTimer: 18,
    fireCooldown: 0,
  };
  for (const spot of city.parkedSpots) state.cars.push(makeCar(state, spot, null));
  spawnTraffic(state);
  spawnPeds(state);
  scatterPickups(state);
  return state;
}

/** A fresh game: same city seed, everything else reset. */
export function resetGame(state) {
  const fresh = createGame(state.random, state.audio);
  for (const key of Object.keys(fresh)) state[key] = fresh[key];
}

function burst(state, x, y, color, count, speed, life, size) {
  for (let i = 0; i < count; i += 1) {
    const angle = state.random.range(0, Math.PI * 2);
    const sp = state.random.range(speed * 0.3, speed);
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * sp,
      vy: Math.sin(angle) * sp,
      life: state.random.range(life * 0.5, life),
      maxLife: life,
      size: state.random.range(size * 0.6, size * 1.4),
      color,
      kind: 'spark',
    });
  }
  if (state.particles.length > 320) state.particles.splice(0, state.particles.length - 320);
}

function explosion(state, x, y) {
  burst(state, x, y, '#ff9f1c', 22, 260, 0.7, 5);
  burst(state, x, y, '#ff5714', 16, 180, 0.9, 7);
  burst(state, x, y, '#3a3a3a', 12, 60, 1.6, 9);
  state.shake = Math.max(state.shake, 14);
  state.audio.explosion();
  scarePeds(state, x, y, 320);
}

function damagePlayer(state, amount) {
  const player = state.player;
  if (player.invuln > 0 || state.endScreen) return;
  player.health -= amount;
  player.invuln = 0.5;
  state.shake = Math.max(state.shake, 6);
  if (player.health <= 0) {
    player.health = 0;
    state.wasted = true;
  }
}

function respawn(state, kind) {
  const player = state.player;
  const place = kind === 'busted' ? state.city.landmarks.precinct : state.city.landmarks.hospital;
  const lost = Math.floor(player.money * MISSION.failMoneyLoss);
  player.money -= lost;
  player.health = PLAYER.health;
  player.ammo = Math.max(player.ammo, 12);
  player.x = place.x;
  player.y = place.y + 80;
  player.inCar = null;
  player.invuln = 2;
  state.wanted = 0;
  state.quietTime = 0;
  if (state.mission.active) failMission(state, kind === 'busted' ? 'busted by the police' : 'wasted');
  state.endScreen = kind;
  state.audio.busted();
  state.message = kind === 'busted'
    ? `BUSTED — the Harbor Police took $${lost}.`
    : `WASTED — the hospital patched you up for $${lost}.`;
  state.messageT = 4;
}

function nearestCar(state, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    const dx = car.x - x;
    const dy = car.y - y;
    const d = Math.hypot(dx, dy);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function enterCar(state) {
  const player = state.player;
  const car = nearestCar(state, player.x, player.y, 58);
  if (!car) return;
  if (car.driver === 'police') {
    // Stealing a patrol car is bold; the department notices at once.
    addWanted(state, WANTED.carjack + 1);
  } else if (!car.stolen && car.driver !== 'player') {
    addWanted(state, WANTED.carjack);
    state.stats.carsStolen += 1;
    car.stolen = true;
    state.message = 'Car stolen — the heat is on.';
    state.messageT = 2.5;
  }
  // A traffic driver bails out when their car is taken.
  if (car.driver === 'traffic') {
    const ped = {
      x: car.x + 30, y: car.y + 30, angle: 0, speed: 60,
      color: '#e2622b', kind: 'walker', health: 100, state: 'walk',
      fleeT: 2, downT: 0, axis: 'h', dir: 1, waitT: 0, fareDest: null, fareTimer: 0,
    };
    ped.angle = Math.atan2(ped.y - player.y, ped.x - player.x);
    state.peds.push(ped);
  }
  car.driver = 'player';
  player.inCar = car.id;
  player.angle = car.angle;
  state.audio.click();
}

function exitCar(state) {
  const player = state.player;
  const car = state.cars.find((c) => c.id === player.inCar);
  if (!car) { player.inCar = null; return; }
  car.speed = 0;
  const side = car.angle + Math.PI / 2;
  let px = car.x + Math.cos(side) * 34;
  let py = car.y + Math.sin(side) * 34;
  if (blockedAt(state.city, px, py, PLAYER.radius)) {
    px = car.x - Math.cos(side) * 34;
    py = car.y - Math.sin(side) * 34;
  }
  player.x = px;
  player.y = py;
  player.angle = car.angle;
  player.inCar = null;
  state.audio.click();
}

function fireBullet(state, fromX, fromY, angle, from, damage) {
  state.bullets.push({
    x: fromX + Math.cos(angle) * 18,
    y: fromY + Math.sin(angle) * 18,
    vx: Math.cos(angle) * PLAYER.bulletSpeed,
    vy: Math.sin(angle) * PLAYER.bulletSpeed,
    life: PLAYER.bulletRange / PLAYER.bulletSpeed,
    from,
    damage,
  });
  burst(state, fromX + Math.cos(angle) * 22, fromY + Math.sin(angle) * 22, '#ffd23f', 4, 120, 0.12, 3);
}

function playerShoot(state, aimAngle) {
  const player = state.player;
  if (player.ammo <= 0) {
    state.audio.denied();
    state.message = 'Out of ammo — find an ammo pickup.';
    state.messageT = 2;
    return;
  }
  player.ammo -= 1;
  player.aimAngle = aimAngle;
  const origin = player.inCar ? state.cars.find((c) => c.id === player.inCar) : player;
  fireBullet(state, origin.x, origin.y, aimAngle, 'player', PLAYER.pistolDamage);
  state.audio.gunshot();
  state.shake = Math.max(state.shake, 2);
  scarePeds(state, player.x, player.y, 260);
  // Firing where the police can see it — or where a witness might — draws heat.
  let policeNear = false;
  for (const car of state.cars) {
    if (car.driver !== 'police') continue;
    const dx = car.x - player.x;
    const dy = car.y - player.y;
    if (dx * dx + dy * dy < 600 * 600) { policeNear = true; break; }
  }
  if (policeNear || state.random.chance(0.25)) addWanted(state, WANTED.shoot);
}

function updatePlayer(state, dt, input) {
  const player = state.player;
  if (player.invuln > 0) player.invuln -= dt;
  if (state.fireCooldown > 0) state.fireCooldown -= dt;
  if (player.inCar) {
    const car = state.cars.find((c) => c.id === player.inCar);
    if (!car) { player.inCar = null; return; }
    const top = CAR.topSpeed[car.kind];
    const accel = CAR.accel[car.kind];
    if (input.my < 0) car.speed += accel * dt;
    else if (input.my > 0) car.speed -= accel * 0.9 * dt;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
    car.speed = Math.max(-top * 0.45, Math.min(top, car.speed));
    const steer = input.mx * CAR.turnRate * dt * Math.min(1, Math.abs(car.speed) / 90 + 0.25) * Math.sign(car.speed || 1);
    car.angle += steer;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!blockedAt(state.city, nx, ny, 20)) {
      car.x = nx;
      car.y = ny;
    } else {
      // A wall: scrape along it, lose speed, take a knock.
      if (!blockedAt(state.city, nx, car.y, 20)) car.x = nx;
      else if (!blockedAt(state.city, car.x, ny, 20)) car.y = ny;
      if (Math.abs(car.speed) > 120) {
        car.health -= 6;
        state.audio.crash();
        burst(state, car.x, car.y, '#c9c9c9', 6, 140, 0.4, 3);
        state.shake = Math.max(state.shake, 5);
      }
      car.speed *= -0.25;
    }
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    player.speed = car.speed;
    state.audio.engine(Math.abs(car.speed) / top);
    // Running a pedestrian over is a crime, and a messy one.
    for (const ped of state.peds) {
      if (ped.state === 'down' || ped.kind === 'cop' || ped.kind === 'viper') continue;
      const dx = ped.x - car.x;
      const dy = ped.y - car.y;
      if (dx * dx + dy * dy < 26 * 26 && Math.abs(car.speed) > 80) {
        ped.state = 'down';
        ped.downT = 4;
        addWanted(state, WANTED.hitPed);
        state.audio.crash();
        burst(state, ped.x, ped.y, '#ff6b6b', 8, 120, 0.5, 4);
      }
    }
    // Bumping other cars shoves them and dents both.
    for (const other of state.cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const d = Math.hypot(dx, dy);
      if (d < 40 && d > 0.01) {
        const push = (40 - d) * 0.5;
        other.x += (dx / d) * push;
        other.y += (dy / d) * push;
        car.speed *= 0.82;
        if (Math.abs(car.speed) > 100) {
          other.health -= 4;
          car.health -= 2;
          state.audio.crash();
        }
      }
    }
    if (car.health <= 0) state.carDestroyed = car;
  } else {
    const mx = input.mx;
    const my = input.my;
    const len = Math.hypot(mx, my);
    player.speed = 0;
    if (len > 0) {
      const speed = PLAYER.walkSpeed;
      const moved = moveCircle(state.city, player.x, player.y, (mx / len) * speed * dt, (my / len) * speed * dt, PLAYER.radius);
      player.x = moved.x;
      player.y = moved.y;
      player.speed = speed;
      if (!input.firing) player.angle = Math.atan2(my, mx);
    }
    if (input.firing) player.angle = input.aim;
    state.audio.engine(0);
  }
  if ((input.firing || input.shootPressed) && state.fireCooldown <= 0) {
    state.fireCooldown = 0.22;
    playerShoot(state, input.aim);
  }
}

function updateBullets(state, dt) {
  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.life <= 0) continue;
    if (blockedAt(state.city, bullet.x, bullet.y, 2)) {
      bullet.life = 0;
      burst(state, bullet.x, bullet.y, '#ffd23f', 3, 100, 0.2, 2);
      continue;
    }
    // Cars catch bullets.
    for (const car of state.cars) {
      if (bullet.life <= 0) break;
      const dx = car.x - bullet.x;
      const dy = car.y - bullet.y;
      if (dx * dx + dy * dy < 24 * 24) {
        bullet.life = 0;
        if (bullet.from === 'player') {
          car.health -= bullet.damage;
          burst(state, bullet.x, bullet.y, '#ffb347', 5, 130, 0.3, 3);
          if (car.health <= 0) {
            if (car.driver === 'player') state.carDestroyed = car;
            else {
              explosion(state, car.x, car.y);
              state.cars = state.cars.filter((c) => c !== car);
              addWanted(state, WANTED.destroyCar);
            }
          }
        }
      }
    }
    if (bullet.life <= 0) continue;
    // Pedestrians catch bullets.
    for (const ped of state.peds) {
      if (bullet.life <= 0 || ped.state === 'down') continue;
      const dx = ped.x - bullet.x;
      const dy = ped.y - bullet.y;
      if (dx * dx + dy * dy < 13 * 13) {
        bullet.life = 0;
        if (bullet.from === 'player') {
          ped.health -= bullet.damage;
          burst(state, bullet.x, bullet.y, '#ff6b6b', 5, 120, 0.3, 3);
          if (ped.health <= 0) {
            ped.state = 'down';
            ped.downT = 5;
            if (ped.kind === 'walker' || ped.kind === 'fare') addWanted(state, WANTED.killPed);
            if (ped.kind === 'cop') addWanted(state, WANTED.shootCop);
            if (ped.kind === 'viper') state.stats.kills += 1;
          }
        }
      }
    }
    if (bullet.life <= 0) continue;
    // Enemy bullets catch the player.
    if (bullet.from !== 'player' && !state.player.inCar) {
      const dx = state.player.x - bullet.x;
      const dy = state.player.y - bullet.y;
      if (dx * dx + dy * dy < 13 * 13) {
        bullet.life = 0;
        damagePlayer(state, bullet.damage);
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
}

function updatePickups(state, dt) {
  const player = state.player;
  for (const pickup of state.pickups) pickup.bob += dt * 3;
  for (const pickup of state.pickups) {
    const dx = pickup.x - player.x;
    const dy = pickup.y - player.y;
    if (dx * dx + dy * dy > 30 * 30) continue;
    if (pickup.missionCash) {
      state.pickups = state.pickups.filter((p) => p !== pickup);
      state.message = 'Cash recovered.';
      state.audio.cash();
      continue;
    }
    if (pickup.kind === 'cash') {
      player.money += pickup.amount;
      state.stats.earned += pickup.amount;
      state.audio.cash();
    } else if (pickup.kind === 'health') {
      player.health = Math.min(PLAYER.health, player.health + pickup.amount);
      state.audio.pickup();
    } else if (pickup.kind === 'ammo') {
      player.ammo = Math.min(PLAYER.maxAmmo, player.ammo + pickup.amount);
      state.audio.pickup();
    }
    state.pickups = state.pickups.filter((p) => p !== pickup);
  }
  state.pickupTimer -= dt;
  if (state.pickupTimer <= 0) {
    state.pickupTimer = 22;
    if (state.pickups.filter((p) => !p.missionCash).length < 14) {
      const kind = state.random.pick(['cash', 'cash', 'health', 'ammo']);
      const x = state.random.range(120, WORLD.width - 120);
      const y = state.random.range(120, WORLD.height - 120);
      if (!blockedAt(state.city, x, y, 10)) {
        state.pickups.push({
          x, y, kind,
          amount: kind === 'cash' ? state.random.int(25, 100) : kind === 'health' ? 30 : 24,
          missionCash: false,
          bob: 0,
        });
      }
    }
  }
}

function updateParticles(state, dt) {
  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);
  if (state.messageT > 0) state.messageT -= dt;
  if (state.wantedFlash > 0) state.wantedFlash -= dt;
}

function updateCamera(state) {
  const targetX = state.player.x - 640;
  const targetY = state.player.y - 360;
  state.camera.x += (targetX - state.camera.x) * 0.12;
  state.camera.y += (targetY - state.camera.y) * 0.12;
  state.camera.x = Math.max(0, Math.min(WORLD.width - 1280, state.camera.x));
  state.camera.y = Math.max(0, Math.min(WORLD.height - 720, state.camera.y));
}

/** One fixed step. `input` is { mx, my, aim, firing, shootPressed, enter }. */
export function stepWorld(state, dt, input) {
  state.time += dt;
  if (input.enter) {
    if (state.player.inCar) exitCar(state);
    else enterCar(state);
  }
  updatePlayer(state, dt, input);
  updateTraffic(state, dt);
  updatePeds(state, dt);
  updateVipers(state, dt);
  updatePolice(state, dt);
  updateWanted(state, dt);
  if (!input.attract) updateMission(state, dt);
  updateBullets(state, dt);
  updatePickups(state, dt);
  updateParticles(state, dt);
  spawnTraffic(state);
  spawnPeds(state);
  if (state.carDestroyed) {
    const car = state.carDestroyed;
    state.carDestroyed = null;
    explosion(state, car.x, car.y);
    state.cars = state.cars.filter((c) => c !== car);
    if (state.player.inCar === car.id) {
      state.player.inCar = null;
      damagePlayer(state, 25);
      state.player.invuln = 1.5;
    }
  }
  if (state.busted) {
    state.busted = false;
    respawn(state, 'busted');
  } else if (state.wasted) {
    state.wasted = false;
    respawn(state, 'wasted');
  }
  if (state.autosave) {
    state.autosave = false;
    saveGame(state);
  }
  updateCamera(state);
  return state;
}

/** The mission objective line and its map marker for the HUD. */
export function currentObjective(state) {
  return missionObjective(state);
}

export function saveGame(state) {
  try {
    const data = {
      money: state.player.money,
      health: state.player.health,
      ammo: state.player.ammo,
      missionIndex: state.missionIndex,
      missionsDone: state.stats.missions,
      earned: state.stats.earned,
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
      storyDone: state.storyDone,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    state.message = 'Progress saved.';
    state.messageT = 2;
    return true;
  } catch {
    state.message = 'Save failed — storage is off in this browser.';
    state.messageT = 3;
    return false;
  }
}

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.money !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function applySave(state, data) {
  state.player.money = data.money;
  state.player.health = data.health;
  state.player.ammo = data.ammo;
  state.player.x = data.x;
  state.player.y = data.y;
  state.player.inCar = null;
  state.missionIndex = Math.min(data.missionIndex || 0, 6);
  state.stats.missions = data.missionsDone || 0;
  state.stats.earned = data.earned || 0;
  state.storyDone = !!data.storyDone;
  state.mission.active = false;
  state.wanted = 0;
  state.message = 'Save loaded — welcome back to Neon Harbor.';
  state.messageT = 3;
}

export { STEP };
