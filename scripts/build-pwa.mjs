import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

async function walk(dir, prefix = "") {
  const files = [];
  for (const file of await readdir(dir, { withFileTypes: true })) {
    const relative = prefix + file.name;
    if (file.isDirectory())
      files.push(...(await walk(join(dir, file.name), relative + "/")));
    else if (file.name !== "sw.js") files.push(relative);
  }
  return files;
}
const files = await walk("dist");
const hash = createHash("sha256");
for (const file of files) hash.update(await readFile(join("dist", file)));
const name = `cet6-${hash.digest("hex").slice(0, 12)}`;
await writeFile(
  "dist/sw.js",
  `const ROOT=new URL(self.registration.scope);
const PREFIX='cet6:'+ROOT.pathname+':';
const CACHE=PREFIX+${JSON.stringify(name)};
const FILES=${JSON.stringify(files)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(f=>new URL(f,ROOT).href)))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==ROOT.origin||!new URL(event.request.url).pathname.startsWith(ROOT.pathname))return;
 // All matched requests are same-origin static files; Vite's Vary: Origin must not defeat offline module lookups.
 event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request,{ignoreVary:true}).then(cached=>cached||fetch(event.request).catch(error=>{if(event.request.mode==='navigate')return cache.match(new URL('index.html',ROOT).href,{ignoreVary:true});throw error}))));
});
`,
);
console.log(
  `PWA: precached ${files.length} files (${name}); relative scope ready for GitHub Pages.`,
);
