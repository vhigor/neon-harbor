// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between title, play,
// paused, busted/wasted and story-complete screens.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|heist (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createGame, resetGame, stepWorld, saveGame, readSave, applySave, currentObjective } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_SHOOT, ACTION_SAVE, ACTION_RESTART, ACTION_MUTE, ACTION_QUIT, ACTION_LOAD, createInput } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_END, SCREEN_COMPLETE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const state = createGame(createRandom(seed), audio);
const renderer = createRenderer(canvas);

function extraInfo() {
  return {
    missionsDone: state.stats.missions,
    earned: state.stats.earned,
    fares: state.stats.fares,
    hasSave: !!readSave(),
    endKind: state.endScreen,
  };
}

function runShot(name) {
  const scene = stageShot(name, state);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, currentObjective(state), scene.extra);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let muted = false;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startNew() {
    audio.ensure();
    resetGame(state);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Neon Harbor. Reach the M marker for your first job.');
  }

  function startLoaded() {
    const save = readSave();
    if (!save) return;
    audio.ensure();
    resetGame(state);
    applySave(state, save);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Save loaded. Welcome back to Neon Harbor.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = !muted;
      audio.setMuted(muted);
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startNew();
      else if (actions & ACTION_LOAD) startLoaded();
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (actions & ACTION_RESTART) {
        resetGame(state);
        announce('Story restarted.');
      } else if (actions & ACTION_SAVE) {
        saveGame(state);
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & ACTION_PAUSE || actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (actions & ACTION_SAVE) {
        saveGame(state);
      } else if (actions & ACTION_RESTART) {
        resetGame(state);
        screen = SCREEN_PLAY;
        announce('Story restarted.');
      } else if (actions & ACTION_QUIT) {
        screen = SCREEN_TITLE;
        announce('Neon Harbor. Press Enter to start.');
      }
    } else if (screen === SCREEN_END || screen === SCREEN_COMPLETE) {
      if (actions & ACTION_CONFIRM) {
        state.endScreen = null;
        screen = SCREEN_PLAY;
        announce('Back on the streets.');
      }
    }
    return actions;
  }

  function stepGame(actions) {
    const mouse = input.mouse();
    const aimPoint = renderer.worldPoint(mouse.x, mouse.y, state);
    const aim = Math.atan2(aimPoint.y - state.player.y, aimPoint.x - state.player.x);
    const playInput = {
      mx: input.moveX(),
      my: input.moveY(),
      aim,
      firing: input.firing() || input.spaceHeld(),
      shootPressed: !!(actions & ACTION_SHOOT),
      enter: !!(actions & ACTION_ENTER),
      attract: false,
    };
    stepWorld(state, STEP, playInput);
    if (state.endScreen === 'complete') screen = SCREEN_COMPLETE;
    else if (state.endScreen === 'busted' || state.endScreen === 'wasted') screen = SCREEN_END;
  }

  function stepTitle() {
    // The city stays alive behind the title panel; nothing starts.
    stepWorld(state, STEP, { mx: 0, my: 0, aim: 0, firing: false, shootPressed: false, enter: false, attract: true });
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        stepTitle();
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        stepGame(actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(state, screen, currentObjective(state), extraInfo());
  }

  // A testing handle, only when the page is opened with ?debug=1: the
  // playtest drives the game through real keys and reads the state back.
  if (params.get('debug') === '1') window.__neonHarbor = { state, getScreen: () => screen };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // The first gesture unlocks audio.
  window.addEventListener('pointerdown', () => audio.ensure(), { once: true });
  window.addEventListener('keydown', () => audio.ensure(), { once: true });

  announce('Neon Harbor. Press Enter to start, L to continue a save.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
