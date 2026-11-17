// Drawing only: the world's state and the current screen in, pixels out.
// The camera shows a 1280x720 window of the city, scaled to fit the
// browser; the HUD and the minimap are drawn in screen space on top.

import { WORLD, ROAD, VIEW, FONT, PALETTE, PLAYER, WANTED } from './config.js';
import { STORY } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_END = 'end';
export const SCREEN_COMPLETE = 'complete';

const MINIMAP = { x: VIEW.width - 224, y: VIEW.height - 174, w: 204, h: 154 };

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
    view.ratio = ratio;
  }

  /** A mouse position in CSS pixels, converted to world coordinates. */
  function worldPoint(sx, sy, state) {
    const deviceX = sx * (view.ratio || 1);
    const deviceY = sy * (view.ratio || 1);
    return {
      x: state.camera.x + (deviceX - view.x) / view.scale,
      y: state.camera.y + (deviceY - view.y) / view.scale,
    };
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function panel(x, y, w, h) {
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, w, h);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    context.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function drawGround(state) {
    const city = state.city;
    const cam = state.camera;
    // Grass base.
    context.fillStyle = PALETTE.grass;
    context.fillRect(cam.x - 20, cam.y - 20, VIEW.width + 40, VIEW.height + 40);
    // Beach sand, then the sea.
    context.fillStyle = PALETTE.sand;
    context.fillRect(cam.x - 20, ROAD.beachY, VIEW.width + 40, ROAD.seaY - ROAD.beachY);
    context.fillStyle = PALETTE.waterDeep;
    context.fillRect(cam.x - 20, ROAD.seaY, VIEW.width + 40, WORLD.height - ROAD.seaY);
    context.fillStyle = PALETTE.water;
    context.fillRect(ROAD.waterX, cam.y - 20, WORLD.width - ROAD.waterX, ROAD.beachY - cam.y + 20);
    // Water shimmer lines.
    context.strokeStyle = 'rgba(255,255,255,0.18)';
    context.lineWidth = 2;
    const t = state.time;
    for (let i = 0; i < 6; i += 1) {
      const y = ROAD.seaY + 18 + i * 16;
      context.beginPath();
      context.moveTo(cam.x + ((i * 173 + t * 12) % 260), y);
      context.lineTo(cam.x + ((i * 173 + t * 12) % 260) + 90, y);
      context.stroke();
    }
    // Parks.
    for (const park of city.parks) {
      if (park.x > cam.x + VIEW.width || park.x + park.w < cam.x || park.y > cam.y + VIEW.height || park.y + park.h < cam.y) continue;
      context.fillStyle = park.plaza ? '#cbb89a' : PALETTE.park;
      context.fillRect(park.x, park.y, park.w, park.h);
      for (const tree of park.trees) {
        context.fillStyle = PALETTE.tree;
        context.beginPath();
        context.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = PALETTE.treeLight;
        context.beginPath();
        context.arc(tree.x - 3, tree.y - 3, tree.r * 0.55, 0, Math.PI * 2);
        context.fill();
      }
    }
    // Parking lots.
    for (const lot of city.lots) {
      if (lot.x > cam.x + VIEW.width || lot.x + lot.w < cam.x || lot.y > cam.y + VIEW.height || lot.y + lot.h < cam.y) continue;
      context.fillStyle = PALETTE.asphaltDark;
      context.fillRect(lot.x, lot.y, lot.w, lot.h);
      context.strokeStyle = 'rgba(255,255,255,0.25)';
      context.lineWidth = 2;
      for (let x = lot.x + 30; x < lot.x + lot.w - 20; x += 56) {
        context.beginPath();
        context.moveTo(x, lot.y + 8);
        context.lineTo(x, lot.y + 30);
        context.stroke();
      }
    }
    // Roads: sidewalk edge, asphalt, centre dashes.
    for (const avenue of ROAD.avenues) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(avenue - ROAD.width / 2 - 10, 0, ROAD.width + 20, ROAD.beachY);
      context.fillStyle = PALETTE.asphalt;
      context.fillRect(avenue - ROAD.width / 2, 0, ROAD.width, ROAD.beachY);
    }
    for (const street of ROAD.streets) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(0, street - ROAD.width / 2 - 10, ROAD.waterX, ROAD.width + 20);
      context.fillStyle = PALETTE.asphalt;
      context.fillRect(0, street - ROAD.width / 2, ROAD.waterX, ROAD.width);
    }
    context.strokeStyle = PALETTE.lane;
    context.lineWidth = 3;
    context.setLineDash([26, 30]);
    for (const avenue of ROAD.avenues) {
      context.beginPath();
      context.moveTo(avenue, 0);
      context.lineTo(avenue, ROAD.beachY);
      context.stroke();
    }
    for (const street of ROAD.streets) {
      context.beginPath();
      context.moveTo(0, street);
      context.lineTo(ROAD.waterX, street);
      context.stroke();
    }
    context.setLineDash([]);
    // Piers into the harbour and the sea.
    context.fillStyle = '#8a6b46';
    for (const pier of city.piers) context.fillRect(pier.x, pier.y, pier.w, pier.h);
    context.fillRect(city.marinaPier.x, city.marinaPier.y, city.marinaPier.w, city.marinaPier.h);
    context.fillRect(city.yachtPier.x, city.yachtPier.y, city.yachtPier.w, city.yachtPier.h);
    context.strokeStyle = '#6b4f30';
    context.lineWidth = 2;
    for (const pier of city.piers) {
      for (let x = pier.x + 20; x < pier.x + pier.w; x += 30) {
        context.beginPath();
        context.moveTo(x, pier.y);
        context.lineTo(x, pier.y + pier.h);
        context.stroke();
      }
    }
    // Buildings, with a roof, a shaded edge and a rooftop box or two.
    for (const b of city.buildings) {
      if (b.x > cam.x + VIEW.width || b.x + b.w < cam.x || b.y > cam.y + VIEW.height || b.y + b.h < cam.y) continue;
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.strokeStyle = PALETTE.buildingEdge;
      context.lineWidth = 2;
      context.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      context.fillStyle = 'rgba(255,255,255,0.20)';
      context.fillRect(b.x + 10, b.y + 10, Math.min(26, b.w - 20), Math.min(18, b.h - 20));
      context.fillStyle = 'rgba(0,0,0,0.18)';
      context.fillRect(b.x + b.w - 30, b.y + b.h - 26, 20, 16);
      if (b.name) {
        text(b.name, b.x + b.w / 2, b.y + b.h / 2, 15, 'rgba(255,255,255,0.9)', 'center', 'middle');
      }
    }
    // The yacht at the end of its pier.
    const yacht = city.landmarks.yacht;
    context.save();
    context.translate(yacht.x, yacht.y);
    context.fillStyle = '#f5f0e6';
    context.beginPath();
    context.ellipse(0, 0, 46, 16, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#2e86ab';
    context.fillRect(-24, -8, 48, 8);
    context.restore();
  }

  function drawMarker(state, point, label, color, pulse) {
    const x = point.x;
    const y = point.y;
    const r = 26 + (pulse ? Math.sin(state.time * 4) * 5 : 0);
    context.strokeStyle = color;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = color;
    context.globalAlpha = 0.25;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    text(label, x, y, 20, color, 'center', 'middle');
    // A light column so the marker reads from far away.
    context.fillStyle = color;
    context.globalAlpha = 0.10;
    context.fillRect(x - 3, y - 220, 6, 220);
    context.globalAlpha = 1;
  }

  function drawPickups(state) {
    for (const pickup of state.pickups) {
      const bob = Math.sin(pickup.bob) * 3;
      const y = pickup.y + bob;
      if (pickup.missionCash) {
        context.fillStyle = PALETTE.cash;
        context.beginPath();
        context.arc(pickup.x, y, 16, 0, Math.PI * 2);
        context.fill();
        text('$', pickup.x, y, 20, '#0b3d1e', 'center', 'middle');
        continue;
      }
      if (pickup.kind === 'cash') {
        context.fillStyle = PALETTE.cash;
        context.fillRect(pickup.x - 9, y - 6, 18, 12);
        text('$', pickup.x, y, 13, '#0b3d1e', 'center', 'middle');
      } else if (pickup.kind === 'health') {
        context.fillStyle = PALETTE.health;
        context.fillRect(pickup.x - 9, y - 9, 18, 18);
        context.fillStyle = '#ffffff';
        context.fillRect(pickup.x - 2, y - 6, 4, 12);
        context.fillRect(pickup.x - 6, y - 2, 12, 4);
      } else {
        context.fillStyle = PALETTE.ammo;
        context.fillRect(pickup.x - 9, y - 6, 18, 12);
        text('• • •', pickup.x, y, 10, '#3a2f00', 'center', 'middle');
      }
    }
  }

  function drawCar(car, state) {
    const flashing = car.driver === 'police' && Math.floor(state.time * 4) % 2 === 0;
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    // Wheels.
    context.fillStyle = '#111111';
    context.fillRect(-14, -13, 10, 5);
    context.fillRect(-14, 8, 10, 5);
    context.fillRect(8, -13, 10, 5);
    context.fillRect(8, 8, 10, 5);
    // Body.
    context.fillStyle = car.color;
    context.beginPath();
    context.roundRect(-23, -11, 46, 22, 6);
    context.fill();
    // Windshield and roof.
    context.fillStyle = 'rgba(20, 30, 50, 0.85)';
    context.fillRect(6, -9, 8, 18);
    context.fillStyle = 'rgba(255,255,255,0.25)';
    context.fillRect(-8, -8, 12, 16);
    if (car.kind === 'taxi') {
      context.fillStyle = '#111111';
      context.fillRect(-2, -11, 4, 22);
    }
    if (car.kind === 'truck') {
      context.fillStyle = '#8a8f96';
      context.fillRect(-23, -10, 14, 20);
    }
    // Headlights.
    context.fillStyle = '#ffe9a8';
    context.fillRect(21, -8, 3, 4);
    context.fillRect(21, 4, 3, 4);
    // Police light bar, flashing red and blue.
    if (car.driver === 'police') {
      context.fillStyle = flashing ? '#ff2d2d' : '#2b4acb';
      context.fillRect(-4, -11, 8, 5);
      context.fillStyle = flashing ? '#2b4acb' : '#ff2d2d';
      context.fillRect(-4, 6, 8, 5);
    }
    // Health smoke when wrecked.
    if (car.health < car.maxHealth * 0.35) {
      context.fillStyle = 'rgba(60,60,60,0.5)';
      context.beginPath();
      context.arc(-10 + Math.sin(state.time * 9) * 3, -6, 6, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    if (car.isTarget) {
      context.strokeStyle = PALETTE.marker;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(car.x, car.y, 34 + Math.sin(state.time * 4) * 3, 0, Math.PI * 2);
      context.stroke();
      text('★', car.x, car.y - 40, 18, PALETTE.marker, 'center', 'middle');
    }
  }

  function drawPed(ped, state) {
    if (ped.state === 'down') {
      context.fillStyle = ped.color;
      context.globalAlpha = 0.75;
      context.beginPath();
      context.ellipse(ped.x, ped.y, 12, 6, ped.angle, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
      return;
    }
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath();
    context.ellipse(ped.x, ped.y + 8, 9, 4, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = ped.color;
    context.beginPath();
    context.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
    context.fill();
    // A facing tick and, for armed men, a gun.
    context.strokeStyle = 'rgba(0,0,0,0.45)';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(ped.x, ped.y);
    context.lineTo(ped.x + Math.cos(ped.angle) * 12, ped.y + Math.sin(ped.angle) * 12);
    context.stroke();
    if (ped.kind === 'viper' || ped.kind === 'cop') {
      context.fillStyle = '#222222';
      context.fillRect(ped.x + Math.cos(ped.angle) * 10 - 2, ped.y + Math.sin(ped.angle) * 10 - 2, 8, 4);
    }
    if (ped.kind === 'cop') {
      context.fillStyle = PALETTE.police;
      context.beginPath();
      context.arc(ped.x, ped.y - 3, 7, Math.PI, 0);
      context.fill();
    }
    if (ped.kind === 'fare') {
      text('$', ped.x, ped.y - 18, 16, '#7ee081', 'center', 'middle');
    }
    if (ped.kind === 'viper') {
      text('!', ped.x, ped.y - 18, 15, '#ff4d4d', 'center', 'middle');
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    if (player.inCar) return;
    if (player.invuln > 0 && Math.floor(player.invuln * 10) % 2 === 0) return;
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath();
    context.ellipse(player.x, player.y + 9, 10, 4, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(player.x, player.y, PLAYER.radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.playerDark;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(player.x, player.y, PLAYER.radius, 0, Math.PI * 2);
    context.stroke();
    // The pistol points where the player aims.
    context.strokeStyle = '#222222';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(player.x, player.y);
    context.lineTo(player.x + Math.cos(player.angle) * 16, player.y + Math.sin(player.angle) * 16);
    context.stroke();
  }

  function drawWorld(state, objective) {
    const cam = state.camera;
    const shakeX = state.shake > 0 ? (Math.random() * 2 - 1) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() * 2 - 1) * state.shake : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x - (cam.x + shakeX) * view.scale, view.y - (cam.y + shakeY) * view.scale);
    drawGround(state);
    drawPickups(state);
    // Mission and fare markers under the actors.
    if (objective.point) {
      const color = state.mission.active ? PALETTE.marker : '#7ee081';
      drawMarker(state, objective.point, state.mission.active ? '◆' : 'M', color, true);
    }
    if (state.fare && state.fare.pickedUp) {
      drawMarker(state, state.fare.dest, '$', '#7ee081', true);
    }
    const inView = (x, y) => x > cam.x - 60 && x < cam.x + VIEW.width + 60 && y > cam.y - 60 && y < cam.y + VIEW.height + 60;
    for (const car of state.cars) {
      if (inView(car.x, car.y)) drawCar(car, state);
    }
    for (const ped of state.peds) {
      if (ped.state === 'riding') continue;
      if (inView(ped.x, ped.y)) drawPed(ped, state);
    }
    drawPlayer(state);
    // Bullets.
    context.strokeStyle = '#ffe66d';
    context.lineWidth = 3;
    for (const bullet of state.bullets) {
      context.beginPath();
      context.moveTo(bullet.x - bullet.vx * 0.012, bullet.y - bullet.vy * 0.012);
      context.lineTo(bullet.x, bullet.y);
      context.stroke();
    }
    // Particles.
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawStars(state) {
    const x0 = VIEW.width - 24 - WANTED.max * 30;
    for (let i = 0; i < WANTED.max; i += 1) {
      const filled = i < state.wanted;
      const flash = state.wantedFlash > 0 && Math.floor(state.wantedFlash * 6) % 2 === 0;
      text('★', x0 + i * 30, 44, 30, filled ? (flash ? '#ffffff' : PALETTE.star) : PALETTE.starEmpty, 'left', 'top');
    }
  }

  function drawMinimap(state, objective) {
    const { x, y, w, h } = MINIMAP;
    const sx = w / WORLD.width;
    const sy = h / WORLD.height;
    panel(x - 6, y - 6, w + 12, h + 12);
    context.fillStyle = '#12233d';
    context.fillRect(x, y, w, h);
    // Land and water.
    context.fillStyle = '#2c4632';
    context.fillRect(x, y, ROAD.waterX * sx, ROAD.beachY * sy);
    context.fillStyle = '#c9a86a';
    context.fillRect(x, y + ROAD.beachY * sy, ROAD.waterX * sx, (ROAD.seaY - ROAD.beachY) * sy);
    // Roads.
    context.strokeStyle = 'rgba(255,255,255,0.45)';
    context.lineWidth = 1.5;
    for (const avenue of ROAD.avenues) {
      context.beginPath();
      context.moveTo(x + avenue * sx, y);
      context.lineTo(x + avenue * sx, y + ROAD.beachY * sy);
      context.stroke();
    }
    for (const street of ROAD.streets) {
      context.beginPath();
      context.moveTo(x, y + street * sy);
      context.lineTo(x + ROAD.waterX * sx, y + street * sy);
      context.stroke();
    }
    // Cars, police and the fare destination.
    context.fillStyle = 'rgba(255,255,255,0.55)';
    for (const car of state.cars) {
      if (car.driver === 'police') continue;
      context.fillRect(x + car.x * sx - 1, y + car.y * sy - 1, 2, 2);
    }
    for (const car of state.cars) {
      if (car.driver !== 'police') continue;
      context.fillStyle = '#ff4d4d';
      context.fillRect(x + car.x * sx - 2, y + car.y * sy - 2, 4, 4);
    }
    for (const ped of state.peds) {
      if (ped.kind !== 'cop') continue;
      context.fillStyle = '#ff4d4d';
      context.fillRect(x + ped.x * sx - 2, y + ped.y * sy - 2, 4, 4);
    }
    if (objective.point) {
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.arc(x + objective.point.x * sx, y + objective.point.y * sy, 5, 0, Math.PI * 2);
      context.fill();
    }
    if (state.fare && state.fare.pickedUp) {
      context.fillStyle = '#7ee081';
      context.beginPath();
      context.arc(x + state.fare.dest.x * sx, y + state.fare.dest.y * sy, 4, 0, Math.PI * 2);
      context.fill();
    }
    // The player, a white arrow.
    const px = x + state.player.x * sx;
    const py = y + state.player.y * sy;
    context.save();
    context.translate(px, py);
    context.rotate(state.player.angle);
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.moveTo(7, 0);
    context.lineTo(-5, -5);
    context.lineTo(-5, 5);
    context.closePath();
    context.fill();
    context.restore();
    text('NEON HARBOR', x, y - 10, 12, PALETTE.muted, 'left', 'alphabetic');
  }

  function drawHud(state, objective, screen) {
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // Top-left: health, money, ammo, car health.
    panel(16, 16, 250, 108);
    text('ROOK', 28, 38, 15, PALETTE.muted, 'left', 'top');
    context.fillStyle = '#3a1d1d';
    context.fillRect(28, 48, 150, 14);
    context.fillStyle = state.player.health > 30 ? '#7ee081' : '#ff4d4d';
    context.fillRect(28, 48, 150 * clamp(state.player.health / 100, 0, 1), 14);
    text(`${Math.ceil(state.player.health)}`, 186, 62, 14, PALETTE.text, 'left', 'top');
    text(`$${state.player.money}`, 28, 74, 22, PALETTE.cash, 'left', 'top');
    text(`AMMO ${state.player.ammo}`, 150, 78, 15, PALETTE.ammo, 'left', 'top');
    const car = state.player.inCar ? state.cars.find((c) => c.id === state.player.inCar) : null;
    if (car) {
      text(`CAR ${Math.max(0, Math.ceil(car.health))}`, 28, 104, 15, '#9ecfff', 'left', 'top');
      text(`${Math.round(Math.abs(car.speed) * 0.36)} km/h`, 150, 104, 15, PALETTE.text, 'left', 'top');
    } else {
      text('ON FOOT', 28, 104, 15, PALETTE.muted, 'left', 'top');
    }
    drawStars(state);
    // Mission line, top centre.
    if (objective.text) {
      const width = Math.min(760, 40 + objective.text.length * 9);
      panel((VIEW.width - width) / 2, 16, width, 40);
      text(objective.text, VIEW.width / 2, 42, 18, PALETTE.text, 'center', 'middle');
    }
    // Hold-progress bar under the mission line.
    if (state.mission.active) {
      const stage = state.mission.info.stages[state.mission.stage];
      if (stage && stage.type === 'hold') {
        const frac = clamp(state.mission.holdProgress / stage.time, 0, 1);
        context.fillStyle = '#3a1d1d';
        context.fillRect((VIEW.width - 300) / 2, 64, 300, 10);
        context.fillStyle = PALETTE.marker;
        context.fillRect((VIEW.width - 300) / 2, 64, 300 * frac, 10);
      }
      if (stage && (stage.type === 'timed' || stage.type === 'survive')) {
        const frac = clamp(state.mission.timer / (stage.time || 1), 0, 1);
        context.fillStyle = '#3a1d1d';
        context.fillRect((VIEW.width - 300) / 2, 64, 300, 10);
        context.fillStyle = frac > 0.3 ? '#7ee081' : '#ff4d4d';
        context.fillRect((VIEW.width - 300) / 2, 64, 300 * frac, 10);
      }
    }
    // Context hint, bottom-left (in play only — the overlays have their own text).
    if (screen === SCREEN_PLAY) {
      let hint = 'WASD move · SPACE shoot · E enter car · P pause';
      if (state.player.inCar) hint = 'WASD drive · SPACE drive-by · E exit car · P pause';
      context.fillStyle = 'rgba(8, 10, 20, 0.55)';
      context.fillRect(8, VIEW.height - 38, 16 + hint.length * 8.2, 28);
      text(hint, 16, VIEW.height - 18, 15, 'rgba(255,248,231,0.9)', 'left', 'alphabetic');
    }
    // Toast message (in play only).
    if (screen === SCREEN_PLAY && state.messageT > 0 && state.message) {
      const width = Math.min(900, 40 + state.message.length * 8.5);
      panel((VIEW.width - width) / 2, VIEW.height - 64, width, 36);
      text(state.message, VIEW.width / 2, VIEW.height - 46, 17, PALETTE.text, 'center', 'middle');
    }
    drawMinimap(state, objective);
  }

  function drawPanelBox(title, lines, prompt, accent) {
    const width = 680;
    const lineHeight = 30;
    const height = 150 + lines.length * lineHeight + 60;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    panel(x, y, width, height);
    text(title, VIEW.width / 2, y + 74, 52, accent || PALETTE.text, 'center', 'alphabetic');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, y + 130 + i * lineHeight, 19, PALETTE.muted, 'center', 'alphabetic');
    }
    text(prompt, VIEW.width / 2, y + height - 34, 21, PALETTE.marker, 'center', 'alphabetic');
  }

  function draw(state, screen, objective, extra) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0b0e18';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawWorld(state, objective);
    drawHud(state, objective, screen);
    if (screen === SCREEN_TITLE) {
      context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
      context.fillStyle = 'rgba(8, 10, 20, 0.55)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      const lines = [
        'Neon Harbor, 1986. The sun never sets on the docks, the money never',
        'sleeps, and everyone needs a driver. You are Rook — fast, quiet, for hire.',
        '',
        'WASD / arrows — move & drive · E — steal & exit a car · SPACE / click — shoot',
        'P — pause · F — save · M — mute · R — restart',
        '',
        `Jobs done: ${extra.missionsDone} · Cash earned: $${extra.earned}`,
      ];
      if (extra.hasSave) lines.push('A save is waiting — press L to continue it.');
      drawPanelBox('NEON HARBOR', lines, 'Press ENTER to start', '#ffd23f');
      text('An original open-world crime game — no Rockstar, no GTA, all ours.', VIEW.width / 2, VIEW.height - 42, 15, PALETTE.muted, 'center', 'alphabetic');
    } else if (screen === SCREEN_PAUSED) {
      context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
      context.fillStyle = 'rgba(8, 10, 20, 0.55)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanelBox('PAUSED', [
        'P / ENTER — resume',
        'F — save progress',
        'R — restart the story',
        'M — mute / unmute',
        'Q — quit to the title screen',
      ], 'Paused — the city waits', '#ffd23f');
    } else if (screen === SCREEN_END) {
      context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
      const kind = extra.endKind;
      context.fillStyle = kind === 'busted' ? 'rgba(20, 20, 80, 0.72)' : 'rgba(80, 16, 16, 0.72)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanelBox(
        kind === 'busted' ? 'BUSTED' : 'WASTED',
        kind === 'busted'
          ? ['The Harbor Police caught you on foot.', 'They took their cut. The city forgets fast.']
          : ['You went down in the streets of Neon Harbor.', 'The hospital patched you up — for a price.'],
        'Press ENTER to get back out there',
        kind === 'busted' ? '#9ecfff' : '#ff6b6b',
      );
    } else if (screen === SCREEN_COMPLETE) {
      context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
      context.fillStyle = 'rgba(8, 10, 20, 0.66)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanelBox('KING OF THE HARBOR', [
        STORY.outro,
        '',
        `Jobs done: ${extra.missionsDone} · Cash earned: $${extra.earned} · Fares: ${extra.fares}`,
        'The streets are yours. Keep roaming — fares, cash and chaos remain.',
      ], 'Press ENTER to keep playing', '#ffd23f');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, worldPoint };
}
