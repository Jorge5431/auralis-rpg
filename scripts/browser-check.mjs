import { chromium } from "@playwright/test";
import fs from "node:fs";
fs.mkdirSync("docs/screenshots", { recursive: true });
const browser = await chromium.launch({
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [],
  warnings = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
  if (m.type() === "warning") warnings.push(m.text());
});
page.on("response", (r) => {
  if (r.status() >= 400) errors.push(r.status() + " " + r.url());
});
await page.goto("http://127.0.0.1:5173");
await page.waitForFunction(() => window.auralis, { timeout: 120000 });
await page.screenshot({ path: "docs/screenshots/01-menu.png" });
await page.getByRole("button", { name: "Nova jornada", exact: true }).click();
await page
  .getByRole("button", { name: "Entrar em Auralis", exact: true })
  .click();
await page.waitForFunction(() => window.auralis.running, { timeout: 120000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: "docs/screenshots/02-village.png" });
const before = await page.evaluate(() =>
  window.auralis.physics.position.toArray(),
);
await page.keyboard.down("KeyW");
await page.waitForTimeout(2000);
await page.keyboard.up("KeyW");
const after = await page.evaluate(() =>
  window.auralis.physics.position.toArray(),
);
await page.keyboard.press("KeyV");
await page.waitForTimeout(1800);
await page.screenshot({ path: "docs/screenshots/03-island.png" });
const stats = await page.evaluate(() => ({
  fps: window.auralis.fps,
  render: window.auralis.renderer.info.render,
  memory: window.auralis.renderer.info.memory,
  models: window.auralis.assets.loaded,
  assetErrors: window.auralis.assets.errors,
  position: window.auralis.physics.position.toArray(),
  animation: window.auralis.player.current,
}));
fs.writeFileSync(
  "docs/browser-check.json",
  JSON.stringify({ before, after, stats, errors, warnings }, null, 2),
);
console.log(
  JSON.stringify({ before, after, stats, errors, warnings }, null, 2),
);
await browser.close();
