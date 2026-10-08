/* Radar da Eleição · cache local para abrir rápido.
   - Dados que não mudam (mapas, histórico, eleições passadas, marca): do cache, buscando na rede só na primeira vez.
   - Resumos que podem mudar durante uma apuração (mapa/): mostra o do cache e atualiza em segundo plano.
   - Página, estilos e scripts: rede primeiro (atualizações chegam na hora); cache só se estiver sem internet.
   - Resultados ao vivo do TSE e o contador: nunca passam pelo cache. */
const VERSAO = 'radar-v1';
const FIXOS = /\/(geo|hist|zona|resumo|partido|mun|eleitosmun|marca)\//;
const VIVOS_LOCAIS = /\/mapa\//;

self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim())
));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  const doSite = u.origin === self.location.origin;
  const dados2022 = u.hostname === 'apuracao2026-dados.apuracao2026.workers.dev';
  if (!doSite && !dados2022) return;            // TSE ao vivo, contador, anúncios: direto da rede
  if (dados2022 || FIXOS.test(u.pathname)) return e.respondWith(doCache(req));
  if (VIVOS_LOCAIS.test(u.pathname)) return e.respondWith(cacheEAtualiza(e, req));
  e.respondWith(redePrimeiro(req));
});

async function doCache(req) {
  const c = await caches.open(VERSAO);
  const hit = await c.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok) c.put(req, r.clone());
  return r;
}
async function cacheEAtualiza(e, req) {
  const c = await caches.open(VERSAO);
  const hit = await c.match(req, { ignoreSearch: true });
  const rede = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
  if (hit) { e.waitUntil(rede); return hit; }
  return rede;
}
async function redePrimeiro(req) {
  const c = await caches.open(VERSAO);
  try {
    const r = await fetch(req);
    if (r.ok) c.put(req, r.clone());
    return r;
  } catch (err) {
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}
