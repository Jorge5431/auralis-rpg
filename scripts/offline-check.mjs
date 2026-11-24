import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const b = await chromium.launch({
    executablePath:
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  }),
  c = await b.newContext(),
  p = await c.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
await p.goto("http://127.0.0.1:5174");
await p.waitForFunction(() => window.auralis, { timeout: 120000 });
await p.evaluate(() => navigator.serviceWorker.ready);
await p.getByRole("button", { name: "Nova jornada", exact: true }).click();
await p.getByRole("button", { name: "Entrar em Auralis", exact: true }).click();
await p.waitForFunction(() => window.auralis.running, { timeout: 120000 });
await p.evaluate(() => window.auralis.save(true));
await p.waitForTimeout(1000);
await p.reload();
await p.waitForFunction(() => window.auralis, { timeout: 120000 });
await p.getByRole("button", { name: "Continuar jornada", exact: true }).click();
await p.waitForFunction(() => window.auralis.running, { timeout: 120000 });
await p.waitForTimeout(1000);
const cache = await p.evaluate(async () => {
  const keys = await caches.keys();
  return Promise.all(
    keys.map(async (name) => ({
      name,
      count: (await (await caches.open(name)).keys()).length,
    })),
  );
});
await c.setOffline(true);
await p.reload();
await p.waitForFunction(() => window.auralis, { timeout: 120000 });
await p.getByRole("button", { name: "Continuar jornada", exact: true }).click();
await p.waitForFunction(() => window.auralis.running, { timeout: 120000 });
expect(errors).toEqual([]);
const result = { offlineReloadAndResume: true, cache, errors };
fs.writeFileSync("docs/offline-check.json", JSON.stringify(result, null, 2));
console.log(result);
await b.close();
