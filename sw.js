/* Service worker del comparador Tren o bus Salamanca–Madrid.
   - Guarda la app en caché para abrirla sin conexión.
   - Muestra las notificaciones (en Android es obligatorio hacerlo desde aquí).
   - Revisa los avisos en segundo plano (periodicsync) y acepta mensajes push de un servidor. */
const VERSION="tb-v4";
const APP=["./","index.html","data.js","manifest.webmanifest","icons/icon.svg","icons/icon-192.png","icons/icon-512.png","icons/maskable-512.png","icons/badge-96.png"];
importScripts("data.js");

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(VERSION).then(c=>c.addAll(APP)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION&&k!=="tb-state").map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
// Primero la red (para recibir actualizaciones) y, sin conexión, la copia guardada.
self.addEventListener("fetch",e=>{
  const req=e.request; if(req.method!=="GET") return;
  const url=new URL(req.url);
  if(url.origin!==location.origin){ // fuentes de Google: caché si ya están
    e.respondWith(caches.match(req).then(r=>r||fetch(req).then(res=>{const cp=res.clone();caches.open(VERSION).then(c=>c.put(req,cp));return res;}).catch(()=>Response.error())));
    return;
  }
  e.respondWith(fetch(req).then(res=>{ if(res.ok){const cp=res.clone();caches.open(VERSION).then(c=>c.put(req,cp));} return res; })
    .catch(()=>caches.match(req,{ignoreSearch:true}).then(r=>r||caches.match("index.html"))));
});

/* ---------- Avisos en segundo plano ---------- */
async function readWatches(){
  const r=await (await caches.open("tb-state")).match("./__watches.json");
  return r ? r.json() : [];
}
async function writeWatches(ws){
  await (await caches.open("tb-state")).put("./__watches.json",new Response(JSON.stringify(ws),{headers:{"content-type":"application/json"}}));
  (await self.clients.matchAll({type:"window"})).forEach(c=>c.postMessage({type:"watches",watches:ws}));
}
const DOWS=["dom","lun","mar","mié","jue","vie","sáb"], MONS=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const OPS={renfe:"Renfe",monbus:"Monbus"};
const dayTxt=ds=>{const d=new Date(ds+"T12:00:00");return `${DOWS[d.getDay()]} ${d.getDate()} ${MONS[d.getMonth()]}`;};

async function checkWatchesInBackground(){
  const ws=await readWatches(); if(!ws.length) return;
  const today=ymd(new Date()); let changed=false;
  for(const w of ws){
    if(w.date<today) continue;
    const t=(await DataSource.getDepartures(w.from,w.to,w.date)).find(x=>x.id===w.id); if(!t) continue;
    const free=t.capacity-t.occupied;
    if(free>0&&!w.freedAt){
      const now=new Date(); w.freedAt=toHM(now.getHours()*60+now.getMinutes()); changed=true;
      await self.registration.showNotification(`Plaza libre: ${OPS[w.op]} ${w.dep}`,{
        body:`${w.from} → ${w.to}, ${dayTxt(w.date)}. Queda ${free} plaza${free>1?"s":""}.`,
        tag:w.key, renotify:true, requireInteraction:true, icon:"icons/icon-192.png", badge:"icons/badge-96.png",
        vibrate:[200,100,200], data:{key:w.key}});
    } else if(free<=0&&w.freedAt){ w.freedAt=null; changed=true; }
  }
  if(changed) await writeWatches(ws);
}
self.addEventListener("periodicsync",e=>{ if(e.tag==="check-seats") e.waitUntil(checkWatchesInBackground()); });

// Push desde un servidor: si trae título lo muestra; si no, revisa los avisos.
self.addEventListener("push",e=>{
  let d={}; try{ d=e.data?e.data.json():{}; }catch(_){ d={body:e.data&&e.data.text()}; }
  e.waitUntil(d.title
    ? self.registration.showNotification(d.title,{body:d.body||"",tag:d.key||d.title,icon:"icons/icon-192.png",badge:"icons/badge-96.png",vibrate:[200,100,200],data:{key:d.key}})
    : checkWatchesInBackground());
});

// Al tocar la notificación: abre la app (o la trae al frente) en esa salida.
self.addEventListener("notificationclick",e=>{
  e.notification.close();
  const key=e.notification.data&&e.notification.data.key;
  const url=new URL(key?`./?aviso=${encodeURIComponent(key)}`:"./",self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>{
    for(const c of cs){ if("focus" in c){ return c.navigate(url).then(x=>(x||c).focus()); } }
    return self.clients.openWindow(url);
  }));
});
