import { chromium } from "@playwright/test";
import fs from "node:fs";
const b = await chromium.launch({
    executablePath:
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  }),
  p = await b.newPage();
await p.goto("http://127.0.0.1:5173");
await p.waitForFunction(() => window.auralis, { timeout: 120000 });
const result = await p.evaluate(() => {
  const g = window.auralis,
    physics = g.physics;
  function walk(x, z, max = 600) {
    let i = 0;
    for (; i < max; i++) {
      const pos = physics.position,
        dx = x - pos.x,
        dz = z - pos.z,
        d = Math.hypot(dx, dz);
      if (d < 0.15) break;
      physics.step((dx / d) * 0.055, (dz / d) * 0.055, false);
    }
    return { reached: i < max, p: physics.position.toArray() };
  }
  const ty = g.world.obstacles.find(
    (o) => o.x === 125 && o.z === -32 && o.w === 3.5,
  ).y;
  physics.teleport(125, ty + 0.3, -28);
  let tower = [];
  for (let i = 1; i < 68; i++) {
    const a = (i / 68) * Math.PI * 4;
    const r = walk(125 + Math.sin(a) * 4, -32 + Math.cos(a) * 4, 180);
    if (!r.reached) {
      tower.push({ step: i, ...r });
      break;
    }
  }
  const towerTop = physics.position.y - ty;
  physics.teleport(0, 11, -98);
  const mountain = [];
  for (const [x, z] of [
    [-68, -65],
    [-82, 0],
    [-75, 65],
    [-45, 108],
    [-65, 145],
    [-25, 160],
    [8, 149],
  ]) {
    const r = walk(x, z, 2200);
    mountain.push({ target: [x, z], ...r });
    if (!r.reached) break;
  }
  return { towerTop, tower, mountain };
});
console.log(JSON.stringify(result, null, 2));
fs.writeFileSync("docs/terrain-check.json", JSON.stringify(result, null, 2));
await b.close();
if (result.towerTop < 17 || result.mountain.some((s) => !s.reached))
  process.exitCode = 1;
