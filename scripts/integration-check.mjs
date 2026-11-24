import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const browser = await chromium.launch({
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  }),
  page = await context.newPage();
const results = [],
  errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log("PASS", name);
  } catch (e) {
    results.push({ name, passed: false, error: String(e) });
    console.log("FAIL", name, String(e));
    await page.evaluate(() => window.auralis?.ui.close());
  }
}
await page.goto("http://127.0.0.1:5173");
await page.waitForFunction(() => window.auralis, { timeout: 120000 });
await page.getByRole("button", { name: "Nova jornada", exact: true }).click();
await page
  .getByRole("button", { name: "Entrar em Auralis", exact: true })
  .click();
await page.waitForFunction(() => window.auralis.running, { timeout: 120000 });
const teleport = async (x, z, y) =>
  page.evaluate(
    ({ x, z, y }) => {
      const g = window.auralis;
      g.input.target = null;
      g.route = [];
      g.physics.teleport(x, y ?? 11, z);
      g.player.group.position.copy(g.physics.position);
    },
    { x, z, y },
  );
await test("Colisão impede atravessar a parede da casa", async () => {
  await teleport(-34, -143, 11);
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(2200);
  await page.keyboard.up("KeyW");
  const z = await page.evaluate(() => window.auralis.physics.position.z);
  expect(z).toBeGreaterThan(-149);
  expect(z).toBeLessThan(-146);
});
await test("Diálogo da guilda conclui chegada e recompensa", async () => {
  await teleport(-4, -129, 11);
  await page.keyboard.press("KeyE");
  await page.getByRole("button", { name: "Vamos lá", exact: true }).click();
  const s = await page.evaluate(() => window.auralis.state);
  expect(s.quest).toBe(1);
  expect(s.gold).toBe(45);
});
await test("Compra e venda via botões alteram inventário e ouro", async () => {
  await teleport(13, -132, 11);
  await page.keyboard.press("KeyE");
  const potion = page
    .locator(".item-grid article")
    .filter({ hasText: "Poção de vida" });
  await potion
    .getByRole("button", { name: "Comprar · 20 ouro", exact: true })
    .click();
  let s = await page.evaluate(() => window.auralis.state);
  expect(s.inventory.potion).toBe(3);
  expect(s.gold).toBe(25);
  await potion
    .getByRole("button", { name: "Vender · 10 ouro", exact: true })
    .click();
  s = await page.evaluate(() => window.auralis.state);
  expect(s.inventory.potion).toBe(2);
  expect(s.gold).toBe(35);
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
});
await test("Coleta real remove recurso e acrescenta item", async () => {
  const r = await page.evaluate(() => {
    const g = window.auralis,
      r = g.resources.find(
        (r) => r.item === "herb" && r.object.position.z > -90,
      );
    g.physics.teleport(
      r.object.position.x,
      r.object.position.y,
      r.object.position.z + 1,
    );
    g.player.group.position.copy(g.physics.position);
    return { id: r.id, item: r.item };
  });
  await page.keyboard.press("KeyE");
  await page.waitForTimeout(200);
  const s = await page.evaluate(() => window.auralis.state);
  expect(s.inventory[r.item]).toBe(1);
  expect(s.collected[r.id]).toBeGreaterThan(Date.now());
});
await test("Ataques com cooldown causam morte e loot", async () => {
  await page.evaluate(() => {
    const g = window.auralis,
      w = g.entities.find((e) => e.kind === "wolf");
    g.physics.teleport(
      w.object.position.x,
      w.object.position.y,
      w.object.position.z + 2,
    );
    g.player.group.position.copy(g.physics.position);
    g.state.hp = 100;
    g.stamina = 100;
  });
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("KeyF");
    await page.waitForTimeout(800);
  }
  const result = await page.evaluate(() => ({
    dead: window.auralis.entities.some((e) => e.kind === "wolf" && e.hp <= 0),
    xp: window.auralis.state.xp,
    ore: window.auralis.state.inventory.ore,
  }));
  expect(result.dead).toBe(true);
  expect(result.xp).toBeGreaterThanOrEqual(85);
  expect(result.ore).toBeGreaterThanOrEqual(1);
});
await test("Salva e recupera inventário, posição e missão após reload", async () => {
  await teleport(0, -115, 11);
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(300);
  const before = await page.evaluate(() =>
    structuredClone(window.auralis.state),
  );
  await page.reload();
  await page.waitForFunction(() => window.auralis, { timeout: 120000 });
  await page
    .getByRole("button", { name: "Continuar jornada", exact: true })
    .click();
  await page.waitForFunction(() => window.auralis.running, { timeout: 120000 });
  const after = await page.evaluate(() => window.auralis.state);
  expect(after.inventory).toEqual(before.inventory);
  expect(after.quest).toBe(before.quest);
  expect(after.gold).toBe(before.gold);
  expect(after.position).toEqual(before.position);
});
await test("Seis modelos possuem Idle, Walk e ação de classe válidos", async () => {
  const data = await page.evaluate(async () => {
    const g = window.auralis,
      entries = [];
    for (const [name, attack] of [
      ["Warrior", "Sword_Attack"],
      ["Ranger", "Bow_Shoot"],
      ["Rogue", "Dagger_Attack"],
      ["Wizard", "Spell1"],
      ["Cleric", "Staff_Attack"],
      ["Monk", "Attack"],
    ]) {
      const model = await g.assets.model(
        "models/characters/quaternius-rpg-classes/glTF/" + name + ".gltf",
      );
      entries.push({
        name,
        valid: ["Idle", "Walk", attack].every((c) =>
          model.animations.some((a) => a.name === c),
        ),
      });
    }
    return entries;
  });
  expect(data.every((e) => e.valid)).toBe(true);
});
await test("Navegação por grade contorna lago e construções", async () => {
  const result = await page.evaluate(() => {
    const g = window.auralis;
    return g.navigation.path({ x: 0, z: -115 }, { x: 98, z: -110 });
  });
  expect(result.length).toBeGreaterThan(20);
});
await test("Layout touch e joystick movem personagem em emulação mobile", async () => {
  const mobile = await browser.newContext({
    viewport: { width: 915, height: 412 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const p = await mobile.newPage();
  p.on("pageerror", (e) => errors.push("mobile: " + String(e)));
  await p.goto("http://127.0.0.1:5173");
  await p.waitForFunction(() => window.auralis, { timeout: 120000 });
  await p.getByRole("button", { name: "Nova jornada", exact: true }).click();
  await p
    .getByRole("button", { name: "Entrar em Auralis", exact: true })
    .click();
  await p.waitForFunction(() => window.auralis.running, { timeout: 120000 });
  await p.waitForTimeout(500);
  const stick = p.locator("#joystick");
  await expect(stick).toBeVisible();
  const box = await stick.boundingBox(),
    before = await p.evaluate(() => window.auralis.physics.position.z);
  await p.mouse.move(box.x + box.width / 2, box.y + 15);
  await p.mouse.down();
  await p.waitForTimeout(1200);
  await p.mouse.up();
  const after = await p.evaluate(() => window.auralis.physics.position.z);
  expect(after).toBeLessThan(before - 1);
  await p.screenshot({ path: "docs/screenshots/04-mobile-landscape.png" });
  await p.setViewportSize({ width: 390, height: 844 });
  await p.screenshot({ path: "docs/screenshots/05-mobile-portrait.png" });
  results.push({
    name: "Medição mobile emulada",
    fps: await p.evaluate(() => window.auralis.fps),
  });
  await mobile.close();
});
const output = { results, errors };
fs.writeFileSync(
  "docs/integration-check.json",
  JSON.stringify(output, null, 2),
);
console.log(JSON.stringify(output, null, 2));
await browser.close();
if (results.some((r) => r.passed === false) || errors.length)
  process.exitCode = 1;
