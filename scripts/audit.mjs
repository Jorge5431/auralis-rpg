import fs from "node:fs";
import crypto from "node:crypto";
const catalog = JSON.parse(
  fs.readFileSync("assets/ASSET_CATALOG.json", "utf8"),
);
const failures = [];
for (const a of catalog.assets) {
  const path = `public/assets/${a.path}`;
  if (!fs.existsSync(path)) {
    failures.push(`Missing: ${a.path}`);
    continue;
  }
  const data = fs.readFileSync(path);
  if (crypto.createHash("sha256").update(data).digest("hex") !== a.sha256)
    failures.push(`Changed: ${a.path}`);
  for (const dep of a.model?.dependencies ?? []) {
    const uri = typeof dep === "string" ? dep : dep.uri;
    if (uri && !uri.startsWith("data:")) {
      const p = new URL(
        uri,
        new URL(path, `file://${process.cwd().replaceAll("\\", "/")}/`),
      );
      if (!fs.existsSync(p)) failures.push(`Dependency: ${p}`);
    }
  }
}
const variants = JSON.parse(
  fs.readFileSync("public/assets/optimized/texture-variants.json"),
);
for (const v of variants)
  for (const p of [v.original, v.desktop.path, v.mobile.path])
    if (!fs.existsSync("public/assets/" + p)) failures.push(p);
const report = {
  date: new Date().toISOString(),
  files: catalog.assets.length,
  variants: variants.length * 2,
  failures,
};
fs.writeFileSync("docs/asset-audit.json", JSON.stringify(report, null, 2));
console.log(report);
process.exitCode = failures.length ? 1 : 0;
