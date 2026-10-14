import { WORLD_MAP } from '../config/worldConfig.js';
import { RELAY_CONFIG } from '../config/relayConfig.js';

export class MapRenderer {
  constructor(map = WORLD_MAP) {
    this.map = map;
  }

  setMap(map) {
    this.map = map;
  }

  render(context, camera) {
    const { width, height, gridSpacing } = this.map;

    context.save();
    context.fillStyle = this.map.outsideColor;
    context.fillRect(0, 0, camera.viewportWidth, camera.viewportHeight);

    context.beginPath();
    context.rect(0, 0, camera.viewportWidth, camera.viewportHeight);
    context.clip();
    context.translate(-camera.x, -camera.y);

    context.fillStyle = this.map.backgroundColor;
    context.fillRect(0, 0, width, height);

    if (this.map.theme === 'city') {
      this.#drawCity(context, width, height, camera);
    } else if (this.map.theme === 'laboratory') {
      this.#drawLaboratory(context, width, height, camera);
    } else if (this.map.theme === 'energy') {
      this.#drawEnergyHub(context, camera);
    }

    context.beginPath();
    for (let x = 0; x < width; x += gridSpacing) {
      context.moveTo(x, 0);
      context.lineTo(x, height);
    }
    for (let y = 0; y < height; y += gridSpacing) {
      context.moveTo(0, y);
      context.lineTo(width, y);
    }
    context.strokeStyle = this.map.gridColor;
    context.lineWidth = 1;
    context.stroke();

    context.save();
    context.beginPath();
    for (let y = 96; y < height - 32; y += 192) {
      for (let x = 96; x < width - 32; x += 192) {
        const variant = (Math.floor(x / 192) * 7 + Math.floor(y / 192) * 3) % 3;
        if (variant === 0) {
          context.moveTo(x, y);
          context.lineTo(x + 20, y);
          context.lineTo(x + 20, y + 12);
          context.moveTo(x + 3, y + 5);
          context.lineTo(x + 10, y + 5);
        } else if (variant === 1) {
          context.moveTo(x, y);
          context.lineTo(x, y + 18);
          context.lineTo(x + 14, y + 18);
        }
      }
    }
    context.strokeStyle = '#25445a';
    context.lineWidth = 1.5;
    context.globalAlpha = 0.62;
    context.stroke();
    context.restore();

    context.strokeStyle = this.map.borderColor;
    context.lineWidth = 4;
    context.strokeRect(0, 0, width, height);
    context.restore();
  }

  #visible(camera, x, y, width, height) {
    return x + width >= camera.x && y + height >= camera.y
      && x <= camera.x + camera.viewportWidth && y <= camera.y + camera.viewportHeight;
  }

  #drawEnergyHub(ctx, camera) {
    // Broad, walkable service lanes connect three distinct equipment districts.
    ctx.fillStyle = '#233747'; ctx.fillRect(0, 590, 2400, 170); ctx.fillRect(1110, 0, 180, 1350);
    ctx.strokeStyle = '#577b83'; ctx.lineWidth = 44; ctx.strokeRect(900, 480, 600, 420);
    ctx.strokeStyle = '#99bc95'; ctx.lineWidth = 2; ctx.strokeRect(875, 455, 650, 470);
    ctx.fillStyle = '#8dab8c';
    for (let x = 900; x <= 1500; x += 50) { ctx.fillRect(x, 472, 20, 4); ctx.fillRect(x, 904, 20, 4); }
    for (const [index, landmark] of (this.map.layout?.landmarks ?? []).entries()) {
      const { x, y } = landmark;
      if (!this.#visible(camera, x - 190, y - 150, 380, 300)) continue;
      ctx.fillStyle = ['#203d43', '#35394b', '#3b3a30'][index]; ctx.fillRect(x - 180, y - 140, 360, 280);
      ctx.strokeStyle = ['#71c5ce', '#aea9e2', '#d0b67c'][index]; ctx.lineWidth = 3; ctx.strokeRect(x - 180, y - 140, 360, 280);
      for (let i = 0; i < 6; i++) {
        const ex = x - 155 + (i % 3) * 112, ey = y - 115 + Math.floor(i / 3) * 188;
        ctx.fillStyle = '#152735'; ctx.fillRect(ex, ey, 82, 48);
        ctx.fillStyle = ['#5f9fba', '#837fb9', '#b3a36c'][index];
        if (index === 0) { for (let strip = 0; strip < 4; strip++) ctx.fillRect(ex + 8, ey + 8 + strip * 8, 65, 4); }
        else if (index === 1) { ctx.fillRect(ex + 10, ey + 8, 62, 28); ctx.fillStyle = '#c3cee5'; ctx.fillRect(ex + 15, ey + 14, 35, 3); }
        else { for (let coil = 0; coil < 3; coil++) { ctx.fillRect(ex + 10 + coil * 22, ey + 6, 14, 36); ctx.fillStyle = '#dfc88e'; ctx.fillRect(ex + 13 + coil * 22, ey + 17, 8, 3); } }
      }
      ctx.strokeStyle = '#5c8792'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, 675); ctx.lineTo(1200, 675); ctx.stroke();
    }
    const x = 1200, y = 675;
    ctx.fillStyle = '#182c3c'; ctx.fillRect(x - 125, y - 110, 250, 220);
    ctx.strokeStyle = '#6eacc1'; ctx.lineWidth = 5; ctx.strokeRect(x - 125, y - 110, 250, 220);
    ctx.fillStyle = '#33586a'; ctx.fillRect(x - 90, y - 80, 180, 160);
    for (const offset of [-1, 1]) {
      ctx.fillStyle = '#739baa'; ctx.fillRect(x + offset * 100 - 10, y - 70, 20, 140);
      ctx.fillStyle = '#9ad6df'; for (let i = 0; i < 6; i++) ctx.fillRect(x + offset * 100 - 6, y - 60 + i * 22, 12, 6);
    }
    ctx.strokeStyle = '#90d4df'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 75, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#8eafa4'; ctx.font = '14px "Microsoft YaHei", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('安全环道 · 开放通行', 1200, 940);
  }

  #drawCity(context, width, height, camera) {
    context.fillStyle = '#202c39';
    context.fillRect(0, 535, width, 280);
    context.fillRect(1040, 0, 320, height);

    // Raised sidewalks and curbs frame, but never obstruct, the broad streets.
    context.fillStyle = '#35414a';
    for (const y of [516, 815]) context.fillRect(0, y, width, 20);
    for (const x of [1020, 1360]) context.fillRect(x, 0, 20, height);
    context.fillStyle = '#c8aa6a';
    for (const y of [532, 815]) context.fillRect(0, y, width, 3);
    for (const x of [1037, 1360]) context.fillRect(x, 0, 3, height);

    // Six contrasting blocks on each open quadrant create distinct districts.
    const xStarts = [28, 356, 684, 1388, 1716, 2044];
    const yStarts = [28, 270, 852, 1094];
    const blockColors = ['#2b4650', '#35464a', '#384455', '#304b4c', '#3b454c', '#2e414d'];
    let block = 0;
    for (const y of yStarts) {
      if (y > 500 && y < 850) continue;
      for (const x of xStarts) {
        const leftDistrict = x < 1000, rightDistrict = x > 1360;
        if (!leftDistrict && !rightDistrict) continue;
        const w = 286, h = 210;
        const variant = block++ % 6;
        if (!this.#visible(camera, x - 8, y - 8, w + 16, h + 16)) continue;
        context.fillStyle = '#17232c';
        context.fillRect(x - 8, y - 8, w + 16, h + 16);
        context.fillStyle = '#47545a';
        context.fillRect(x - 5, y - 5, w + 10, h + 10);
        context.fillStyle = blockColors[variant];
        context.fillRect(x, y, w, h);
        if (variant === 2 || variant === 5) {
          // Small planted refuge yard.
          context.fillStyle = '#203c38';
          context.fillRect(x + 16, y + 16, w - 32, h - 32);
          for (let tree = 0; tree < 6; tree += 1) {
            const tx = x + 32 + (tree % 3) * 94;
            const ty = y + 34 + Math.floor(tree / 3) * 86;
            context.fillStyle = '#54745a';
            context.fillRect(tx, ty, 16, 16);
            context.fillStyle = '#a1b174';
            context.fillRect(tx + 5, ty + 5, 6, 6);
          }
        } else {
          // Flat roofs, service wells and lit window strips are decorative only.
          context.fillStyle = variant === 1 ? '#52616a' : '#50616a';
          context.fillRect(x + 22, y + 22, w - 44, h - 44);
          context.fillStyle = '#273843';
          context.fillRect(x + 34, y + 34, w - 68, h - 68);
          context.fillStyle = variant % 2 ? '#c38965' : '#83c4bd';
          for (let window = 0; window < 5; window += 1) {
            context.fillRect(x + 48 + window * 37, y + 48, 18, 5);
            context.fillRect(x + 48 + window * 37, y + h - 54, 18, 5);
          }
          context.fillStyle = '#66747a';
          context.fillRect(x + 34, y + 90, 42, 30);
          context.fillRect(x + w - 78, y + 90, 42, 30);
          context.fillStyle = '#d2a95f';
          context.fillRect(x + w / 2 - 18, y + h - 5, 36, 5);
        }
      }
    }

    // Recessed, walkable plazas distinguish the three interactive districts.
    for (const [index, station] of RELAY_CONFIG.stations.entries()) {
      const { x, y } = station;
      if (!this.#visible(camera, x - 145, y - 120, 290, 240)) continue;
      context.fillStyle = ['#1d3940', '#343249', '#38392c'][index];
      context.fillRect(x - 145, y - 120, 290, 240);
      context.strokeStyle = ['#547f83', '#79698e', '#928255'][index];
      context.lineWidth = 3;
      context.strokeRect(x - 137, y - 112, 274, 224);
      context.fillStyle = ['#7aadaa', '#a18aba', '#c0ac73'][index];
      if (index === 0) {
        for (const side of [-1, 1]) {
          context.fillRect(x + side * 110 - 4, y - 20, 8, 40);
          context.fillRect(x + side * 110 - 20, y - 4, 40, 8);
        }
      } else if (index === 1) {
        for (const side of [-1, 1]) {
          context.fillRect(x + side * 108 - 15, y - 45, 30, 8);
          context.fillRect(x + side * 108 - 8, y - 31, 16, 62);
          context.fillRect(x + side * 108 - 15, y + 37, 30, 8);
        }
      } else {
        for (let row = -2; row <= 2; row++) {
          for (const side of [-1, 1]) context.fillRect(x + side * 115 - Math.abs(row) * 6, y + row * 12, 10, 8);
        }
      }
    }

    // Crosswalks, lane markers and a clear central intersection.
    context.fillStyle = '#e6d39b';
    for (let stripe = 0; stripe < 8; stripe += 1) {
      const offset = stripe * 38;
      context.fillRect(1044 + offset, 500, 20, 12);
      context.fillRect(1044 + offset, 838, 20, 12);
      context.fillRect(1008, 544 + offset, 12, 20);
      context.fillRect(1380, 544 + offset, 12, 20);
    }
    context.fillStyle = '#96834b';
    for (let x = 24; x < width; x += 96) context.fillRect(x, 671, 48, 6);
    for (let y = 24; y < height; y += 96) context.fillRect(1197, y, 6, 48);

    // Wrecked service vehicles, traffic barriers and evacuation signs sit at road edges.
    for (const [x, y, color] of [[510, 565, '#536d75'], [1660, 760, '#685457'], [1220, 226, '#4b6573']]) {
      context.fillStyle = '#151d24';
      context.fillRect(x - 4, y + 5, 70, 30);
      context.fillStyle = color;
      context.fillRect(x, y, 62, 28);
      context.fillStyle = '#d59d58';
      context.fillRect(x + 8, y + 5, 14, 4);
      context.fillRect(x + 40, y + 5, 14, 4);
      context.fillStyle = '#1b272e';
      context.fillRect(x + 8, y + 24, 12, 6);
      context.fillRect(x + 42, y + 24, 12, 6);
    }
    context.fillStyle = '#c76358';
    for (const [x, y] of [[950, 552], [950, 776], [1430, 552], [1430, 776]]) {
      context.fillRect(x, y, 30, 8);
      context.fillStyle = '#e0b56c';
      context.fillRect(x + 6, y - 5, 8, 5);
      context.fillStyle = '#c76358';
    }
  }

  #drawLaboratory(context, width, height, camera) {
    // Repeated equipment bays, floor plates and cable trenches add room scale
    // while keeping the entire arena visually traversable.
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 6; column += 1) {
        const x = 110 + column * 380;
        const y = 88 + row * 310;
        if (x > width - 300 || y > height - 180) continue;
        if (!this.#visible(camera, x, y, 260, 196)) continue;
        context.fillStyle = '#101f2c';
        context.fillRect(x, y, 260, 196);
        context.strokeStyle = '#29495c';
        context.lineWidth = 2;
        context.strokeRect(x + 8, y + 8, 244, 180);
        context.fillStyle = '#1a2b38';
        context.fillRect(x + 18, y + 18, 224, 160);
        context.fillStyle = '#36505e';
        context.fillRect(x + 30, y + 32, 78, 36);
        context.fillRect(x + 152, y + 32, 78, 36);
        context.fillStyle = '#58a2ac';
        context.fillRect(x + 36, y + 38, 44, 4);
        context.fillRect(x + 158, y + 38, 52, 4);
        context.fillStyle = '#715b42';
        context.fillRect(x + 34, y + 126, 192, 8);
        context.fillStyle = '#d3a45e';
        for (let mark = 0; mark < 6; mark += 1) context.fillRect(x + 36 + mark * 32, y + 141, 16, 4);
      }
    }
    context.fillStyle = '#194b58';
    for (let x = 80; x < width; x += 480) {
      context.fillRect(x, height / 2 - 2, 160, 4);
      context.fillRect(x + 156, height / 2 - 36, 4, 72);
    }
  }
}
