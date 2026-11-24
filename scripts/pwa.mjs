import fs from "node:fs";
const bundles = fs
  .readdirSync("dist/assets")
  .filter((f) => /\.(js|css)$/.test(f))
  .map((f) => "/assets/" + f);
const cache = "auralis-v10-" + Date.now();
fs.writeFileSync(
  "dist/sw.js",
  `const CACHE=${JSON.stringify(cache)},SHELL=${JSON.stringify(["/", "/index.html", "/manifest.webmanifest", "/icon.svg", ...bundles])};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('auralis-v10-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==location.origin)return;e.respondWith(fetch(e.request).then(async r=>{if(r.ok&&(SHELL.includes(url.pathname)||url.pathname.includes('/assets/models/')||url.pathname.includes('/assets/optimized/')||url.pathname.includes('/assets/textures/polyhaven/'))){const c=await caches.open(CACHE);await c.put(e.request,r.clone());const keys=await c.keys();const assets=keys.filter(k=>!SHELL.includes(new URL(k.url).pathname));if(assets.length>80)await c.delete(assets[0]);}return r;}).catch(async()=>await caches.match(e.request)||(e.request.mode==='navigate'?await caches.match('/index.html'):Response.error())));});`,
);
console.log("PWA: shell and selective runtime cache generated.");
