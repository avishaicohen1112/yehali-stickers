'use strict';
// Rooms, tile collision, transitions lookup
G.World = (function () {
  const W = window.WORLD;
  class Room {
    constructor(id) {
      const d = W.rooms[id]; Object.assign(this, d); this.id = id;
      this.pw = this.w * TILE; this.ph = this.h * TILE;
      this.rows = d.rows; this.over = {}; // dynamic overrides ("x,y" -> char) for gates
    }
    tile(tx, ty) {
      const k = tx + ',' + ty; if (this.over[k]) return this.over[k];
      if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) {
        const cx = clamp(tx, 0, this.w - 1), cy = clamp(ty, 0, this.h - 1);
        const k2 = cx + ',' + cy; if (this.over[k2]) return this.over[k2];
        const c = this.rows[cy][cx];
        return c === '=' || c === '^' ? '#' : c;
      }
      return this.rows[ty][tx];
    }
    solid(tx, ty) { const c = this.tile(tx, ty); return c === '#' || (c === 'x' && !this.shadowPass); }
    solidAt(x, y) { return this.solid(Math.floor(x / TILE), Math.floor(y / TILE)); }
    // move body horizontally, returns side hit (-1,0,1)
    moveX(b, dx) {
      let hit = 0; const steps = Math.ceil(Math.abs(dx) / 20) || 1, sdx = dx / steps;
      for (let s = 0; s < steps; s++) {
        b.x += sdx;
        const y0 = Math.floor((b.y + 1) / TILE), y1 = Math.floor((b.y + b.h - 1) / TILE);
        if (sdx > 0) {
          const tx = Math.floor((b.x + b.w) / TILE);
          for (let ty = y0; ty <= y1; ty++) if (this.solid(tx, ty)) { b.x = tx * TILE - b.w - 0.001; hit = 1; break; }
        } else if (sdx < 0) {
          const tx = Math.floor(b.x / TILE);
          for (let ty = y0; ty <= y1; ty++) if (this.solid(tx, ty)) { b.x = (tx + 1) * TILE + 0.001; hit = -1; break; }
        }
        if (hit) break;
      }
      return hit;
    }
    moveY(b, dy, dropThrough) {
      let hit = 0; const steps = Math.ceil(Math.abs(dy) / 20) || 1, sdy = dy / steps;
      for (let s = 0; s < steps; s++) {
        const prevBottom = b.y + b.h;
        b.y += sdy;
        const x0 = Math.floor((b.x + 1) / TILE), x1 = Math.floor((b.x + b.w - 1) / TILE);
        if (sdy > 0) {
          const ty = Math.floor((b.y + b.h) / TILE);
          for (let tx = x0; tx <= x1; tx++) {
            const c = this.tile(tx, ty);
            if (c === '#' || (c === 'x' && !this.shadowPass) || (c === '=' && !dropThrough && prevBottom <= ty * TILE + 0.5)) { b.y = ty * TILE - b.h; hit = 1; break; }
          }
        } else if (sdy < 0) {
          const ty = Math.floor(b.y / TILE);
          for (let tx = x0; tx <= x1; tx++) if (this.solid(tx, ty)) { b.y = (ty + 1) * TILE + 0.001; hit = -1; break; }
        }
        if (hit) break;
      }
      return hit;
    }
    // check body overlapping tiles of a char set; returns char or null
    touches(b, chars, inset = 6) {
      const x0 = Math.floor((b.x + inset) / TILE), x1 = Math.floor((b.x + b.w - inset) / TILE);
      const y0 = Math.floor((b.y + inset) / TILE), y1 = Math.floor((b.y + b.h - 1) / TILE);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        const c = this.tile(tx, ty);
        if (chars.indexOf(c) >= 0) {
          if (c === '^' && b.y + b.h < ty * TILE + 22) continue;
          if (c === '~' && b.y + b.h < ty * TILE + 14) continue;
          return c;
        }
      }
      return null;
    }
    onGroundAt(b) {
      const ty = Math.floor((b.y + b.h + 2) / TILE);
      for (let tx = Math.floor((b.x + 1) / TILE); tx <= Math.floor((b.x + b.w - 1) / TILE); tx++) {
        const c = this.tile(tx, ty); if (c === '#' || c === 'x' || (c === '=' && b.y + b.h <= ty * TILE + 1)) return true;
      }
      return false;
    }
    // floor y below point (for spawning)
    floorBelow(x, y) {
      let ty = Math.floor(y / TILE); const tx = Math.floor(x / TILE);
      for (let i = 0; i < 60; i++, ty++) { const c = this.tile(tx, ty); if (c === '#' || c === '=') return ty * TILE; }
      return y;
    }
    // ray march line of sight
    los(ax, ay, bx, by) {
      const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 20);
      for (let i = 1; i < n; i++) { const t = i / n; if (this.solidAt(lerp(ax, bx, t), lerp(ay, by, t))) return false; }
      return true;
    }
    edgeAhead(b, dir) { // is there floor ahead of a walker?
      const x = dir > 0 ? b.x + b.w + 4 : b.x - 4, y = b.y + b.h + 4;
      const c = this.tile(Math.floor(x / TILE), Math.floor(y / TILE));
      return !(c === '#' || c === '=');
    }
    wallAhead(b, dir) { const x = dir > 0 ? b.x + b.w + 3 : b.x - 3; return this.solidAt(x, b.y + b.h - 10) || this.solidAt(x, b.y + 10); }
    hazardAhead(b, dir) { const x = dir > 0 ? b.x + b.w + 6 : b.x - 6; const c = this.tile(Math.floor(x / TILE), Math.floor((b.y + b.h + 4) / TILE)); const c2 = this.tile(Math.floor(x / TILE), Math.floor((b.y + b.h - 4) / TILE)); return c === '^' || c === '~' || c2 === '^'; }
  }
  // find room containing global tile point
  function roomAt(gx, gy, world) {
    for (const id in W.rooms) { const r = W.rooms[id]; if (world && r.world !== world) continue; if (gx >= r.gx && gx < r.gx + r.w && gy >= r.gy && gy < r.gy + r.h) return id; }
    return null;
  }
  return { Room, roomAt, data: W };
})();
