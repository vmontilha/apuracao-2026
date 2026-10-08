'use strict';
/* ---------------- constantes ---------------- */
const T = 'https://resultados.tse.jus.br/oficial/ele2026';
const ELE = { '1': '6257', '3': '6259', '5': '6259', '6': '6259', '7': '6259', '8': '6259' };
const PLEITO = '3220';
// 2º turno: códigos "cdt2" da configuração do TSE (comum/config/ele-c.json); o pleito do arquivo de urnas
// do 2º turno é descoberto nessa mesma configuração quando o TSE publicar. ?simt2 na URL simula com os dados do 1º turno.
const SIMT2 = /[?&]simt2\b/.test(location.search);
const T2 = SIMT2 ? { '1': '6257', '3': '6259' } : { '1': '6258', '3': '6260' };
let PLEITO2 = SIMT2 ? PLEITO : '';
const temT2 = c => c === '1' || c === '3';
const tEf = c => (temT2(c) && S.turno === '2') ? '2' : '1';
const eleDo = (c, t = tEf(c)) => (t === '2' && T2[c]) ? T2[c] : ELE[c];
const pleitoDo = () => (S.turno === '2' && PLEITO2) ? PLEITO2 : PLEITO;
const CARGO_NM = { '1': 'Presidente', '3': 'Governador', '5': 'Senador', '6': 'Deputado Federal', '7': 'Deputado Estadual', '8': 'Deputado Distrital' };
const CARGO_PAINEL = { '1': 'presidente', '3': 'governador', '5': 'senador', '6': 'federal', '7': 'estadual', '8': 'distrital' };
const MAJ = c => c === '1' || c === '3' || c === '5';
const REG = {
  N:  { nm: 'Norte', ufs: ['ac','am','ap','pa','ro','rr','to'] },
  NE: { nm: 'Nordeste', ufs: ['al','ba','ce','ma','pb','pe','pi','rn','se'] },
  CO: { nm: 'Centro-Oeste', ufs: ['df','go','ms','mt'] },
  SE: { nm: 'Sudeste', ufs: ['es','mg','rj','sp'] },
  S:  { nm: 'Sul', ufs: ['pr','rs','sc'] },
};
const UF_NM = { ac:'Acre', al:'Alagoas', am:'Amazonas', ap:'Amapá', ba:'Bahia', ce:'Ceará', df:'Distrito Federal', es:'Espírito Santo',
  go:'Goiás', ma:'Maranhão', mg:'Minas Gerais', ms:'Mato Grosso do Sul', mt:'Mato Grosso', pa:'Pará', pb:'Paraíba', pe:'Pernambuco',
  pi:'Piauí', pr:'Paraná', rj:'Rio de Janeiro', rn:'Rio Grande do Norte', ro:'Rondônia', rr:'Roraima', rs:'Rio Grande do Sul',
  sc:'Santa Catarina', se:'Sergipe', sp:'São Paulo', to:'Tocantins' };
const regDe = uf => Object.keys(REG).find(r => REG[r].ufs.includes(uf));
// cor por partido (número do partido = 2 primeiros dígitos do candidato)
const COR_PARTIDO = { '13':'#e5383b', '22':'#3d7bf0', '55':'#a78bfa', '15':'#22a85a', '44':'#06b6d4', '11':'#6d8dfc', '10':'#14b8a6',
  '12':'#f97316', '40':'#fb7185', '45':'#7dd3fc', '30':'#ff8a1f', '50':'#facc15', '20':'#84cc16', '70':'#2dd4bf', '77':'#f472b6',
  '65':'#c81d25', '43':'#4ade80', '18':'#5eead4', '16':'#ef4444', '80':'#b91c1c', '29':'#9f1239', '21':'#dc2626', '14':'#94a3b8',
  '25':'#fbbf24', '35':'#e879f9', '36':'#c084fc', '33':'#a3e635', '27':'#38bdf8', '28':'#86efac', '19':'#fde047' };
function cor(n) {
  const p = String(n).slice(0, 2);
  if (COR_PARTIDO[p]) return COR_PARTIDO[p];
  let h = 0; for (const ch of p) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 65% 60%)`;
}

/* ---------------- utilidades ---------------- */
const $ = id => document.getElementById(id);
const num = v => v == null || v === '' ? 0 : Number(String(v).replace(',', '.'));
const fmt = n => Number(n || 0).toLocaleString('pt-BR');
const pc = (x, d = 1) => Number(x || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const pad = (n, w) => String(n).padStart(w, '0');
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const cap = s => String(s || '').toLowerCase().replace(/(^|[\s\-'(])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, w => w.toLowerCase());

// cache em memória: arquivos do TSE mudam no máximo a cada ~1 min durante a apuração
const cache = new Map();
function getJSON(url, ttl = 55000) {
  const c = cache.get(url);
  if (c && Date.now() - c.t < ttl) return c.p;
  const p = fetch(url).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  cache.set(url, { t: Date.now(), p });
  p.catch(() => cache.delete(url));
  return p;
}
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}

const cargoUF = (uf, c) => (uf === 'df' && c === '7') ? '8' : c;
function urlRes(uf, mun, c, t) { c = cargoUF(uf, c); const e = eleDo(c, t); return `${T}/${e}/dados/${uf}/${uf}${mun || ''}-c${pad(c, 4)}-e${pad(e, 6)}-u.json`; }
const urlBr = t => { const e = eleDo('1', t); return `${T}/${e}/dados/br/br-c0001-e${pad(e, 6)}-u.json`; };
const urlFoto = (c, uf, sq) => `${T}/${eleDo(c)}/fotos/${c === '1' ? 'br' : uf}/${sq}.jpeg`;

// candidatos de um arquivo de resultado do TSE
function cands(r) {
  const out = [];
  for (const g of r?.carg?.[0]?.agr || []) for (const p of g.par || []) for (const k of p.cand || [])
    out.push({ n: String(k.n), nm: k.nmu || k.nm, nmc: k.nm, sg: p.sg, v: num(k.vap), sq: k.sqcand, st: k.st || '', dvt: k.dvt || '' });
  return out.sort((a, b) => b.v - a.v);
}
function partidos(r) { // número do partido -> sigla e votos de legenda
  const m = new Map();
  for (const g of r?.carg?.[0]?.agr || []) for (const p of g.par || []) m.set(String(p.n), { sg: p.sg, leg: num(p.tval) });
  return m;
}

/* ---------------- boletim de urna (BER/ASN.1) ---------------- */
function tlv(b, i) {
  const t0 = b[i++]; let tag = t0 & 0x1f;
  if (tag === 0x1f) { tag = 0; let x; do { x = b[i++]; tag = tag * 128 + (x & 0x7f); } while (x & 0x80); }
  let l = b[i++];
  if (l & 0x80) { const n = l & 0x7f; l = 0; for (let k = 0; k < n; k++) l = l * 256 + b[i++]; }
  return { cls: t0 >> 6, cons: !!(t0 & 0x20), tag, s: i, e: i + l };
}
function kids(b, s, e) { const o = []; while (s < e) { const k = tlv(b, s); o.push(k); s = k.e; } return o; }
function int(b, k) { let v = 0; for (let i = k.s; i < k.e; i++) v = v * 256 + b[i]; if (k.e > k.s && b[k.s] & 0x80) v -= 256 ** (k.e - k.s); return v; }
const txt = (b, k) => String.fromCharCode(...b.subarray(k.s, k.e));
const tam = k => k.e - k.s;
function lerBU(b) {
  const env = tlv(b, 0);
  const oc = kids(b, env.s, env.e).filter(k => k.cls === 0 && !k.cons && k.tag === 4).sort((x, y) => tam(y) - tam(x))[0];
  const bu = tlv(b, oc.s), top = kids(b, bu.s, bu.e);
  const out = { cargos: {} };
  for (const k of top) if (k.cls === 2 && k.cons && k.tag === 0) {
    const d = kids(b, k.s, k.e).filter(x => x.tag === 27).map(x => txt(b, x)); out.abertura = d[0]; out.encerramento = d[1];
  }
  const seqs = top.filter(k => k.cls === 0 && k.cons && k.tag === 16);
  for (const k of seqs) {
    const f = kids(b, k.s, k.e);
    if (f.length >= 3 && f[0].cons && f.slice(1).every(x => x.tag === 2)) {
      const mz = kids(b, f[0].s, f[0].e);
      if (mz.length === 2) { out.mun = int(b, mz[0]); out.zona = int(b, mz[1]); out.local = int(b, f[1]); out.secao = int(b, f[2]); }
    }
  }
  const res = seqs.reduce((a, c) => tam(c) > tam(a) ? c : a);
  for (const el of kids(b, res.s, res.e)) {
    const f = kids(b, el.s, el.e), aptos = int(b, f[1]), rvs = f.find(x => x.cons);
    if (!rvs) continue;
    for (const rv of kids(b, rvs.s, rvs.e)) {
      const g = kids(b, rv.s, rv.e), compar = int(b, g[1]), tots = g.find(x => x.cons);
      if (!tots) continue;
      for (const tc of kids(b, tots.s, tots.e)) {
        const h = kids(b, tc.s, tc.e);
        let cod = h[0]; if (cod.cons) cod = kids(b, cod.s, cod.e)[0];
        const vl = h.find(x => x.cons && x.cls === 0 && x.tag === 16);
        const C = { aptos, compar, nom: {}, leg: {}, branco: 0, nulo: 0, outros: 0 };
        for (const vv of vl ? kids(b, vl.s, vl.e) : []) {
          let tipo = 0, q = 0, id = null;
          for (const x of kids(b, vv.s, vv.e)) {
            if (x.cls !== 2) continue;
            if (x.tag === 1) tipo = int(b, x); else if (x.tag === 2) q = int(b, x);
            else if (x.tag === 3 && x.cons) id = kids(b, x.s, x.e).map(y => int(b, y));
          }
          if (tipo === 1 && id) C.nom[id[1]] = (C.nom[id[1]] || 0) + q;
          else if (tipo === 4 && id) C.leg[id[0]] = (C.leg[id[0]] || 0) + q;
          else if (tipo === 2) C.branco += q; else if (tipo === 3) C.nulo += q; else C.outros += q;
        }
        out.cargos[String(int(b, cod))] = C;
      }
    }
  }
  return out;
}
const dirSecao = (uf, mun, z, s) => `${T}/arquivo-urna/${pleitoDo()}/dados/${uf}/${mun}/${z}/${s}`;
const secCache = new Map();
function secao(uf, mun, z, s) {
  const key = [pleitoDo(), uf, mun, z, s].join('/');
  if (secCache.has(key)) return secCache.get(key);
  const p = (async () => {
    const dir = dirSecao(uf, mun, z, s);
    const aux = await getJSON(`${dir}/p00${pleitoDo()}-${uf}-m${mun}-z${z}-s${s}-aux.json`, 10 * 60000);
    const arqDe = h => (h.arq || h.nmarq || []).map(a => typeof a === 'string' ? a : a.nm);
    const h = [...(aux.hashes || [])].reverse().find(h => arqDe(h).some(n => /-bu\.dat$/i.test(n)));
    if (!h) return { st: aux.st || 'sem boletim', semBU: true };
    const arqs = arqDe(h), nm = arqs.find(n => /-bu\.dat$/i.test(n));
    const r = await fetch(`${dir}/${h.hash}/${nm}`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const bu = lerBU(new Uint8Array(await r.arrayBuffer()));
    return Object.assign(bu, { st: h.st || aux.st, base: `${dir}/${h.hash}/`, arqs });
  })();
  secCache.set(key, p);
  p.catch(() => secCache.delete(key));
  return p;
}

/* ---------------- estado da navegação ---------------- */
const S = { reg: '', uf: '', mun: '', zona: '', sec: '', cargo: '1', cand: '', geo: null, geoUf: '', mapa: null, br: null };
function lerHash() {
  const [cam, q] = location.hash.replace(/^#\/?/, '').split('?');
  const p = cam.split('/').filter(Boolean);
  const c = new URLSearchParams(q || '').get('c');
  Object.assign(S, { reg: '', uf: '', mun: '', zona: '', sec: '' });
  S.aba = ['congresso', 'partidos', 'historico', 'comparar'].includes(p[0]) ? p[0] : 'mapa';
  S.q = new URLSearchParams(q || '');
  if (S.aba !== 'mapa') return;
  if (p[0] && REG[p[0].toUpperCase()]) S.reg = p[0].toUpperCase();
  else if (p[0] && UF_NM[p[0]]) { S.uf = p[0]; S.reg = regDe(S.uf); S.mun = p[1] || ''; S.zona = p[2] ? pad(p[2], 4) : ''; S.sec = p[3] ? pad(p[3], 4) : ''; }
  S.cargo = c && CARGO_NM[c] ? c : '1';
  S.cand = new URLSearchParams(q || '').get('k') || '';
  const tq = new URLSearchParams(q || '').get('t');
  S.turnoQ = tq === '1' || tq === '2' ? tq : '';
  S.turno = S.turnoQ || (S.t2vivo ? '2' : '1');
  const a = new URLSearchParams(q || '').get('a'); S.anoCmp = ['2022', '2018', '2014'].includes(a) ? a : '2022';
}
function hashDe(o = {}) {
  const x = { ...S, ...o };
  const p = x.uf ? [x.uf, x.mun, x.zona, x.sec].filter(Boolean) : (x.reg ? [x.reg] : []);
  const qs = [x.cargo !== '1' ? 'c=' + x.cargo : '', x.cand ? 'k=' + x.cand : '', x.anoCmp && x.anoCmp !== '2022' ? 'a=' + x.anoCmp : '', x.turnoQ ? 't=' + x.turnoQ : ''].filter(Boolean).join('&');
  return '#/' + p.join('/') + (qs ? '?' + qs : '');
}
const nivel = () => S.sec ? 'sec' : S.zona ? 'zona' : S.mun ? 'mun' : S.uf ? 'uf' : S.reg ? 'reg' : 'br';
const vaiPara = o => { location.hash = hashDe(o); };

/* ---------------- mapa ---------------- */
const svg = $('map'), tip = $('tip');
let vb = [0, 0, 1000, 1000], anim = 0;
function zoom(alvo, rapido) {
  cancelAnimationFrame(anim);
  const fonte = () => svg.style.setProperty('--fs', (Math.max(vb[2], vb[3]) * (nivel() === 'reg' ? .028 : .025)).toFixed(1) + 'px');
  if (rapido || matchMedia('(prefers-reduced-motion: reduce)').matches) { vb = alvo; svg.setAttribute('viewBox', vb.join(' ')); fonte(); return; }
  const de = vb.slice(), t0 = performance.now(), dur = 550;
  const passo = t => {
    const k = Math.min(1, (t - t0) / dur), e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    vb = de.map((v, i) => v + (alvo[i] - v) * e);
    svg.setAttribute('viewBox', vb.join(' ')); fonte();
    if (k < 1) anim = requestAnimationFrame(passo);
  };
  anim = requestAnimationFrame(passo);
}
function caixa(els, folga = 0.06, min = 0) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const el of els) { const b = el.getBBox(); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height); }
  let w = x1 - x0, h = y1 - y0;
  if (w < min) { x0 -= (min - w) / 2; w = min; }
  if (h < min) { y0 -= (min - h) / 2; h = min; }
  const m = Math.max(w, h) * folga;
  return [x0 - m, y0 - m, w + 2 * m, h + 2 * m];
}
async function desenhar() {
  const alvo = S.uf || 'br';
  if (S.geoUf === alvo) return false;
  $('mapLoading').textContent = 'carregando mapa…';
  const g = await getJSON(`geo/${alvo}.json`, Infinity);
  $('mapLoading').textContent = '';
  S.geo = g; S.geoUf = alvo;
  let h = '';
  if (alvo === 'br') {
    for (const e of g.estados) h += `<path data-uf="${e.uf}" d="${e.d}"/>`;
    const desloca = { go: [-24, 26], df: [26, -10] }; // afasta rótulos que se sobrepõem
    for (const e of g.estados) { const [dx, dy] = desloca[e.uf] || [0, 0]; h += `<text x="${e.c[0] + dx}" y="${e.c[1] + dy}" text-anchor="middle" dy=".35em" data-uf="${e.uf}">${e.uf.toUpperCase()}</text>`; }
  } else {
    for (const m of g.mu) h += `<path data-t="${m.t}" d="${m.d}"/>`;
  }
  svg.innerHTML = h;
  zoom([0, 0, g.w, g.h], true);
  return true;
}
function enquadrar(novo) {
  const n = nivel();
  if (n === 'br') return zoom([0, 0, S.geo.w, S.geo.h], novo);
  if (n === 'reg') return zoom(caixa(REG[S.reg].ufs.map(u => svg.querySelector(`[data-uf="${u}"]`)).filter(Boolean)), novo);
  if (n === 'uf') return zoom([0, 0, S.geo.w, S.geo.h], novo);
  const el = svg.querySelector(`[data-t="${S.mun}"]`);
  if (el) zoom(caixa([el], 0.35, Math.max(S.geo.w, S.geo.h) * 0.18), novo);
}
function destacar() {
  const n = nivel();
  svg.querySelectorAll('path').forEach(p => {
    const uf = p.dataset.uf, t = p.dataset.t;
    p.classList.toggle('fora', n === 'reg' && uf && !REG[S.reg].ufs.includes(uf));
    p.classList.toggle('sel', !!S.mun && t === S.mun);
  });
  const sel = svg.querySelector('path.sel'); if (sel) svg.insertBefore(sel, svg.querySelector('text'));
  svg.querySelectorAll('text[data-uf]').forEach(t => {
    const u = t.dataset.uf, dentro = n === 'reg' && REG[S.reg].ufs.includes(u);
    t.textContent = dentro && !['df', 'se', 'al', 'rn', 'pb', 'es', 'rj'].includes(u) ? UF_NM[u] : u.toUpperCase();
    t.classList.toggle('oculto', n === 'reg' && !dentro);
  });
  $('back').hidden = n === 'br';
}

// cor de cada área: líder do cargo, mais forte quanto maior a vantagem
function pinta(el, lider, share) {
  if (!lider) { el.style.fill = ''; el.style.fillOpacity = ''; return; }
  el.style.fill = cor(lider);
  el.style.fillOpacity = String(Math.max(.38, Math.min(1, .38 + (share - .3) * 1.6)));
}
async function colorir() {
  const legenda = new Map();
  if (S.geoUf === 'br' && !MAJ(S.cargo)) {
    // deputados no mapa do Brasil: cada estado pela maioria (esquerda/centro/direita) dos eleitos
    const [R] = await Promise.all([resumo('2026'), resumo(S.anoCmp)]).catch(() => [null]);
    if (!R || S.geoUf !== 'br' || MAJ(S.cargo)) return;
    for (const p of svg.querySelectorAll('path[data-uf]')) {
      const l = eleitosUF(R, p.dataset.uf), c = contaLados(l), tot = l.length || 1;
      const maior = ORDEM_LADO.reduce((a, b) => c[b] > c[a] ? b : a, 'centro');
      p.style.fill = LADO_COR[maior];
      p.style.fillOpacity = String(.3 + .7 * Math.min(1, (c[maior] / tot - .33) / .5));
    }
    $('legend').innerHTML = ORDEM_LADO.map(l => `<span><i class="sw" style="background:${LADO_COR[l]}"></i>${LADO_NM[l]}</span>`).join('')
      + `<span style="margin-left:auto;color:var(--muted)">maioria dos ${S.cargo === '6' ? 'deputados federais' : 'deputados estaduais'} eleitos em cada estado</span>`;
    return;
  }
  if (S.geoUf === 'br') {
    const c = S.cargo;
    await carregarEstados(c, () => colorir());
    if (tEf(c) === '2') carregarEstados(c, null, '1');
    const Rant = await resumo(S.anoCmp).catch(() => null); S.Rant = Rant;
    for (const p of svg.querySelectorAll('path[data-uf]')) {
      const r = S.ufRes?.[ufKey(c)]?.[p.dataset.uf];
      const l = r && cands(r)[0];
      const vv = r ? num(r.v?.vv) : 0;
      pinta(p, l && l.v ? l.n : '', l && vv ? l.v / vv : 0);
      if (l && l.v) legenda.set(l.n, `${cap(l.nm)} (${l.sg})`);
    }
  } else if (!MAJ(S.cargo)) {
    const D = await dep(S.uf, S.cargo).catch(() => null);
    if (!D || S.geoUf !== D.uf || cargoUF(S.uf, S.cargo) !== D.cargo) return;
    const k = S.cand && D.porN.get(S.cand);
    if (k) {
      // mancha do candidato escolhido: mais forte onde ele teve maior % dos votos da cidade
      let max = 0;
      for (const cd in D.mu) { const m = D.mu[cd]; max = Math.max(max, m.vv ? votosEm(m, k.i) / m.vv : 0); }
      for (const p of svg.querySelectorAll('path[data-t]')) {
        const m = D.mu[p.dataset.t], v = m ? votosEm(m, k.i) : 0;
        if (!v) { p.style.fill = ''; p.style.fillOpacity = ''; continue; }
        p.style.fill = cor(k.n);
        p.style.fillOpacity = String(.15 + .85 * Math.sqrt((v / m.vv) / (max || 1)));
      }
      $('legend').innerHTML = `<span><i class="sw" style="background:${cor(k.n)}"></i>${esc(cap(k.nm))} (${esc(k.sg)}) · mais forte = maior % dos votos da cidade</span>
        <span style="margin-left:auto;color:var(--muted)">máx. ${pc(max * 100)}</span>`;
      return;
    }
    const conta = new Map();
    for (const p of svg.querySelectorAll('path[data-t]')) {
      const m = D.mu[p.dataset.t];
      if (!m || !m.l.length) { pinta(p, '', 0); continue; }
      const l = D.cands[m.l[0]];
      p.style.fill = cor(l.n);
      p.style.fillOpacity = String(Math.max(.35, Math.min(1, .35 + (m.l[1] / (m.vv || 1)) * 2.5)));
      conta.set(l.i, (conta.get(l.i) || 0) + 1);
    }
    const top = [...conta].sort((a, b) => b[1] - a[1]);
    $('legend').innerHTML = top.slice(0, 8).map(([i, q]) => { const l = D.cands[i]; return `<span><i class="sw" style="background:${cor(l.n)}"></i>${esc(cap(l.nm))} (${esc(l.sg)}) · ${q}</span>`; }).join('')
      + (top.length > 8 ? `<span>+ ${top.length - 8}</span>` : '')
      + `<span style="margin-left:auto;color:var(--muted)">mais votado em cada cidade · ${CARGO_NM[cargoUF(S.uf, S.cargo)]}</span>`;
    return;
  } else {
    const M = mapaAtual(), c = S.cargo;
    for (const p of svg.querySelectorAll('path[data-t]')) {
      const d = M?.mu?.[p.dataset.t]?.[c];
      const l = d && d[2][0];
      pinta(p, l ? l[0] : '', l && d[1] ? l[1] / d[1] : 0);
      if (l) { const nm = M.nomes[c]?.[l[0]]; legenda.set(l[0], nm ? `${cap(nm[0])} (${nm[1]})` : l[0]); }
    }
  }
  $('legend').innerHTML = [...legenda].map(([n, t]) => `<span><i class="sw" style="background:${cor(n)}"></i>${esc(t)}</span>`).join('')
    + (S.geoUf !== 'br' && mapaAtual() ? `<span style="margin-left:auto;color:var(--muted)">líder em cada cidade · ${CARGO_NM[S.cargo]}</span>` : '');
}

/* ---------------- deputados por cidade (arquivos estáticos mapa/<uf>-c<cargo>.json) ---------------- */
const DEPS = new Map();
function dep(uf, c) {
  c = cargoUF(uf, c);
  const key = uf + '-c' + c;
  if (!DEPS.has(key)) DEPS.set(key, getJSON(`mapa/${key}.json`, 5 * 60000).then(d => {
    const cands = d.cands.map(([n, nm, sg, nmc], i) => ({ i, n, nm, sg, nmc, v: 0 }));
    const mu = {};
    let vv = 0, pstT = 0, pesoT = 0;
    for (const cd in d.mu) {
      const a = d.mu[cd], l = a.slice(2), m = { pst: a[0], vv: a[1], l, rank: null };
      for (let j = 0; j < l.length; j += 2) cands[l[j]].v += l[j + 1];
      vv += m.vv; mu[cd] = m;
    }
    const ord = [...cands].sort((a, b) => b.v - a.v);
    ord.forEach((k, j) => { k.pos = j + 1; });
    return { uf, cargo: c, cands, ord, mu, vv, porN: new Map(cands.map(k => [k.n, k])) };
  }));
  const p = DEPS.get(key); p.catch(() => DEPS.delete(key));
  return p;
}
function votosEm(m, i) { for (let j = 0; j < m.l.length; j += 2) if (m.l[j] === i) return m.l[j + 1]; return 0; }
function posEm(m, i) { for (let j = 0; j < m.l.length; j += 2) if (m.l[j] === i) return j / 2 + 1; return 0; }

// histórico de uma eleição anterior (hist/<ano>/<uf>.json), indexado pelo nome completo do candidato
const HIST = new Map();
const chaveNome = s => norm(s).replace(/\s+/g, ' ').trim();
function histUF(ano, uf) {
  const key = ano + '/' + uf;
  if (!HIST.has(key)) HIST.set(key, getJSON(`hist/${ano}/${uf}.json`, Infinity).then(d => {
    const by = new Map(), lista = [];
    for (const c of d.c) {
      const o = { nm: c[0], nmu: c[1], n: c[2], sg: c[3], cargo: c[4], turno: c[5], sit: c[6], total: c[7], mun: c[8], ano };
      lista.push(o);
      const k = chaveNome(c[0]); (by.get(k) || by.set(k, []).get(k)).push(o);
    }
    by.lista = lista; by.ano = ano;
    return by;
  }).catch(() => { const m = new Map(); m.lista = []; m.ano = ano; return m; }));
  return HIST.get(key);
}
const h22 = uf => histUF(S.anoCmp || '2022', uf);
function hist(by, k, c) {
  const a = by && by.get(chaveNome(k.nmc || k.nm));
  if (!a) return null;
  const t1 = a.filter(x => x.turno === '1');
  return t1.find(x => x.cargo === c) || (t1.length ? t1 : a).reduce((x, y) => y.total > x.total ? y : x);
}
// votos de um cargo/turno numa cidade (ou no estado) por partido atual, para comparar majoritários pelo partido
function partidosEm(by, cargo, turno, cd) {
  const m = new Map(); let tot = 0;
  for (const o of by?.lista || []) {
    if (o.cargo !== cargo || o.turno !== turno) continue;
    const v = cd ? (o.mun[cd] || 0) : o.total;
    if (!v) continue;
    tot += v;
    const p = atual(o.sg); m.set(p, (m.get(p) || 0) + v);
  }
  return { m, tot };
}
const CARGO_TXT = { '1': 'Presidente', '3': 'Governador', '5': 'Senador', '6': 'Dep. Federal', '7': 'Dep. Estadual', '8': 'Dep. Distrital' };
// variação contra o que 2022 "prevê" com a mesma % de seções apuradas
function delta(atual, v22, pst) {
  const esp = v22 * (pst == null ? 1 : pst / 100);
  if (!esp) return '';
  const d = (atual / esp - 1) * 100;
  return `<span style="color:${d >= 0 ? 'var(--good-text)' : 'var(--critical)'};font-weight:600">${d >= 0 ? '▲ +' : '▼ '}${pc(d)}</span>`;
}
S.H = null; // índice de 2022 do estado aberto

// resultados por estado (para o mapa do Brasil e os painéis de região)
S.ufRes = {};
const carregando = new Set();
const ufKey = (c, t = tEf(c)) => c + '|' + t;
async function carregarEstados(c, depois, t = tEf(c)) {
  const k = ufKey(c, t);
  S.ufRes[k] = S.ufRes[k] || {};
  const falta = Object.keys(UF_NM).filter(uf => !S.ufRes[k][uf]);
  if (!falta.length || carregando.has(k)) return;
  carregando.add(k);
  pool(falta, 8, async uf => { try { S.ufRes[k][uf] = await getJSON(urlRes(uf, '', c, t)); } catch (e) {} })
    .then(() => { carregando.delete(k); if (S.cargo === c) { depois && depois(); if (nivel() === 'br' || nivel() === 'reg') painel(); } });
}

// resumo das cidades do turno em exibição
const mapaAtual = () => tEf(S.cargo) === '2' ? (S.mapa2?.uf === S.uf ? S.mapa2 : null) : S.mapa;
// 2º turno x 1º turno de 2026 para o mesmo candidato (pelo número)
function cmpT1(n, share, ant) {
  if (ant == null) return '';
  return `<span style="color:var(--muted)">1º turno: ${pc(ant * 100, 1)}</span> ${pp(share, ant)}`;
}
function shareT1Estado(uf, c, n) {
  const r = S.ufRes?.[ufKey(c, '1')]?.[uf]; if (!r) return null;
  const k = cands(r).find(x => x.n === n), vv = num(r.v?.vv);
  return k && vv ? k.v / vv : null;
}
function shareT1Cidade(cd, c, n) {
  const d = S.mapa?.mu?.[cd]?.[c]; if (!d || !d[1]) return null;
  const x = d[2].find(y => y[0] === n);
  return x ? x[1] / d[1] : null;
}
// descobre se o 2º turno já começou (arquivo nacional de presidente do 2º turno publicado pelo TSE)
async function detectaT2() {
  try {
    if (!SIMT2) {
      const cfg = await getJSON('https://resultados.tse.jus.br/oficial/comum/config/ele-c.json', 5 * 60000);
      for (const p of cfg.pl || []) if ((p.e || []).some(e => e.cd === T2['1'])) PLEITO2 = p.cd;
    }
    const r = await getJSON(urlBr('2'), 60000);
    const ok = !!r, vivo = num(r?.s?.st) > 0 || SIMT2;
    if (ok !== S.t2ok || vivo !== S.t2vivo) {
      S.t2ok = ok; S.t2vivo = vivo;
      if (S.aba === 'mapa') { ir(); nacional(); }
    }
  } catch (e) { /* 2º turno ainda não publicado */ }
}
setInterval(() => { if (!document.hidden) detectaT2(); }, 5 * 60000);

/* comparações com a eleição anterior */
const cargoDep = (uf, c) => (uf === 'df' && c === '7') ? '8' : c;
function eleitosUF(R, uf, c = S.cargo) {
  return (R?.uf?.[uf]?.[`c${cargoDep(uf, c)}t1`]?.eleitos || []).map(e => ({ nm: e[0], sg: e[1], n: e[2], v: e[3], uf }));
}
// parcela de cada partido (atual) num resumo de cargo/turno
function fatias(g) {
  const m = new Map(); if (!g) return m;
  for (const [sg, [v]] of Object.entries(g.part)) { const p = atual(sg); m.set(p, (m.get(p) || 0) + v / (g.tot || 1)); }
  return m;
}
const pp = (a, b) => { if (b == null) return ''; const d = (a - b) * 100; return `<span class="${d >= 0 ? 'up' : 'dn'}">${d >= 0 ? '▲' : '▼'} ${pc(Math.abs(d), 1).replace('%', '')} p.p.</span>`; };
// linha de comparação de um candidato majoritário: partido dele na eleição anterior
function cmpMaj(sg, share, ant, ant2) {
  const p = atual(sg), a = ant?.get(p), b = ant2?.get(p);
  if (a == null && b == null) return `<span style="color:var(--muted)">${S.anoCmp}: partido sem candidato</span>`;
  return `<span style="color:var(--muted)">${S.anoCmp}: ${a != null ? pc(a * 100, 1) : '—'}</span> ${a != null ? pp(share, a) : ''}${b != null ? ` <span style="color:var(--muted)">· 2º turno ${pc(b * 100, 1)}</span>` : ''}`;
}
function partCidade(by, c, turno, cd) {
  const { m, tot } = partidosEm(by, c, turno, cd);
  if (!tot) return null;
  const out = new Map(); for (const [p, v] of m) out.set(p, v / tot);
  return out;
}

/* tooltip */
function tipDep(p) {
  const D = S.depAtual, m0 = S.geo.mu.find(x => x.t === p.dataset.t);
  let h = `<b>${esc(cap(m0?.n))}</b>`;
  if (!D || D.uf !== S.uf || D.cargo !== cargoUF(S.uf, S.cargo)) return h + '<span style="color:var(--muted)">carregando…</span>';
  const m = D.mu[p.dataset.t];
  if (!m) return h + '<span style="color:var(--muted)">sem dados</span>';
  const c = D.cargo, k = S.cand && D.porN.get(S.cand);
  const linha22 = (cand, v) => {
    const H = hist(S.H, cand, c);
    if (!S.H) return '';
    if (!H) return `<span style="color:var(--muted)">não concorreu em ${S.anoCmp}</span>`;
    const v22 = H.mun[p.dataset.t] || 0;
    return `<span style="color:var(--muted)">${S.anoCmp}${H.cargo !== c ? ' (' + CARGO_TXT[H.cargo] + ')' : ''}: ${fmt(v22)}</span> ${delta(v, v22, m.pst)}`;
  };
  if (k) {
    const v = votosEm(m, k.i), pos = posEm(m, k.i);
    return h + `<i class="sw" style="background:${cor(k.n)}"></i>${esc(cap(k.nm))} (${esc(k.sg)})<br>
      <b style="display:inline;font-size:15px">${fmt(v)}</b> votos · ${pc(m.vv ? v / m.vv * 100 : 0, 2)} da cidade${pos ? ` · ${pos}º` : ''}<br>${linha22(k, v)}`;
  }
  const lin = [];
  for (let j = 0; j < Math.min(m.l.length, 10); j += 2) {
    const kk = D.cands[m.l[j]], v = m.l[j + 1];
    lin.push(`<i class="sw" style="background:${cor(kk.n)}"></i>${esc(cap(kk.nm))} <span style="color:var(--muted)">${esc(kk.sg)}</span> · ${fmt(v)} (${pc(m.vv ? v / m.vv * 100 : 0)})<br><span style="margin-left:15px"></span>${linha22(kk, v)}`);
  }
  return h + lin.join('<br>') + `<br><span style="color:var(--muted)">${fmt(m.vv)} votos válidos · ${pc(m.pst, 1)} apurado</span>`;
}
function tipHtml(p) {
  if (p.dataset.t && !MAJ(S.cargo)) return tipDep(p);
  let h = '';
  if (p.dataset.uf && !MAJ(S.cargo)) {
    const uf = p.dataset.uf;
    h = `<b>${UF_NM[uf]}</b>`;
    const R = RESUMO['2026']?.v, Ra = RESUMO[S.anoCmp]?.v;
    if (!R) return h + 'carregando…';
    const l = eleitosUF(R, uf), la = Ra ? eleitosUF(Ra, uf) : [];
    const c = contaLados(l), ca = contaLados(la);
    h += `${l.length} ${S.cargo === '6' ? 'deputados federais' : 'deputados estaduais'}<br>` + ORDEM_LADO.map(x => `<i class="sw" style="background:${LADO_COR[x]}"></i>${LADO_NM[x]}: <b style="display:inline">${c[x]}</b> ${la.length ? `<span class="${c[x] - ca[x] >= 0 ? 'up' : 'dn'}">(${c[x] - ca[x] >= 0 ? '+' : ''}${c[x] - ca[x]})</span>` : ''}`).join('<br>');
    const cp = [...contaPart(l)].sort((a, b) => b[1] - a[1]).slice(0, 4), cpa = contaPart(la);
    h += `<br><span style="color:var(--muted)">${cp.map(([s, q]) => `${s} ${q}${la.length ? ` (${q - (cpa.get(s) || 0) >= 0 ? '+' : ''}${q - (cpa.get(s) || 0)})` : ''}`).join(' · ')}</span>`;
    return h + `<br><span style="color:var(--muted)">entre parênteses: diferença para ${S.anoCmp}</span>`;
  }
  if (p.dataset.uf) {
    const uf = p.dataset.uf, r = S.ufRes?.[ufKey(S.cargo)]?.[uf];
    h = `<b>${UF_NM[uf]}</b>`;
    if (r) {
      const vv = num(r.v?.vv), g = S.Rant?.uf?.[uf];
      const a1 = fatias(g?.[`c${S.cargo}t1`]), a2 = g?.[`c${S.cargo}t2`] ? fatias(g[`c${S.cargo}t2`]) : null;
      h += cands(r).slice(0, 3).map(k => { const s = vv ? k.v / vv : 0; return `<i class="sw" style="background:${cor(k.n)}"></i>${esc(cap(k.nm))} <span style="color:var(--muted)">${esc(k.sg)}</span> · ${pc(s * 100)}<br><span style="margin-left:15px"></span>${tEf(S.cargo) === '2' ? cmpT1(k.n, s, shareT1Estado(uf, S.cargo, k.n)) : S.Rant ? cmpMaj(k.sg, s, a1, a2) : ''}`; }).join('<br>')
        + `<br><span style="color:var(--muted)">${pc(num(r.s?.pstn), 2)} das seções</span>`;
    }
  } else {
    const m = S.geo.mu.find(x => x.t === p.dataset.t);
    const c = S.cargo;
    const M = mapaAtual(), d = M?.mu?.[p.dataset.t]?.[c];
    h = `<b>${esc(cap(m?.n))}</b>`;
    const a1 = S.H ? partCidade(S.H, c, '1', p.dataset.t) : null, a2 = S.H ? partCidade(S.H, c, '2', p.dataset.t) : null;
    if (d) h += d[2].slice(0, 3).map(([n, v]) => {
      const nm = M.nomes[c]?.[n], s = d[1] ? v / d[1] : 0;
      return `<i class="sw" style="background:${cor(n)}"></i>${esc(cap(nm ? nm[0] : n))} <span style="color:var(--muted)">${esc(nm ? nm[1] : '')}</span> · ${fmt(v)} (${pc(s * 100)})${tEf(c) === '2' ? `<br><span style="margin-left:15px"></span>${cmpT1(n, s, shareT1Cidade(p.dataset.t, c, n))}` : S.H && nm ? `<br><span style="margin-left:15px"></span>${cmpMaj(nm[1], s, a1, a2)}` : ''}`;
    }).join('<br>');
  }
  return h;
}
function mostraTip(p, x, y, toque) {
  tip.innerHTML = tipHtml(p) + (toque ? `<div style="color:var(--accent);margin-top:4px">toque de novo para abrir</div>` : '');
  tip.style.display = 'block';
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.max(8, Math.min(x + 14, innerWidth - w - 8)) + 'px';
  // no toque, a caixa fica acima do dedo
  tip.style.top = (toque ? Math.max(8, y - h - 24) : Math.min(y + 14, innerHeight - h - 8)) + 'px';
}
let ultimoToque = null, eraToque = false;
svg.addEventListener('pointerdown', e => { eraToque = e.pointerType !== 'mouse'; });
svg.addEventListener('mousemove', e => {
  if (eraToque) return;
  const p = e.target.closest('path');
  if (!p) { tip.style.display = 'none'; return; }
  mostraTip(p, e.clientX, e.clientY);
});
svg.addEventListener('mouseleave', () => { if (!eraToque) tip.style.display = 'none'; });
document.addEventListener('scroll', () => { if (eraToque) { tip.style.display = 'none'; ultimoToque = null; } }, { passive: true });
svg.addEventListener('click', e => {
  const p = e.target.closest('path'); if (!p) { tip.style.display = 'none'; ultimoToque = null; return; }
  // celular: 1º toque mostra os números da área, 2º toque na mesma área abre
  if (eraToque && p.dataset.t && ultimoToque !== p) { ultimoToque = p; mostraTip(p, e.clientX, e.clientY, true); return; }
  ultimoToque = null;
  tip.style.display = 'none';
  if (p.dataset.uf) {
    const uf = p.dataset.uf, r = regDe(uf);
    if (nivel() === 'br' || S.reg !== r) vaiPara({ reg: r, uf: '', mun: '', zona: '', sec: '' });
    else vaiPara({ uf, mun: '', zona: '', sec: '' });
  } else if (p.dataset.t) vaiPara({ mun: p.dataset.t, zona: '', sec: '' });
});
$('back').onclick = () => {
  const n = nivel();
  vaiPara(n === 'sec' ? { sec: '' } : n === 'zona' ? { zona: '' } : n === 'mun' ? { mun: '' } : n === 'uf' ? { uf: '' } : { reg: '' });
};
$('cargos').addEventListener('click', e => { const b = e.target.closest('button'); if (b) vaiPara({ cargo: b.dataset.c, cand: '' }); });
$('turnos').addEventListener('click', e => { const b = e.target.closest('button'); if (b) vaiPara({ turnoQ: b.dataset.t }); });

/* ---------------- painel ---------------- */
function situacao(k, i, r, c) {
  if (k.st) return /eleito/i.test(k.st) && !/não/i.test(k.st) ? `<span class="tag el">${esc(k.st)}</span>` : /2º/.test(k.st) ? `<span class="tag t2">2º turno</span>` : '';
  return '';
}
function linhas(lista, total, opt = {}) {
  if (!lista.length) return '<div class="empty">Sem votos apurados ainda.</div>';
  const max = lista[0].v || 1;
  return `<div class="res">${lista.map((k, i) => `
    <div class="r"><div class="n">${opt.rank ? `<small style="margin:0 6px 0 0">${i + 1}º</small>` : ''}${esc(k.cru ? k.nm : cap(k.nm))}<small>${esc(k.sg || '')}${k.n && k.n.length > 2 ? ' · ' + k.n : ''}</small>${k.tag || ''}</div>
    <div class="v">${pc(total ? k.v / total * 100 : 0)}<small>${fmt(k.v)}</small></div>
    <div class="bar"><i style="width:${(k.v / max * 100).toFixed(1)}%;background:${cor(k.n)}"></i></div></div>`).join('')}</div>`;
}
function resultadoTSE(r, c, lim = 8) {
  const vv = num(r.v?.vv), l = cands(r);
  const top = l.slice(0, lim).map((k, i) => ({ ...k, tag: situacao(k, i, r, c) }));
  return `
    <div class="stats">
      <div class="stat"><span>Seções apuradas</span><b>${pc(num(r.s?.pstn), 2)}</b></div>
      <div class="stat"><span>Comparecimento</span><b>${fmt(r.e?.c)}</b></div>
      <div class="stat"><span>Votos válidos</span><b>${fmt(vv)}</b></div>
      <div class="stat"><span>Brancos / nulos</span><b>${fmt(num(r.v?.vb) + num(r.v?.tvn))}</b></div>
    </div>
    ${lim ? `<h3>${CARGO_NM[c]}</h3>${linhas(top, vv)}` : ''}
    ${lim && l.length > lim ? `<div class="note">+ ${l.length - lim} candidatos</div>` : ''}`;
}
function somaEstados(c, ufs) {
  const m = new Map(); let vv = 0, ts = 0, st = 0;
  for (const uf of ufs) {
    const r = S.ufRes?.[ufKey(c)]?.[uf]; if (!r) continue;
    vv += num(r.v?.vv); ts += num(r.s?.ts); st += num(r.s?.st);
    for (const k of cands(r)) { const x = m.get(k.n) || { ...k, v: 0 }; x.v += k.v; m.set(k.n, x); }
  }
  return { l: [...m.values()].sort((a, b) => b.v - a.v), vv, p: ts ? st / ts * 100 : 0 };
}
function listaEstados(ufs, c) {
  return `<div class="list">${ufs.map(uf => {
    const r = S.ufRes?.[ufKey(c)]?.[uf]; const l = r ? cands(r) : []; const vv = r ? num(r.v?.vv) : 0;
    const top = l.slice(0, c === '5' ? 2 : 1);
    return `<button class="li" data-go="${uf}"><div><div class="t">${UF_NM[uf]}</div>
      <div class="m">${top.map(k => `<i class="sw" style="background:${cor(k.n)}"></i>${esc(cap(k.nm))} ${pc(vv ? k.v / vv * 100 : 0)}`).join(' · ') || 'carregando…'}</div></div>
      <div class="x">${r ? pc(num(r.s?.pstn), 1) + ' apurado' : ''}</div></button>`;
  }).join('')}</div>`;
}

// campo de busca de candidato com sugestões (a lógica fica em js/comparar.js: buscaCandidato)
function campoBusca(id, dica, k) {
  return `<div class="ac" id="${id}" style="margin:4px 0 8px"><div style="display:flex;gap:6px;align-items:center">
    <input class="sel-cand" style="margin:0" placeholder="🔎 ${esc(dica)}" autocomplete="off" value="${k ? esc(cap(k.nm) + ' (' + (k.sg || '') + ' ' + k.n + ')') : ''}">
    ${k ? `<button class="chip" data-limpacand style="cursor:pointer;white-space:nowrap">✕ limpar</button>` : ''}</div><div class="ac-lista" hidden></div></div>`;
}
function ligaBusca(id, lista) {
  const box = $(id); if (!box) return;
  buscaCandidato(box, lista, n => { document.activeElement?.blur(); vaiPara({ cand: n }); });
  const b = box.querySelector('[data-limpacand]'); if (b) b.onclick = () => vaiPara({ cand: '' });
}
// seletor do ano de comparação (2022, 2018, 2014)
function selAno() {
  return `<div class="filtros" style="margin:8px 0 0"><span class="sub">Comparar com</span><div class="seg">${['2022', '2018', '2014'].map(a => `<button data-ano="${a}" class="${a === S.anoCmp ? 'on' : ''}">${a}</button>`).join('')}</div></div>`;
}
$('panel').addEventListener('click', e => { const b = e.target.closest('[data-ano]'); if (b) { e.stopPropagation(); vaiPara({ anoCmp: b.dataset.ano }); } }, true);

let geracao = 0;
async function painel() {
  const g = ++geracao, P = $('panel'), n = nivel(), c = S.cargo;
  const vivo = () => g === geracao;
  try {
    if ((n === 'br' || n === 'reg') && !MAJ(c)) {
      const [R, Ra] = await Promise.all([resumo('2026'), resumo(S.anoCmp)]);
      if (!vivo()) return;
      const ufs = n === 'reg' ? REG[S.reg].ufs : Object.keys(UF_NM);
      const l = ufs.flatMap(u => eleitosUF(R, u)), la = ufs.flatMap(u => eleitosUF(Ra, u));
      const casa = c === '6' ? 'deputados federais' : 'deputados estaduais';
      const cp = [...contaPart(l)].sort((a, b) => b[1] - a[1]), cpa = contaPart(la);
      P.innerHTML = `<h2>${n === 'reg' ? 'Região ' + REG[S.reg].nm : 'Brasil'} <small class="sub">${CARGO_NM[c]}</small></h2>
        <div class="sub">${l.length} ${casa} eleitos em 2026 · comparação com ${S.anoCmp}</div>
        ${selAno()}
        <h3>Esquerda, centro e direita</h3>${barraLados(contaLados(l), l.length, contaLados(la))}
        <h3>Bancadas</h3>
        <div class="rolagem" style="max-height:260px"><table class="tab"><thead><tr><th>Partido</th><th class="n">2026</th><th class="n">${S.anoCmp}</th><th class="n">Δ</th></tr></thead><tbody>
          ${cp.map(([s, q]) => { const d = q - (cpa.get(s) || 0); return `<tr><td><i class="sw" style="background:${LADO_COR[lado(s)]}"></i><b>${esc(s)}</b></td><td class="n">${q}</td><td class="n">${cpa.get(s) || 0}</td><td class="n ${d >= 0 ? 'up' : 'dn'}">${d >= 0 ? '+' : ''}${d}</td></tr>`; }).join('')}
        </tbody></table></div>
        <h3>Estados</h3>
        <div class="list">${ufs.map(u => { const e = eleitosUF(R, u), cl = contaLados(e); return `<button class="li" data-go="${u}"><div style="min-width:0"><div class="t">${UF_NM[u]} <small style="color:var(--muted);font-weight:400">${e.length} eleitos</small></div>
          <div class="lados" style="height:10px;margin:4px 0 0">${ORDEM_LADO.map(x => cl[x] ? `<i style="width:${cl[x] / e.length * 100}%;background:${LADO_COR[x]}"></i>` : '').join('')}</div></div>
          <div class="x">${ORDEM_LADO.map(x => `<span style="color:${LADO_COR[x]}">${cl[x]}</span>`).join(' · ')}</div></button>`; }).join('')}</div>
        <a class="cta" href="#/congresso?casa=${c === '6' ? 'camara' : 'assembleia'}">Ver ${c === '6' ? 'a Câmara' : 'as Assembleias'} completa →</a>`;
      return;
    }
    if (n === 'br') {
      const regs = Object.entries(REG).map(([k, R]) => {
        const s = somaEstados(c, R.ufs);
        const top = s.l.slice(0, 2);
        return `<button class="reg" data-reg="${k}"><div class="t">${R.nm}</div>${top.map(x => `<div class="m" style="font-size:12.5px"><i class="sw" style="background:${cor(x.n)}"></i>${esc(cap(x.nm))} ${pc(s.vv ? x.v / s.vv * 100 : 0)}</div>`).join('') || '<div class="m">…</div>'}</button>`;
      }).join('');
      let topo = '';
      if (c === '1' && S.br) topo = `<div class="nacional" style="margin-top:12px">${S.tiles || ''}</div>` + resultadoTSE(S.br, '1', 0);
      P.innerHTML = `<h2>Brasil</h2><div class="sub">Clique numa região no mapa ou abaixo.</div>${selAno()}${topo}
        <h3>Regiões${c !== '1' ? ' · ' + CARGO_NM[c] + ' (votos somados dos estados)' : ''}</h3><div class="regs">${regs}</div>
        ${c !== '1' ? `<h3>Estados</h3>${listaEstados(Object.keys(UF_NM), c)}` : ''}`;
    } else if (n === 'reg') {
      const R = REG[S.reg], s = somaEstados(c, R.ufs);
      P.innerHTML = `<h2>Região ${R.nm}</h2><div class="sub">${R.ufs.length} estados · clique num estado para ver as cidades</div>
        ${c === '1' ? `<div class="stats"><div class="stat"><span>Seções apuradas</span><b>${pc(s.p, 2)}</b></div><div class="stat"><span>Votos válidos</span><b>${fmt(s.vv)}</b></div></div>
        <h3>Presidente na região</h3>${linhas(s.l.slice(0, 6), s.vv)}` : ''}
        <h3>Estados</h3>${listaEstados(R.ufs, c)}`;
    } else if (n === 'uf' && !MAJ(c)) {
      await painelDep(vivo);
    } else if (n === 'uf') {
      P.innerHTML = `<h2>${UF_NM[S.uf]}</h2><div class="sub">carregando resultado…</div>`;
      const r = await getJSON(urlRes(S.uf, '', c));
      if (!vivo()) return;
      const M = mapaAtual(), mc = c;
      const cidades = S.geo.mu.map(m => ({ ...m, d: M?.mu?.[m.t]?.[mc] })).sort((a, b) => (b.d?.[1] || 0) - (a.d?.[1] || 0));
      P.innerHTML = `<h2>${UF_NM[S.uf]}</h2><div class="sub">${S.geo.mu.length} municípios · clique numa cidade no mapa ou busque</div>${selAno()}
        ${resultadoTSE(r, c)}
        <h3>Cidades</h3><input class="search" id="busca" placeholder="Buscar cidade…" autocomplete="off">
        <div class="list" id="cidades"></div>
        <a class="cta" href="painel.html?uf=${S.uf}&cargo=${CARGO_PAINEL[c]}">Abrir painel completo de ${S.uf.toUpperCase()} →</a>`;
      const desenha = () => {
        const q = norm($('busca').value);
        const l = cidades.filter(m => !q || norm(m.n).includes(q)).slice(0, q ? 40 : 15);
        $('cidades').innerHTML = l.map(m => {
          const d = m.d, k = d && d[2][0], nm = k && M.nomes[mc]?.[k[0]];
          return `<button class="li" data-mun="${m.t}"><div><div class="t">${esc(cap(m.n))}${m.cap ? ' <small style="color:var(--muted)">capital</small>' : ''}</div>
            <div class="m">${k ? `<i class="sw" style="background:${cor(k[0])}"></i>${esc(cap(nm ? nm[0] : k[0]))} ${pc(d[1] ? k[1] / d[1] * 100 : 0)}` : ''}</div></div>
            <div class="x">${d ? fmt(d[1]) + ' válidos' : ''}</div></button>`;
        }).join('') + (!q ? `<div class="note">As 15 maiores cidades. Use a busca para as demais.</div>` : '');
      };
      $('busca').oninput = desenha; desenha();
    } else if (n === 'mun') {
      const m = S.geo.mu.find(x => x.t === S.mun);
      const nome = cap(m?.n || S.mun);
      P.innerHTML = `<h2>${esc(nome)} <small class="sub">${S.uf.toUpperCase()}</small></h2><div class="sub">carregando…</div>`;
      const cc = cargoUF(S.uf, c);
      const [r, zonas, Z26, H] = await Promise.all([getJSON(urlRes(S.uf, S.mun, c)), zonasDe(S.uf, S.mun).catch(() => []),
        zonaArq('2026', S.uf, cc), h22(S.uf)]);
      if (!vivo()) return;
      const lc = cands(r), vvC = num(r.v?.vv), k = S.cand && lc.find(x => x.n === S.cand);
      // eleição anterior por zona (só 2022), no cargo que o candidato disputou naquela eleição
      const cargoAnt = (k && hist(H, { nmc: k.nmc }, cc)?.cargo) || cc;
      const Za = S.anoCmp === '2022' ? await zonaArq('2022', S.uf, cargoAnt) : null;
      if (!vivo()) return;
      // candidato escolhido: resumo na cidade e comparação com a eleição anterior
      let cardCand = '';
      if (k) {
        const pos = lc.indexOf(k) + 1, Hk = hist(H, { nmc: k.nmc }, cc), vAnt = Hk ? (Hk.mun[S.mun] || 0) : null;
        cardCand = `<h3>${esc(cap(k.nm))} em ${esc(nome)}</h3><div class="stats">
          <div class="stat"><span>Votos</span><b>${fmt(k.v)}</b></div>
          <div class="stat"><span>% dos válidos</span><b>${pc(vvC ? k.v / vvC * 100 : 0, 2)}</b></div>
          <div class="stat"><span>Posição na cidade</span><b>${pos}º</b></div>
          <div class="stat"><span>Em ${S.anoCmp}${Hk && Hk.cargo !== cc ? ' (' + CARGO_TXT[Hk.cargo] + ')' : ''}</span><b>${vAnt == null ? '—' : fmt(vAnt)}</b>${vAnt ? `<div style="font-size:12px">${delta(k.v, vAnt, num(r.s?.pstn))}</div>` : ''}</div></div>`;
      }
      // zonas: votos do candidato (ou o líder) em cada zona, com a eleição anterior quando houver
      const zm = Z26?.mu?.[S.mun], zma = Za?.mu?.[S.mun];
      const idx = k && Z26 ? Z26.cands.findIndex(x => x[0] === k.n) : -1;
      const idxA = idx >= 0 && Za ? Za.cands.findIndex(x => chaveNome(x[3]) === chaveNome(Z26.cands[idx][3])) : -1;
      const emZona = (lst, i) => { if (!lst) return 0; for (let j = 0; j < lst.length; j += 2) if (lst[j] === i) return lst[j + 1]; return 0; };
      const somaZ = lst => { let t = 0; for (let j = 1; j < (lst || []).length; j += 2) t += lst[j]; return t; };
      const linhaZona = z => {
        const l = zm?.[z.cd], la = zma?.[z.cd];
        let info = `${z.sec.length} seções`, x = 'ver seções →';
        if (l && idx >= 0) {
          const v = emZona(l, idx), t = somaZ(l), va = la && idxA >= 0 ? emZona(la, idxA) : null;
          info = `<b style="color:var(--ink)">${fmt(v)}</b> votos · ${pc(t ? v / t * 100 : 0, 2)} · ${z.sec.length} seções`;
          x = va == null ? '' : `${S.anoCmp}: ${fmt(va)} ${delta(v, va)}`;
        } else if (l) {
          const ld = Z26.cands[l[0]], t = somaZ(l);
          const lda = la && Za.cands[la[0]];
          info = `<i class="sw" style="background:${cor(ld[0])}"></i>${esc(cap(ld[1]))} ${pc(t ? l[1] / t * 100 : 0)} · ${z.sec.length} seções`;
          x = lda ? `${S.anoCmp}: ${esc(cap(lda[1]))}` : 'ver seções →';
        }
        return `<button class="li" data-zona="${z.cd}"><div><div class="t">Zona ${Number(z.cd)}</div><div class="m">${info}</div></div><div class="x">${x}</div></button>`;
      };
      const zonasOrd = zm && idx >= 0 ? [...zonas].sort((a, b) => emZona(zm[b.cd], idx) - emZona(zm[a.cd], idx)) : zonas;
      P.innerHTML = `<h2>${esc(nome)} <small class="sub">${S.uf.toUpperCase()}</small></h2>
        <div class="sub">${zonas.length} zona${zonas.length === 1 ? '' : 's'} eleitora${zonas.length === 1 ? 'l' : 'is'} · ${fmt(zonas.reduce((s, z) => s + z.sec.length, 0))} seções</div>
        ${selAno()}
        ${campoBusca('acCid', 'Analisar um candidato: digite o nome ou o número…', k)}
        ${cardCand}
        ${resultadoTSE(r, c, MAJ(c) ? 8 : 15)}
        <h3>Zonas eleitorais${k ? ' · votos de ' + esc(cap(k.nm)) : ''}</h3>
        <div class="list">${zonasOrd.map(linhaZona).join('') || '<div class="empty">Zonas indisponíveis.</div>'}</div>
        ${zonas.length > 1 && !zm ? `<div class="note">${c === '1' ? 'O TSE ainda não publicou a votação de presidente por zona; abra uma zona para somar os boletins de urna.' : 'Sem dados por zona para este cargo.'}</div>` : ''}
        ${zonas.length === 1 ? '<div class="note">Cidade com uma única zona: o resultado da zona é o da cidade.</div>' : ''}`;
      ligaBusca('acCid', lc.map(x => ({ n: x.n, nmu: x.nm, nm: x.nmc || x.nm, sg: x.sg, total: x.v })));
    } else if (n === 'zona') {
      await painelZona(vivo);
    } else {
      await painelSecao(vivo);
    }
  } catch (e) {
    if (vivo()) P.innerHTML += `<div class="empty">Não foi possível carregar agora (${esc(e.message)}). Tente de novo em instantes.</div>`;
  }
}
$('panel').addEventListener('click', e => {
  const b = e.target.closest('[data-go],[data-reg],[data-mun],[data-zona],[data-sec]'); if (!b) return;
  if (b.dataset.go) vaiPara({ uf: b.dataset.go, mun: '', zona: '', sec: '' });
  else if (b.dataset.reg) vaiPara({ reg: b.dataset.reg });
  else if (b.dataset.mun) vaiPara({ mun: b.dataset.mun, zona: '', sec: '' });
  else if (b.dataset.zona) vaiPara({ zona: b.dataset.zona, sec: '' });
  else if (b.dataset.sec) vaiPara({ sec: b.dataset.sec });
  $('explorar').scrollIntoView({ block: 'start' });
});

// votos por zona (Dados Abertos do TSE): zona/<ano>/<uf>-c<cargo>t1.json, só cidades com mais de uma zona
const zonaArq = (ano, uf, c) => getJSON(`zona/${ano}/${uf}-c${c}t1.json`, Infinity).catch(() => null);

/* zonas e seções (configuração do arquivo de urnas do TSE) */
async function zonasDe(uf, mun) {
  const cs = await getJSON(`${T}/arquivo-urna/${pleitoDo()}/config/${uf}/${uf}-p00${pleitoDo()}-cs.json`, 10 * 60000);
  for (const a of cs.abr || []) { const m = (a.mu || []).find(x => String(x.cd) === String(mun)); if (m) return m.zon || []; }
  return [];
}
// nomes dos candidatos e siglas dos partidos para mostrar o conteúdo do boletim
async function nomes(uf, c) {
  c = cargoUF(uf, c);
  const r = await getJSON(c === '1' ? urlBr() : urlRes(uf, '', c), 10 * 60000);
  const m = new Map(cands(r).map(k => [k.n, k]));
  return { cand: m, part: partidos(r) };
}
function listaBU(C, N, c) {
  const nom = Object.entries(C.nom).map(([n, v]) => { const k = N?.cand.get(String(n)); return { n: String(n), nm: k ? k.nm : 'Candidato ' + n, sg: k ? k.sg : (N?.part.get(String(n).slice(0, 2))?.sg || ''), v, tag: String(n) === S.cand ? '<span class="tag t2">★ escolhido</span>' : '' }; });
  const leg = Object.entries(C.leg).map(([p, v]) => ({ n: String(p), nm: 'Legenda ' + (N?.part.get(String(p))?.sg || p), sg: '', v, cru: 1 }));
  const val = nom.reduce((s, x) => s + x.v, 0) + leg.reduce((s, x) => s + x.v, 0);
  return { l: [...nom, ...leg].sort((a, b) => b.v - a.v), val };
}
function blocoCargo(C, N, c, lim) {
  const { l, val } = listaBU(C, N, c);
  const brancoNulo = C.branco + C.nulo;
  return `<h3>${CARGO_NM[c]}${c === '5' ? ' <small style="text-transform:none;letter-spacing:0">(2 votos por eleitor)</small>' : ''}</h3>
    ${linhas(l.slice(0, lim), val)}
    ${l.length > lim ? `<div class="note">+ ${l.length - lim} com votos</div>` : ''}
    <div class="note">Válidos ${fmt(val)} · brancos ${fmt(C.branco)} · nulos ${fmt(C.nulo)}${C.outros ? ' · outros ' + fmt(C.outros) : ''}</div>`;
}
const zonaCache = new Map();
async function painelZona(vivo) {
  const P = $('panel'), c = cargoUF(S.uf, S.cargo), m = S.geo.mu.find(x => x.t === S.mun);
  const zonas = await zonasDe(S.uf, S.mun), z = zonas.find(x => x.cd === S.zona);
  if (!vivo()) return;
  const titulo = `<h2>Zona ${Number(S.zona)} <small class="sub">${esc(cap(m?.n || ''))} · ${S.uf.toUpperCase()}</small></h2>`;
  if (!z) { P.innerHTML = titulo + '<div class="empty">Zona não encontrada.</div>'; return; }
  const key = `${pleitoDo()}/${S.uf}/${S.mun}/${S.zona}`;
  const Z = zonaCache.get(key) || { res: new Map(), err: new Set() };
  zonaCache.set(key, Z);
  const [N, Hm] = await Promise.all([nomes(S.uf, c).catch(() => null), h22(S.uf)]);
  const kz = S.cand && N?.cand.get(S.cand);
  const Za = S.anoCmp === '2022' ? await zonaArq('2022', S.uf, (kz && hist(Hm, { nmc: kz.nmc }, c)?.cargo) || c) : null;
  if (!vivo()) return;
  // votos do candidato escolhido nesta zona na eleição anterior (por zona quando houver; senão, a cidade toda)
  const anterior = k => {
    if (!k) return null;
    const lst = Za?.mu?.[S.mun]?.[S.zona];
    if (lst) {
      const i = Za.cands.findIndex(x => chaveNome(x[3]) === chaveNome(k.nmc));
      if (i < 0) return { v: null };
      for (let j = 0; j < lst.length; j += 2) if (lst[j] === i) return { v: lst[j + 1], onde: 'nesta zona' };
      return { v: 0, onde: 'nesta zona' };
    }
    const H = hist(Hm, { nmc: k.nmc }, c);
    return H ? { v: H.mun[S.mun] || 0, onde: 'na cidade' } : { v: null };
  };
  const render = () => {
    if (!vivo()) return;
    const ag = { aptos: 0, compar: 0, nom: {}, leg: {}, branco: 0, nulo: 0, outros: 0 };
    for (const bu of Z.res.values()) {
      const C = bu.cargos?.[c]; if (!C) continue;
      ag.aptos += C.aptos; ag.compar += C.compar; ag.branco += C.branco; ag.nulo += C.nulo; ag.outros += C.outros;
      for (const k in C.nom) ag.nom[k] = (ag.nom[k] || 0) + C.nom[k];
      for (const k in C.leg) ag.leg[k] = (ag.leg[k] || 0) + C.leg[k];
    }
    const feito = Z.res.size + Z.err.size, tot = z.sec.length;
    const lider = s => { const C = Z.res.get(s)?.cargos?.[c]; if (!C) return ''; let b = '', v = -1; for (const k in C.nom) if (C.nom[k] > v) { v = C.nom[k]; b = k; } return b; };
    const validos = C => { let t = 0; for (const x in C.nom) t += C.nom[x]; for (const x in C.leg) t += C.leg[x]; return t; };
    const k = S.cand && (N?.cand.get(S.cand) || (ag.nom[S.cand] ? { n: S.cand, nm: 'Candidato ' + S.cand, sg: '', nmc: '' } : null));
    let blocoK = '', grade;
    if (k) {
      // seções pela força do candidato
      const vs = z.sec.map(s => { const C = Z.res.get(s.ns)?.cargos?.[c]; const v = C ? (C.nom[S.cand] || 0) : null; return { ns: s.ns, v, t: C ? validos(C) : 0 }; });
      const max = Math.max(0.0001, ...vs.map(x => x.t ? x.v / x.t : 0));
      const vT = ag.nom[S.cand] || 0, tT = validos(ag), ant = anterior(k);
      const melhores = vs.filter(x => x.v).sort((a, b) => b.v - a.v).slice(0, 10);
      blocoK = `<h3>${esc(cap(k.nm))} nesta zona</h3><div class="stats">
          <div class="stat"><span>Votos</span><b>${fmt(vT)}</b></div>
          <div class="stat"><span>% dos válidos</span><b>${pc(tT ? vT / tT * 100 : 0, 2)}</b></div>
          <div class="stat"><span>Seções com voto</span><b>${vs.filter(x => x.v).length} / ${vs.filter(x => x.v != null).length}</b></div>
          <div class="stat"><span>${S.anoCmp} ${ant?.onde || ''}</span><b>${ant?.v == null ? '—' : fmt(ant.v)}</b>${ant?.v && ant.onde === 'nesta zona' && feito >= tot ? `<div style="font-size:12px">${delta(vT, ant.v)}</div>` : ''}</div></div>
        <h3>Seções com melhor desempenho</h3>
        <table class="tab"><thead><tr><th>Seção</th><th class="n">Votos</th><th class="n">% da seção</th></tr></thead><tbody>
          ${melhores.map(x => `<tr data-sec="${x.ns}" style="cursor:pointer"><td>Seção ${Number(x.ns)}</td><td class="n">${fmt(x.v)}</td><td class="n">${pc(x.t ? x.v / x.t * 100 : 0, 1)}</td></tr>`).join('')}</tbody></table>`;
      grade = vs.map(x => `<button data-sec="${x.ns}" class="${Z.err.has(x.ns) ? 'err' : ''}" title="Seção ${Number(x.ns)}: ${x.v == null ? '…' : fmt(x.v) + ' votos'}"
        style="${x.v ? `background:color-mix(in srgb, ${cor(k.n)} ${Math.round(15 + 85 * (x.v / x.t) / max)}%, var(--surface-2))` : ''}">${Number(x.ns)}</button>`).join('');
    } else {
      grade = z.sec.map(s => { const l = lider(s.ns); return `<button data-sec="${s.ns}" class="${Z.err.has(s.ns) ? 'err' : ''}" title="Seção ${Number(s.ns)}">${Number(s.ns)}${l ? `<i style="background:${cor(l)}"></i>` : ''}</button>`; }).join('');
    }
    const listaZ = Object.entries(ag.nom).sort((a, b) => b[1] - a[1])
      .map(([n, v]) => { const kk = N?.cand.get(n); return { n, nmu: kk ? kk.nm : 'Candidato ' + n, nm: kk?.nmc || '', sg: kk?.sg || '', total: v }; });
    const foco = !!document.activeElement?.closest?.('#acZona');
    if (foco) return; // não redesenha enquanto a pessoa escolhe na lista
    P.innerHTML = `${titulo}
      <div class="sub">${tot} seções · resultado somado dos boletins de urna${feito < tot ? ` — lendo ${feito} de ${tot}…` : ''}</div>
      ${feito < tot ? `<div class="prog"><i style="width:${(feito / tot * 100).toFixed(1)}%"></i></div>` : ''}
      ${campoBusca('acZona', 'Analisar um candidato nesta zona: digite o nome ou o número…', k)}
      <div class="stats">
        <div class="stat"><span>Eleitores aptos</span><b>${fmt(ag.aptos)}</b></div>
        <div class="stat"><span>Comparecimento</span><b>${fmt(ag.compar)}</b></div>
        <div class="stat"><span>Abstenção</span><b>${ag.aptos ? pc((1 - ag.compar / ag.aptos) * 100) : '–'}</b></div>
      </div>
      ${blocoK}
      <h3>Seções${k ? ' · quanto mais forte, maior a % de ' + esc(cap(k.nm)) : ''}</h3>
      <div class="grid-sec">${grade}</div>
      <div class="note">${k ? 'Clique numa seção para abrir o boletim.' : `A barrinha colorida indica quem liderou na seção (${CARGO_NM[c]}). Clique para abrir o boletim.`}</div>
      ${Z.res.size ? blocoCargo(ag, N, c, MAJ(c) ? 8 : 15) : ''}`;
    ligaBusca('acZona', listaZ);
  };
  render();
  let ult = 0;
  await pool(z.sec.filter(s => !Z.res.has(s.ns)), 6, async s => {
    if (!vivo()) return;
    try { Z.res.set(s.ns, await secao(S.uf, S.mun, S.zona, s.ns)); Z.err.delete(s.ns); } catch (e) { Z.err.add(s.ns); }
    if (Date.now() - ult > 400) { ult = Date.now(); render(); }
  });
  render();
}
const hora = s => s ? s.replace(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)$/, '$3/$2 $4:$5') : '–';
async function painelSecao(vivo) {
  const P = $('panel'), m = S.geo.mu.find(x => x.t === S.mun);
  const titulo = `<h2>Seção ${Number(S.sec)} <small class="sub">Zona ${Number(S.zona)} · ${esc(cap(m?.n || ''))} · ${S.uf.toUpperCase()}</small></h2>`;
  P.innerHTML = titulo + '<div class="sub">baixando o boletim de urna…</div>';
  const bu = await secao(S.uf, S.mun, S.zona, S.sec);
  if (!vivo()) return;
  if (bu.semBU) { P.innerHTML = titulo + `<div class="empty">Boletim ainda não publicado (situação: ${esc(bu.st)}).</div>`; return; }
  const ordem = ['1', '3', '5', '6', '7', '8'].filter(c => bu.cargos[c]);
  const Ns = await Promise.all(ordem.map(c => nomes(S.uf, c).catch(() => null)));
  if (!vivo()) return;
  const C0 = bu.cargos[ordem[0]] || { aptos: 0, compar: 0 };
  const destaque = ordem.includes(cargoUF(S.uf, S.cargo)) ? cargoUF(S.uf, S.cargo) : ordem[0];
  const ord = [destaque, ...ordem.filter(c => c !== destaque)];
  P.innerHTML = `${titulo}
    <div class="sub">Local de votação ${bu.local || '–'} · situação: ${esc(bu.st || '')}</div>
    <div class="stats">
      <div class="stat"><span>Eleitores aptos</span><b>${fmt(C0.aptos)}</b></div>
      <div class="stat"><span>Comparecimento</span><b>${fmt(C0.compar)}</b></div>
      <div class="stat"><span>Abstenção</span><b>${C0.aptos ? pc((1 - C0.compar / C0.aptos) * 100) : '–'}</b></div>
      <div class="stat"><span>Urna aberta / fechada</span><b style="font-size:13px">${hora(bu.abertura)} – ${hora(bu.encerramento).slice(6)}</b></div>
    </div>
    ${ord.map(c => blocoCargo(bu.cargos[c], Ns[ordem.indexOf(c)], c, MAJ(c) ? 10 : 12)).join('')}
    <h3>Arquivos oficiais da urna (TSE)</h3>
    <div class="files">${(bu.arqs || []).map(a => `<a href="${bu.base}${a}" target="_blank" rel="noopener">${esc(a.replace(/^.*-/, '').replace('bu.dat', 'Boletim (BU)').replace('rdv.dat', 'Registro de votos (RDV)').replace('log.jez', 'Log da urna').replace('vota.vsc', 'Assinaturas'))}</a>`).join('')}</div>
    <div class="note">Números lidos do boletim de urna assinado digitalmente, publicado pelo TSE.</div>`;
}

/* ---------------- topo nacional ---------------- */
async function nacional() {
  try {
    S.br = await getJSON(urlBr(S.turno === '2' ? '2' : '1'));
    const r = S.br, vv = num(r.v?.vv), l = cands(r).slice(0, 4);
    S.tiles = l.map(k => `<div class="cand-tile" style="--c:${cor(k.n)}">
      <img src="${urlFoto('1', 'br', k.sq)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ph'}))">
      <div style="flex:1;min-width:0"><div class="nm">${esc(cap(k.nm))}${situacao(k)}</div><div class="pp">${esc(k.sg)} · ${fmt(k.v)} votos</div>
      <div class="big">${pc(vv ? k.v / vv * 100 : 0, 2)}</div><div class="bar"><i style="width:${vv ? k.v / vv * 100 : 0}%"></i></div></div></div>`).join('');
    const p = num(r.s?.pstn);
    $('nacProg').innerHTML = `<span><span class="dot ${p < 100 ? 'on' : ''}"></span>${p < 100 ? 'Apuração do ' + (S.turno === '2' ? '2º' : '1º') + ' turno em andamento' : 'Apuração do ' + (S.turno === '2' ? '2º' : '1º') + ' turno concluída'}</span>
      <span>Presidente · ${pc(p, 2)} das seções totalizadas</span><span>Atualizado às ${esc(String(r.hg || r.ht || '').slice(0, 5).replace(':', 'h'))} (horário de Brasília)</span><span>Fonte: TSE</span>`;
    if (nivel() === 'br' && S.cargo === '1') painel();
  } catch (e) { $('nacProg').textContent = 'Não foi possível ler o TSE agora.'; }
}

/* ---------------- navegação ---------------- */
function migalhas() {
  const n = nivel(), h = [];
  h.push(n === 'br' ? '<b>Brasil</b>' : `<a href="${hashDe({ reg: '', uf: '', mun: '', zona: '', sec: '' })}">Brasil</a>`);
  if (S.reg) h.push(n === 'reg' ? `<b>${REG[S.reg].nm}</b>` : `<a href="${hashDe({ uf: '', mun: '', zona: '', sec: '' })}">${REG[S.reg].nm}</a>`);
  if (S.uf) h.push(n === 'uf' ? `<b>${S.uf.toUpperCase()}</b>` : `<a href="${hashDe({ mun: '', zona: '', sec: '' })}">${S.uf.toUpperCase()}</a>`);
  if (S.mun) { const m = S.geo?.mu?.find(x => x.t === S.mun); const nm = esc(cap(m?.n || S.mun)); h.push(n === 'mun' ? `<b>${nm}</b>` : `<a href="${hashDe({ zona: '', sec: '' })}">${nm}</a>`); }
  if (S.zona) h.push(n === 'zona' ? `<b>Zona ${Number(S.zona)}</b>` : `<a href="${hashDe({ sec: '' })}">Zona ${Number(S.zona)}</a>`);
  if (S.sec) h.push(`<b>Seção ${Number(S.sec)}</b>`);
  $('crumbs').innerHTML = h.join('<span>›</span>');
  $('cargos').querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.c === S.cargo); });
  $('turnos').hidden = !(S.t2ok && temT2(S.cargo));
  $('turnos').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === tEf(S.cargo)));
}
/* painel do estado para deputados: ranking, busca de candidato e votação por cidade com 2022 */
async function painelDep(vivo) {
  const P = $('panel');
  P.innerHTML = `<h2>${UF_NM[S.uf]}</h2><div class="sub">carregando votação por cidade…</div>`;
  const [D, H] = await Promise.all([dep(S.uf, S.cargo), h22(S.uf)]);
  if (!vivo()) return;
  const c = D.cargo, k = S.cand && D.porN.get(S.cand);
  const v22 = cand => { const x = hist(H, cand, c); return x ? x.total : null; };
  const pstUF = (() => { let t = 0, w = 0; for (const cd in D.mu) { t += D.mu[cd].pst * D.mu[cd].vv; w += D.mu[cd].vv; } return w ? t / w : 0; })();
  const linhaCand = x => {
    const t22 = v22(x);
    return `<button class="li" data-cand="${x.n}"><div><div class="t">${x.pos}º · ${esc(cap(x.nm))} <small style="color:var(--muted);font-weight:400">${esc(x.sg)} · ${x.n}</small></div>
      <div class="m">${t22 == null ? 'não concorreu em ' + S.anoCmp : `: ${fmt(t22)} ${delta(x.v, t22, pstUF)}`}</div></div>
      <div class="x"><b>${fmt(x.v)}</b><br>${pc(D.vv ? x.v / D.vv * 100 : 0, 2)}</div></button>`;
  };
  let h = `<h2>${UF_NM[S.uf]} <small class="sub">${CARGO_NM[c]}</small></h2>
    <div class="sub">Passe o mouse (ou toque) nas cidades para ver os votos e a comparação com ${S.anoCmp}.</div>${selAno()}
    <h3>Candidato</h3><input class="search" id="buscaCand" placeholder="Buscar por nome ou número…" autocomplete="off" value="">
    <div class="list" id="cands"></div>`;
  if (k) {
    const H2 = hist(H, k, c), t22 = H2 ? H2.total : null;
    const cid = Object.entries(D.mu).map(([cd, m]) => ({ cd, m, v: votosEm(m, k.i), v22: H2 ? (H2.mun[cd] || 0) : null }))
      .filter(x => x.v || x.v22).sort((a, b) => b.v - a.v);
    const nome = cd => cap(S.geo.mu.find(x => x.t === cd)?.n || cd);
    h = `<h2>${esc(cap(k.nm))} <small class="sub">${esc(k.sg)} · ${k.n} · ${CARGO_NM[c]}</small></h2>
      <div class="sub">${UF_NM[S.uf]} · <a href="${hashDe({ cand: '' })}">trocar candidato</a></div>
      <div class="stats">
        <div class="stat"><span>Votos</span><b>${fmt(k.v)}</b></div>
        <div class="stat"><span>% dos válidos</span><b>${pc(D.vv ? k.v / D.vv * 100 : 0, 2)}</b></div>
        <div class="stat"><span>Posição no estado</span><b>${k.pos}º</b></div>
        <div class="stat"><span>Em ${S.anoCmp}</span><b>${t22 == null ? '—' : fmt(t22)}</b>${t22 ? `<div style="font-size:12px">${delta(k.v, t22, pstUF)}</div>` : ''}</div>
      </div>
      ${H2 ? `<div class="note">${S.anoCmp}: ${CARGO_NM[H2.cargo] || ''} · ${esc(H2.sg)} ${H2.n} · ${esc(cap(H2.sit))}</div>` : ''}
      <h3>Votação por cidade · ${cid.filter(x => x.v).length} cidades</h3>
      <input class="search" id="buscaCid" placeholder="Buscar cidade…" autocomplete="off">
      <div style="display:grid;grid-template-columns:1fr auto auto auto;gap:4px 12px;font-size:13px" id="tabCid"></div>
      <a class="cta" href="painel.html?uf=${S.uf}&cargo=${CARGO_PAINEL[c]}&num=${k.n}">Ver no painel completo →</a>`;
    P.innerHTML = h;
    const desenha = () => {
      const q = norm($('buscaCid').value);
      const l = cid.filter(x => !q || norm(nome(x.cd)).includes(q)).slice(0, q ? 60 : 25);
      $('tabCid').innerHTML = `<b class="m" style="color:var(--muted)">Cidade</b><b style="color:var(--muted);text-align:right">2026</b><b style="color:var(--muted);text-align:right">${S.anoCmp}</b><b style="color:var(--muted);text-align:right">Δ</b>`
        + l.map(x => `<a href="${hashDe({ mun: x.cd })}" style="color:var(--ink)">${esc(nome(x.cd))} <small style="color:var(--muted)">${posEm(x.m, k.i) ? posEm(x.m, k.i) + 'º' : ''}</small></a>
          <span style="text-align:right">${fmt(x.v)} <small style="color:var(--muted)">${pc(x.m.vv ? x.v / x.m.vv * 100 : 0)}</small></span>
          <span style="text-align:right;color:var(--ink-2)">${x.v22 == null ? '—' : fmt(x.v22)}</span>
          <span style="text-align:right">${x.v22 ? delta(x.v, x.v22, x.m.pst) : '—'}</span>`).join('')
        + (!q && cid.length > 25 ? `<span class="note" style="grid-column:1/-1">As 25 cidades com mais votos. Use a busca para as demais.</span>` : '');
    };
    $('buscaCid').oninput = desenha; desenha();
    return;
  }
  P.innerHTML = h;
  const desenha = () => {
    const q = norm($('buscaCand').value).trim();
    const l = q ? D.ord.filter(x => x.v && (norm(x.nm).includes(q) || x.n.startsWith(q))).slice(0, 30) : D.ord.slice(0, 20);
    $('cands').innerHTML = l.map(linhaCand).join('') + (!q ? `<div class="note">Os 20 mais votados. Busque para ver os demais.</div>` : '');
  };
  $('buscaCand').oninput = desenha; desenha();
}
$('panel').addEventListener('click', e => {
  const b = e.target.closest('[data-cand]'); if (!b) return;
  e.stopPropagation(); vaiPara({ cand: b.dataset.cand });
}, true);

async function ir() {
  lerHash();
  mostraAba();
  if (S.aba !== 'mapa') { (ABAS[S.aba] || (() => {}))(); return; }
  const novo = await desenhar();
  if (S.uf && tEf(S.cargo) === '2' && S.mapa2?.uf !== S.uf) {
    S.mapa2 = null; const uf = S.uf;
    getJSON(SIMT2 ? `mapa/${uf}.json` : `mapa/${uf}-t2.json`, 2 * 60000).then(d => { if (S.uf === uf) { S.mapa2 = { ...d, uf }; colorir(); if (nivel() === 'uf') painel(); } }).catch(() => {});
  }
  if (S.uf && S.mapa?.uf !== S.uf) {
    S.mapa = null;
    getJSON(`mapa/${S.uf}.json`, 5 * 60000).then(d => { S.mapa = d; colorir(); if (nivel() === 'uf') painel(); }).catch(() => {});
  }
  if (S.uf) {
    const uf = S.uf;
    if (S.Huf !== uf || S.Hano !== S.anoCmp) { S.H = null; S.Huf = uf; S.Hano = S.anoCmp; }
    h22(uf).then(H => { if (S.uf === uf && S.Hano === S.anoCmp) S.H = H; });
    if (!MAJ(S.cargo)) dep(uf, S.cargo).then(D => { if (S.uf === uf) S.depAtual = D; }).catch(() => {});
  }
  migalhas(); destacar(); enquadrar(novo); colorir(); painel();
}
addEventListener('hashchange', ir);
// atualiza sozinho enquanto a apuração estiver em andamento
setInterval(() => {
  if (document.hidden || (S.br && num(S.br.s?.pstn) >= 100)) return;
  S.ufRes = {}; nacional(); colorir(); if (nivel() !== 'zona') painel();
}, 60000);
nacional();
detectaT2();
const ABAS = {};
// menu lateral (no celular abre por cima da página) e tema claro/escuro
const lateralEl = $('lateral'), veuEl = $('veu'), menuBt = $('menuBt');
function menu(abrir) {
  lateralEl.classList.toggle('aberta', abrir); veuEl.hidden = !abrir;
  menuBt.setAttribute('aria-expanded', String(abrir));
}
menuBt.onclick = () => menu(!lateralEl.classList.contains('aberta'));
veuEl.onclick = () => menu(false);
addEventListener('keydown', e => { if (e.key === 'Escape') menu(false); });
const temaBt = $('temaBt');
function aplicaTema(t) {
  if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  const escuro = t === 'dark';
  temaBt.setAttribute('aria-pressed', String(escuro));
  temaBt.querySelector('span').textContent = escuro ? 'Modo claro' : 'Modo escuro';
  temaBt.querySelector('svg').innerHTML = escuro
    ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'
    : '<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10Z"/>';
}
aplicaTema(document.documentElement.dataset.theme || '');
temaBt.onclick = () => {
  const t = document.documentElement.dataset.theme === 'dark' ? '' : 'dark';
  aplicaTema(t);
  try { t ? localStorage.setItem('radar-tema', t) : localStorage.removeItem('radar-tema'); } catch (e) {}
  if (S.aba === 'comparar' && CMP.dados) desenhaResultado($('cmpRes'), []);
  if (S.aba === 'congresso') ABAS.congresso();
};
function mostraAba() {
  menu(false);
  const m = S.aba === 'mapa';
  document.querySelector('.hero').hidden = !m; $('explorar').hidden = !m; document.querySelector('.features').hidden = !m;
  for (const a of ['Congresso', 'Partidos', 'Historico', 'Comparar']) $('aba' + a).hidden = S.aba !== a.toLowerCase();
  document.querySelectorAll('#abas a[data-aba]').forEach(x => x.classList.toggle('on', x.dataset.aba === S.aba));
}
addEventListener('DOMContentLoaded', ir);
// cache local (sw.js): mapas e dados históricos abrem do aparelho a partir da segunda visita
if ('serviceWorker' in navigator && location.protocol === 'https:') addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
