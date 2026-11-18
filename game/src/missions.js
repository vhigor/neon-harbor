// The story of Neon Harbor and its six missions. Rook, a driver for hire,
// works for Mara Voss, a dockside fixer, and Dex Marlow, who runs a garage.
// Each mission is a list of stages — go somewhere, steal a car, survive
// the heat, clear out the Vipers, crack a vault — and the stage machine
// below walks the player through them.

import { MISSION } from './config.js';
import { landmarkPoint, blockedAt } from './city.js';

export const STORY = {
  hero: 'Rook',
  intro: 'Neon Harbor, 1986. The sun never sets on the docks, the money never sleeps, and everyone needs a driver. You are Rook — fast, quiet, for hire.',
  outro: 'The yacht slips out past the breakwater as the sirens fade behind you. Neon Harbor is yours now, Rook. King of the Harbor.',
};

const MISSIONS = [
  {
    name: 'First Fare',
    giver: 'Mara Voss',
    brief: 'Dex has a package for the marina. Take it there — fast.',
    reward: MISSION.reward[0],
    stages: [
      { type: 'goto', target: 'garage', text: 'Pick up the package at Dex’s Garage', radius: 70 },
      { type: 'timed', target: 'marina', time: 100, text: 'Deliver the package to Sunset Marina', radius: 70 },
    ],
  },
  {
    name: 'Hot Wheels',
    giver: 'Dex Marlow',
    brief: 'A Comet GT is parked at Palm Court. Bring it to my garage. Quietly.',
    reward: MISSION.reward[1],
    stages: [
      { type: 'enter-car', target: 'palmCourt', text: 'Steal the Comet GT at Palm Court', radius: 90 },
      { type: 'goto', target: 'garage', text: 'Deliver the Comet GT to Dex’s Garage', radius: 70 },
    ],
  },
  {
    name: 'Getaway',
    giver: 'Mara Voss',
    brief: 'Pick me up at Dock 9. The harbor police are already on their way.',
    reward: MISSION.reward[2],
    stages: [
      { type: 'goto', target: 'dock9', text: 'Pick up Mara at Dock 9', radius: 70 },
      { type: 'survive', time: 45, text: 'Lose the heat — survive 45 seconds', wanted: 2 },
      { type: 'goto', target: 'safehouse', text: 'Reach the Safehouse', radius: 70 },
    ],
  },
  {
    name: 'Dockside Deal',
    giver: 'Mara Voss',
    brief: 'The Vipers took our cash at Dock 9. Take it back.',
    reward: MISSION.reward[3],
    stages: [
      { type: 'goto', target: 'dock9', text: 'Reach Dock 9', radius: 90 },
      { type: 'eliminate', count: 5, target: 'dock9', text: 'Clear out the Vipers', radius: 420 },
      { type: 'collect', count: 1, target: 'dock9', text: 'Grab the cash', radius: 90 },
    ],
  },
  {
    name: 'The Meridian Job',
    giver: 'Dex Marlow',
    brief: 'The Meridian vault holds a fortune. Crack it, grab it, run.',
    reward: MISSION.reward[4],
    stages: [
      { type: 'goto', target: 'casino', text: 'Reach the Meridian Casino', radius: 90 },
      { type: 'hold', time: 12, target: 'casino', text: 'Crack the vault — stay in the zone', radius: 85 },
      { type: 'goto', target: 'safehouse', text: 'Escape to the Safehouse', radius: 70, wanted: 4 },
    ],
  },
  {
    name: 'King of the Harbor',
    giver: 'Mara Voss',
    brief: 'The loot goes to my yacht. Every cop in the city will be looking.',
    reward: MISSION.reward[5],
    stages: [
      { type: 'goto', target: 'yacht', text: 'Deliver the loot to Mara’s Yacht', radius: 70, wanted: 5 },
    ],
  },
];

export function missionCount() {
  return MISSIONS.length;
}

export function missionInfo(index) {
  return MISSIONS[index] || null;
}

/** The point a stage points at, from the city's landmarks (a building's door, not its walled centre). */
function targetPoint(state, target) {
  const mark = state.city.landmarks[target];
  return mark ? landmarkPoint(mark) : null;
}

/** A point near (x, y) that is not inside a building or water. */
function openPoint(state, x, y, minDist, maxDist) {
  for (let i = 0; i < 10; i += 1) {
    const angle = state.random.range(0, Math.PI * 2);
    const dist = state.random.range(minDist, maxDist);
    const px = x + Math.cos(angle) * dist;
    const py = y + Math.sin(angle) * dist;
    if (!blockedAt(state.city, px, py, 12)) return { x: px, y: py };
  }
  return { x, y };
}

export function spawnViper(state, x, y) {
  const ped = {
    x, y,
    angle: state.random.range(0, Math.PI * 2),
    speed: 120,
    color: '#7d3cff',
    kind: 'viper',
    health: 100,
    state: 'walk',
    fleeT: 0,
    downT: 0,
    axis: 'h',
    dir: 1,
    waitT: 0,
    fareDest: null,
    fareTimer: 0,
    shootT: state.random.range(0.4, 1.2),
    counted: false,
  };
  state.peds.push(ped);
  return ped;
}

function enterStage(state, stage) {
  const mission = state.mission;
  mission.holdProgress = 0;
  mission.kills = 0;
  if (stage.wanted !== undefined) {
    state.wanted = Math.max(state.wanted, stage.wanted);
    state.quietTime = 0;
  }
  if (stage.type === 'eliminate') {
    const point = targetPoint(state, stage.target);
    for (let i = 0; i < stage.count; i += 1) {
      const at = openPoint(state, point.x, point.y, 40, 170);
      spawnViper(state, at.x, at.y);
    }
  }
  if (stage.type === 'collect') {
    // The cash sits on the pier itself: a random offset could drop it in the water.
    const point = targetPoint(state, stage.target);
    state.pickups.push({
      x: point.x,
      y: point.y,
      kind: 'cash',
      amount: 0,
      missionCash: true,
      bob: 0,
    });
  }
  if (stage.type === 'hold') {
    const point = targetPoint(state, stage.target);
    for (let i = 0; i < 3; i += 1) {
      const at = openPoint(state, point.x, point.y, 80, 160);
      spawnViper(state, at.x, at.y);
    }
  }
}

export function startMission(state, index) {
  const info = MISSIONS[index];
  if (!info) return;
  state.mission = {
    index,
    info,
    stage: 0,
    timer: 0,
    active: true,
    failed: false,
    holdProgress: 0,
    kills: 0,
  };
  const stage = info.stages[0];
  if (stage.time) state.mission.timer = stage.time;
  state.message = `${info.name} — ${info.brief}`;
  state.audio.click();
  enterStage(state, stage);
}

/** Where the next mission starts (its first stage's target), or null. */
export function nextMissionStart(state) {
  if (state.mission.active || state.storyDone) return null;
  const info = MISSIONS[state.missionIndex];
  if (!info) return null;
  const stage = info.stages[0];
  const point = targetPoint(state, stage.target);
  return point ? { x: point.x, y: point.y, name: info.name, giver: info.giver } : null;
}

/** The current objective text and marker, or the next mission's start. */
export function missionObjective(state) {
  if (state.storyDone) return { text: 'Neon Harbor is yours. Free roam — fares, cash and chaos.', point: null };
  if (!state.mission.active) {
    const start = nextMissionStart(state);
    if (start) return { text: `Next job: ${start.name} — reach the M marker`, point: start };
    return { text: '', point: null };
  }
  const stage = state.mission.info.stages[state.mission.stage];
  const point = stage.target ? targetPoint(state, stage.target) : null;
  let text = stage.text;
  if (stage.type === 'eliminate') text = `${stage.text} (${state.mission.kills}/${stage.count})`;
  if (stage.type === 'hold') text = `${stage.text} (${Math.ceil(stage.time - state.mission.holdProgress)}s)`;
  if (stage.type === 'survive' || stage.type === 'timed') text = `${stage.text} — ${Math.ceil(state.mission.timer)}s`;
  return { text, point };
}

export function failMission(state, reason) {
  if (!state.mission.active) return;
  state.mission.active = false;
  state.mission.failed = true;
  state.message = `Mission failed — ${reason}. Return to the M marker to retry.`;
  state.audio.missionFail();
  // The story's armed men stand down when the job falls apart.
  state.peds = state.peds.filter((p) => p.kind !== 'viper');
}

function completeMission(state) {
  const mission = state.mission;
  const reward = mission.info.reward;
  state.player.money += reward;
  state.stats.earned += reward;
  state.stats.missions += 1;
  state.message = `${mission.info.name} complete! +$${reward}.`;
  state.audio.missionDone();
  state.missionIndex += 1;
  state.mission.active = false;
  state.mission.failed = false;
  if (state.missionIndex >= MISSIONS.length) {
    state.storyDone = true;
    state.endScreen = 'complete';
    state.message = STORY.outro;
  }
  state.autosave = true;
}

function advanceStage(state) {
  const mission = state.mission;
  mission.stage += 1;
  if (mission.stage >= mission.info.stages.length) {
    completeMission(state);
    return;
  }
  const stage = mission.info.stages[mission.stage];
  if (stage.time) mission.timer = stage.time;
  enterStage(state, stage);
}

function nearPoint(state, point, radius) {
  if (!point) return false;
  const dx = state.player.x - point.x;
  const dy = state.player.y - point.y;
  return dx * dx + dy * dy < radius * radius;
}

export function updateMission(state, dt) {
  if (!state.mission.active) {
    // Standing on the next job's marker starts it.
    const start = nextMissionStart(state);
    if (start && nearPoint(state, start, 60)) startMission(state, state.missionIndex);
    return;
  }
  const mission = state.mission;
  const stage = mission.info.stages[mission.stage];
  if (!stage) return;
  switch (stage.type) {
    case 'goto': {
      const point = targetPoint(state, stage.target);
      if (nearPoint(state, point, stage.radius)) advanceStage(state);
      break;
    }
    case 'timed': {
      mission.timer -= dt;
      const point = targetPoint(state, stage.target);
      if (nearPoint(state, point, stage.radius)) advanceStage(state);
      else if (mission.timer <= 0) failMission(state, 'out of time');
      break;
    }
    case 'enter-car': {
      const target = state.cars.find((c) => c.isTarget);
      if (target && state.player.inCar === target.id) advanceStage(state);
      break;
    }
    case 'survive': {
      mission.timer -= dt;
      if (mission.timer <= 0) advanceStage(state);
      break;
    }
    case 'eliminate': {
      mission.kills = state.peds.filter((p) => p.kind === 'viper' && p.state === 'down').length;
      if (mission.kills >= stage.count) advanceStage(state);
      break;
    }
    case 'collect': {
      const left = state.pickups.filter((p) => p.missionCash).length;
      if (left === 0) advanceStage(state);
      break;
    }
    case 'hold': {
      const point = targetPoint(state, stage.target);
      if (nearPoint(state, point, stage.radius)) {
        mission.holdProgress += dt;
        if (mission.holdProgress >= stage.time) advanceStage(state);
      }
      break;
    }
    default:
      break;
  }
}

/** The Vipers hunt the player: close in and shoot when they have a line. */
export function updateVipers(state, dt) {
  const player = state.player;
  for (const viper of state.peds) {
    if (viper.kind !== 'viper' || viper.state === 'down') continue;
    const dx = player.x - viper.x;
    const dy = player.y - viper.y;
    const dist = Math.hypot(dx, dy);
    viper.angle = Math.atan2(dy, dx);
    if (dist > 60) {
      viper.x += Math.cos(viper.angle) * viper.speed * dt;
      viper.y += Math.sin(viper.angle) * viper.speed * dt;
    }
    if (dist < 380 && dist > 30) {
      viper.shootT -= dt;
      if (viper.shootT <= 0) {
        viper.shootT = state.random.range(1.1, 1.8);
        const aim = viper.angle + state.random.range(-0.12, 0.12);
        state.bullets.push({
          x: viper.x + Math.cos(aim) * 16,
          y: viper.y + Math.sin(aim) * 16,
          vx: Math.cos(aim) * 640,
          vy: Math.sin(aim) * 640,
          life: 0.9,
          from: 'viper',
          damage: 8,
        });
        state.audio.enemyShot();
      }
    }
  }
}
