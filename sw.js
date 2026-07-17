/* NhàXe Pro — Service Worker (offline-first)
   - HTML điều hướng: network-first (luôn lấy bản mới, offline thì dùng cache)
   - Tài nguyên CDN tĩnh (Firebase SDK, cdnjs...): cache-first
   - Firestore / Auth / VietQR: KHÔNG cache (luôn ra mạng) */
const CACHE = 'nhaxe-pro-v1';
const STATIC_HOSTS = ['www.gstatic.com','cdnjs.cloudflare.com','fonts.googleapis.com','fonts.gstatic.com'];
const BYPASS = ['firestore.googleapis.com','firebaseio.com','identitytoolkit.googleapis.com',
  'securetoken.googleapis.com','www.googleapis.com','firebaseinstallations.googleapis.com','img.vietqr.io','api.vietqr.io'];

self.addEventListener('install', e=>{ self.skipWaiting(); });
self.addEventListener('activate', e=>{
  e.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e=>{
  const req=e.request;
  if(req.method!=='GET'){ return; }
  let url; try{ url=new URL(req.url); }catch(_){ return; }

  // Bỏ qua Firestore/Auth/VietQR — luôn ra mạng
  if(BYPASS.some(h=>url.hostname.includes(h))){ return; }

  // HTML điều hướng: network-first
  const isNav = req.mode==='navigate' || (req.headers.get('accept')||'').includes('text/html');
  if(isNav){
    e.respondWith((async()=>{
      try{
        const net=await fetch(req);
        const c=await caches.open(CACHE); c.put(req, net.clone());
        return net;
      }catch(err){
        const cached=await caches.match(req); if(cached) return cached;
        const any=await caches.match('./'); if(any) return any;
        return new Response('<h1>Ngoại tuyến</h1><p>Không có kết nối mạng.</p>',{headers:{'Content-Type':'text/html; charset=utf-8'}});
      }
    })());
    return;
  }

  // CDN tĩnh: cache-first
  if(STATIC_HOSTS.some(h=>url.hostname.includes(h))){
    e.respondWith((async()=>{
      const cached=await caches.match(req); if(cached) return cached;
      try{ const net=await fetch(req); if(net&&net.status===200){ const c=await caches.open(CACHE); c.put(req, net.clone()); } return net; }
      catch(err){ return cached||Response.error(); }
    })());
    return;
  }

  // Mặc định: network, fallback cache
  e.respondWith((async()=>{
    try{ return await fetch(req); }catch(err){ const cached=await caches.match(req); return cached||Response.error(); }
  })());
});
