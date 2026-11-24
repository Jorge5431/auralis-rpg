import { edge, height, lake } from "./Terrain";
import type { Obstacle } from "./World";
export class Navigation {
  step = 3;
  size = 171;
  half = 85;
  blocked: Uint8Array;
  constructor(obstacles: Obstacle[]) {
    this.blocked = new Uint8Array(this.size * this.size);
    for (let j = 0; j < this.size; j++)
      for (let i = 0; i < this.size; i++) {
        const x = (i - this.half) * this.step,
          z = (j - this.half) * this.step,
          h = height(x, z);
        if (
          edge(x, z) > 0.96 ||
          lake(x, z) < 1.08 ||
          Math.abs(height(x + 3, z) - h) > 2 ||
          Math.abs(height(x, z + 3) - h) > 2 ||
          obstacles.some(
            (o) =>
              o.h > 2 &&
              Math.abs(x - o.x) < o.w / 2 + 0.5 &&
              Math.abs(z - o.z) < o.d / 2 + 0.5,
          )
        )
          this.blocked[j * this.size + i] = 1;
      }
  }
  path(from: { x: number; z: number }, to: { x: number; z: number }) {
    const cell = (p: { x: number; z: number }) => {
      const x = Math.round(p.x / this.step) + this.half,
        z = Math.round(p.z / this.step) + this.half;
      return x >= 0 && x < this.size && z >= 0 && z < this.size
        ? z * this.size + x
        : -1;
    };
    const start = cell(from),
      end = cell(to);
    if (start < 0 || end < 0 || this.blocked[end]) return [];
    const open = new Set([start]),
      parents = new Map<number, number>(),
      scores = new Map([[start, 0]]);
    const heuristic = (n: number) =>
      Math.abs((n % this.size) - (end % this.size)) +
      Math.abs(Math.floor(n / this.size) - Math.floor(end / this.size));
    let budget = 9000;
    while (open.size && budget--) {
      let current = -1,
        best = Infinity;
      for (const n of open) {
        const score = scores.get(n)! + heuristic(n);
        if (score < best) {
          current = n;
          best = score;
        }
      }
      if (current === end) {
        const result: { x: number; z: number }[] = [];
        let n = end;
        while (n !== start) {
          result.push({
            x: ((n % this.size) - this.half) * this.step,
            z: (Math.floor(n / this.size) - this.half) * this.step,
          });
          n = parents.get(n)!;
        }
        return result.reverse();
      }
      open.delete(current);
      for (const offset of [-1, 1, -this.size, this.size]) {
        const n = current + offset;
        if (
          n < 0 ||
          n >= this.blocked.length ||
          this.blocked[n] ||
          Math.abs((n % this.size) - (current % this.size)) > 1
        )
          continue;
        const g = scores.get(current)! + 1;
        if (g < (scores.get(n) ?? Infinity)) {
          scores.set(n, g);
          parents.set(n, current);
          open.add(n);
        }
      }
    }
    return [];
  }
}
