import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const b = await chromium.launch({
    executablePath:
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  }),
  p = await b.newPage();
await p.goto("http://127.0.0.1:5173");
await p.waitForFunction(() => window.auralis, { timeout: 120000 });
await p.getByRole("button", { name: "Nova jornada", exact: true }).click();
await p.getByRole("button", { name: "Entrar em Auralis", exact: true }).click();
await p.waitForFunction(() => window.auralis.running, { timeout: 120000 });
const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log("PASS", name);
  } catch (e) {
    results.push({ name, passed: false, error: String(e) });
    console.log("FAIL", name, String(e));
    await p.evaluate(() => window.auralis.ui.close());
  }
}
await check("Pesca espera a fisgada e concede peixe", async () => {
  const wait = await p.evaluate(async () => {
    const { height, lake } = await import("/src/v10/Terrain.ts");
    const g = window.auralis;
    for (let a = 0; a < 6.28; a += 0.1) {
      const x = Math.sin(a) * 73,
        z = Math.cos(a) * 69;
      if (lake(x, z) > 1.06 && lake(x, z) < 1.3) {
        g.physics.teleport(x, height(x, z) + 0.1, z);
        g.player.group.position.copy(g.physics.position);
        if (!g.nearest()) break;
      }
    }
    g.interact();
    if (!g.fishing) throw Error("A margem não iniciou a pesca");
    return g.fishReady - performance.now();
  });
  await p.waitForTimeout(wait + 100);
  await p.keyboard.press("KeyE");
  await p.waitForTimeout(200);
  expect(await p.evaluate(() => window.auralis.state.inventory.fish)).toBe(1);
});
await check(
  "Agricultura consome semente, rega e colhe após maturidade simulada",
  async () => {
    await p.evaluate(() => {
      const g = window.auralis;
      g.physics.teleport(110, 11.2, -110);
      g.player.group.position.copy(g.physics.position);
    });
    await p.keyboard.press("KeyG");
    await p.waitForTimeout(100);
    expect(await p.evaluate(() => window.auralis.state.inventory.seed)).toBe(2);
    await p.keyboard.press("KeyH");
    await p.waitForTimeout(100);
    expect(await p.evaluate(() => window.auralis.state.crops[0].watered)).toBe(
      true,
    );
    await p.evaluate(() => (window.auralis.state.crops[0].planted -= 61000));
    await p.keyboard.press("KeyH");
    await p.waitForTimeout(100);
    expect(await p.evaluate(() => window.auralis.state.inventory.crop)).toBe(2);
    expect(await p.evaluate(() => window.auralis.state.crops.length)).toBe(0);
  },
);
await check(
  "Construção exige materiais e baú transfere itens sem duplicar",
  async () => {
    await p.evaluate(async () => {
      const { height } = await import("/src/v10/Terrain.ts");
      const g = window.auralis;
      let chosen;
      for (let x = -145; x < -75 && !chosen; x += 5)
        for (let z = 45; z < 90; z += 5)
          if (g.validBuild(x, z)) {
            chosen = { x, z };
            break;
          }
      if (!chosen) throw Error("Sem área livre");
      g.physics.teleport(
        chosen.x,
        height(chosen.x, chosen.z - 4),
        chosen.z - 4,
      );
      g.player.group.position.copy(g.physics.position);
      g.player.group.rotation.y = 0;
      g.state.inventory.wood = 5;
      g.state.inventory.stone = 2;
      await g.action("preview", "chest");
    });
    await p.waitForTimeout(300);
    await p.keyboard.press("KeyE");
    await p.waitForTimeout(200);
    expect(await p.evaluate(() => window.auralis.state.buildings.length)).toBe(
      1,
    );
    expect(await p.evaluate(() => window.auralis.state.inventory.wood)).toBe(0);
    await p.evaluate(async () => {
      const { height } = await import("/src/v10/Terrain.ts");
      const g = window.auralis,
        b = g.state.buildings[0];
      g.physics.teleport(b.x, height(b.x, b.z - 2), b.z - 2);
      g.player.group.position.copy(g.physics.position);
    });
    await p.keyboard.press("KeyE");
    await p
      .locator(".item-grid article")
      .filter({ hasText: "Poção de vida" })
      .getByRole("button", { name: "Guardar 1" })
      .click();
    expect(await p.evaluate(() => window.auralis.state.inventory.potion)).toBe(
      1,
    );
    expect(
      await p.evaluate(() => window.auralis.state.buildings[0].contents.potion),
    ).toBe(1);
    await p
      .locator(".item-grid article")
      .filter({ hasText: "Poção de vida" })
      .getByRole("button", { name: "Retirar 1" })
      .click();
    expect(await p.evaluate(() => window.auralis.state.inventory.potion)).toBe(
      2,
    );
    await p.getByRole("button", { name: "Fechar", exact: true }).click();
    await p.evaluate(() => window.auralis.save(true));
    const stored = await p.evaluate(() => window.auralis.saves.load());
    expect(stored.buildings.length).toBe(1);
    expect(stored.buildings[0].contents.potion).toBe(0);
  },
);
fs.writeFileSync("docs/life-check.json", JSON.stringify(results, null, 2));
await b.close();
if (results.some((r) => !r.passed)) process.exitCode = 1;
