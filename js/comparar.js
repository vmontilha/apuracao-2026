/* Aba Comparar: biblioteca de comparações entre duas "séries" (candidato, partido ou campo político
   em qualquer eleição de 2014 a 2026), por cidade, por zona eleitoral ou por seção (boletim de urna).

   Fontes (todas estáticas no site, exceto os boletins de urna, lidos do TSE):
     partido/<ano>/<uf>.json   votos por partido em cada cidade (todas as eleições)
     hist/<ano>/<uf>.json      candidatos das eleições gerais com votos por cidade
     mun/<ano>/<uf>/<cidade>.json   candidatos das eleições municipais com votos por zona
     zona/<ano>/<uf>-c<cargo>t<turno>.json   votos por zona das eleições gerais (2022 e 2026)
     mapa/<uf>.json            presidente 2026 por cidade (o TSE ainda não publicou nos Dados Abertos)
     boletins de urna de 2024 e 2026 (seção a seção) */
const CMP_ELEICOES = {
  '2026': { geral: true, cargos: ['1', '3', '5', '6', '7'] },
  '2024': { geral: false, cargos: ['11', '13'] },
  '2022': { geral: true, cargos: ['1', '3', '5', '6', '7'] },
  '2020': { geral: false, cargos: ['11', '13'] },
  '2018': { geral: true, cargos: ['1', '3', '5', '6', '7'] },
  '2016': { geral: false, cargos: ['11', '13'] },
  '2014': { geral: true, cargos: ['1', '3', '5', '6', '7'] },
};
const CMP_CARGO = { '1': 'Presidente', '3': 'Governador', '5': 'Senador', '6': 'Deputado Federal', '7': 'Deputado Estadual', '8': 'Deputado Distrital', '11': 'Prefeito', '13': 'Vereador' };
const CMP_PLEITO = { '2026': { '1': '3220' }, '2024': { '1': '452', '2': '453' } }; // boletins de urna disponíveis
// votação por seção de 2022 (Dados Abertos do TSE convertidos por zona), hospedada no Cloudflare
const DADOS_URL = location.hostname === 'localhost' ? 'http://localhost:8771' : 'https://apuracao2026-dados.apuracao2026.workers.dev';
const secao2022 = (uf, mun, zona) => getS(`${DADOS_URL}/secao/2022/${uf}/${mun}-${zona}.json`).catch(() => null);
const CMP_TIPO = { cand: 'Candidato', part: 'Partido', campo: 'Campo político' };
const CMP_PRESETS = [
  { nm: 'Vereador × Deputado federal', a: '2024.13.1.cand.', b: '2026.6.1.cand.', dica: 'Escolha a cidade e os dois candidatos.' },
  { nm: 'Vereador × Deputado estadual', a: '2024.13.1.cand.', b: '2026.7.1.cand.', dica: 'Escolha a cidade e os dois candidatos.' },
  { nm: 'Prefeito × Presidente', a: '2024.11.1.part.PL', b: '2026.1.1.part.PL', dica: 'Partido do prefeito em 2024 contra o mesmo partido para presidente.' },
  { nm: 'Prefeito × Governador', a: '2024.11.1.part.PSD', b: '2026.3.1.part.PSD', dica: 'Troque o partido em cada lado.' },
  { nm: 'Partido 2022 × 2026', a: '2022.6.1.part.PL', b: '2026.6.1.part.PL', dica: 'Mesmo partido, Câmara dos Deputados.' },
  { nm: 'Esquerda 2024 × 2026', a: '2024.13.1.campo.esquerda', b: '2026.6.1.campo.esquerda', dica: 'Vereadores de esquerda contra deputados federais de esquerda.' },
  { nm: 'Lula 2022 × 2026', a: '2022.1.1.cand.13', b: '2026.1.1.cand.13', dica: 'Presidente, 1º turno.' },
];
const cargoDoUF = (uf, c) => (uf === 'df' && c === '7') ? '8' : c;
const lerSerie = s => { const [ano, cargo, turno, tipo, ...r] = String(s || '').split('.'); return CMP_ELEICOES[ano] ? { ano, cargo: cargo || CMP_ELEICOES[ano].cargos[0], turno: turno || '1', tipo: CMP_TIPO[tipo] ? tipo : 'cand', alvo: decodeURIComponent(r.join('.')) } : null; };
const textoSerie = s => [s.ano, s.cargo, s.turno, s.tipo, encodeURIComponent(s.alvo || '')].join('.');

/* ---------------- fontes ---------------- */
const getS = u => getJSON(u, Infinity);
const partidoUF = (ano, uf) => getS(`partido/${ano}/${uf}.json`).catch(() => ({ mu: {} }));
const munArq = (ano, uf, mun) => getS(`mun/${ano}/${uf}/${mun}.json`).then(d => d.c.map(c => ({ nm: c[0], nmu: c[1], n: c[2], sg: c[3], cargo: c[4], turno: c[5], sit: c[6], total: c[7], zon: c[8] }))).catch(() => []);
const zonaGeral = (ano, uf, c, t) => getS(`zona/${ano}/${uf}-c${c}t${t}.json`).catch(() => null);
const pres26 = s => s.ano === '2026' && s.cargo === '1';

// candidatos disponíveis para escolher (no estado, ou na cidade nas eleições municipais)
async function candidatosDe(s, uf, mun) {
  const c = cargoDoUF(uf, s.cargo);
  if (pres26(s)) {
    const m = await getS(`mapa/${uf}.json`).catch(() => null);
    const tot = new Map();
    for (const cd in m?.mu || {}) for (const [n, v] of m.mu[cd]['1']?.[2] || []) tot.set(n, (tot.get(n) || 0) + v);
    return Object.entries(m?.nomes?.['1'] || {}).map(([n, [nm, sg]]) => ({ n, nmu: nm, nm, sg, total: tot.get(n) || 0 })).sort((a, b) => b.total - a.total);
  }
  if (CMP_ELEICOES[s.ano].geral) {
    const H = await histUF(s.ano, uf);
    return H.lista.filter(o => o.cargo === c && o.turno === s.turno).sort((a, b) => b.total - a.total);
  }
  if (!mun) return [];
  return (await munArq(s.ano, uf, mun)).filter(o => o.cargo === c && o.turno === s.turno).sort((a, b) => b.total - a.total);
}
// a série casa com um candidato/partido?
function casa(s, sg, n) {
  if (s.tipo === 'cand') return String(n) === String(s.alvo);
  if (s.tipo === 'part') return atual(sg) === s.alvo || sg === s.alvo;
  return lado(sg) === s.alvo;
}

/* valores de uma série em cada unidade: Map(id -> {v, t}) ; v = votos da série, t = votos válidos nominais do cargo */
async function valores1(s, esc, progresso) {
  const c = cargoDoUF(esc.uf, s.cargo), g = `c${c}t${s.turno}`, E = CMP_ELEICOES[s.ano];
  const out = new Map();
  if (esc.nivel === 'estado') {
    if (pres26(s)) {
      const m = await getS(`mapa/${esc.uf}.json`).catch(() => null);
      const nomes = m?.nomes?.['1'] || {};
      for (const cd in m?.mu || {}) {
        const d = m.mu[cd]['1']; if (!d) continue;
        let v = 0; for (const [n, x] of d[2]) if (casa(s, nomes[n]?.[1], n)) v += x;
        out.set(cd, { v, t: d[1] });
      }
      return { out, nota: 'Presidente 2026: só os 4 mais votados de cada cidade (o TSE ainda não publicou o detalhamento).' };
    }
    const P = await partidoUF(s.ano, esc.uf);
    const totais = new Map();
    for (const cd in P.mu) { const p = P.mu[cd][g]; if (!p) continue; let t = 0, v = 0; for (const sg in p) { t += p[sg]; if (s.tipo !== 'cand' && casa(s, sg)) v += p[sg]; } totais.set(cd, t); out.set(cd, { v, t }); }
    if (s.tipo === 'cand') {
      if (!E.geral) return { out: new Map(), nota: 'Candidatos de eleição municipal só disputam numa cidade: escolha a cidade para comparar por zona ou seção.' };
      const H = await histUF(s.ano, esc.uf);
      const k = H.lista.find(o => o.cargo === c && o.turno === s.turno && String(o.n) === String(s.alvo));
      for (const [cd, o] of out) o.v = k?.mun[cd] || 0;
      if (!k) return { out: new Map(), nota: 'Candidato não encontrado nesse estado/eleição.' };
    }
    return { out };
  }
  if (esc.nivel === 'cidade') {
    if (!E.geral) {
      const l = (await munArq(s.ano, esc.uf, esc.mun)).filter(o => o.cargo === c && o.turno === s.turno);
      for (const o of l) for (const [z, v] of Object.entries(o.zon)) {
        const u = out.get(z) || { v: 0, t: 0 }; u.t += v; if (casa(s, o.sg, o.n)) u.v += v; out.set(z, u);
      }
      return { out, nota: l.length ? '' : 'Sem candidatos desse cargo nessa cidade.' };
    }
    const Z = await zonaGeral(s.ano, esc.uf, c, s.turno);
    if (!Z) return { out, nota: `Sem votação por zona para ${CMP_CARGO[c]} em ${s.ano}${pres26(s) ? ' (o TSE ainda não publicou)' : ''}. Desça até uma zona para comparar seção a seção.` };
    const zs = Z.mu[esc.mun];
    if (!zs) return { out, nota: 'Cidade com uma única zona eleitoral: escolha a zona para comparar por seção.' };
    for (const [z, l] of Object.entries(zs)) {
      let v = 0, t = 0;
      for (let j = 0; j < l.length; j += 2) { const k = Z.cands[l[j]]; t += l[j + 1]; if (casa(s, k[2], k[0])) v += l[j + 1]; }
      out.set(z, { v, t });
    }
    return { out };
  }
  // zona: seção a seção (2022: Dados Abertos; 2024 e 2026: boletins de urna)
  if (s.ano === '2022') {
    const Z = await secao2022(esc.uf, esc.mun, esc.zona);
    if (!Z) return { out, nota: 'Votação por seção de 2022 indisponível para essa zona.' };
    const sig = await siglasPorNumero(s, esc);
    for (const [ns, S_] of Object.entries(Z.s)) {
      const l = S_[g]; if (!l) continue;
      let v = 0, t = 0;
      for (let j = 0; j < l.length; j += 2) {
        const n = String(l[j]), x = l[j + 1]; t += x;
        const leg = n.length === 2;
        if (leg ? s.tipo !== 'cand' && casa(s, sig.get(n), n) : casa(s, sig.get(n.slice(0, 2)), n)) v += x;
      }
      out.set(ns, { v, t });
    }
    return { out, locais: Z };
  }
  const pl = CMP_PLEITO[s.ano]?.[s.turno];
  if (!pl) return { out, nota: `Votação por seção disponível para 2022, 2024 e 2026 (${s.ano} não tem).` };
  const secoes = await secoesDaZona(s.ano, pl, esc.uf, esc.mun, esc.zona);
  const siglas = await siglasPorNumero(s, esc);
  let feito = 0;
  await pool(secoes, 6, async ns => {
    try {
      const bu = await buDe(s.ano, pl, esc.uf, esc.mun, esc.zona, ns);
      const C = bu?.cargos?.[c];
      if (C) {
        let v = 0, t = 0;
        for (const n in C.nom) { t += C.nom[n]; if (casa(s, siglas.get(String(n).slice(0, 2)), n)) v += C.nom[n]; }
        for (const p in C.leg) { t += C.leg[p]; if (s.tipo !== 'cand' && casa(s, siglas.get(String(p)), p)) v += C.leg[p]; }
        out.set(ns, { v, t });
      }
    } catch (e) {}
    feito++; progresso && progresso(feito, secoes.length);
  });
  return { out };
}
// número do partido -> sigla, na eleição da série (para ler os boletins de urna)
async function siglasPorNumero(s, esc) {
  const m = new Map();
  const l = CMP_ELEICOES[s.ano].geral ? (await histUF(s.ano, esc.uf)).lista : await munArq(s.ano, esc.uf, esc.mun);
  for (const o of l) { const p = String(o.n).slice(0, 2); if (!m.has(p)) m.set(p, o.sg); }
  if (s.ano === '2026') for (const k of cands(await getJSON(urlBr('1'), Infinity).catch(() => null))) if (!m.has(k.n.slice(0, 2))) m.set(k.n.slice(0, 2), k.sg);
  return m;
}
const baseUrna = (ano, pl) => `https://resultados.tse.jus.br/oficial/ele${ano}/arquivo-urna/${pl}`;
async function secoesDaZona(ano, pl, uf, mun, zona) {
  const cs = await getJSON(`${baseUrna(ano, pl)}/config/${uf}/${uf}-p${pad(pl, 6)}-cs.json`, 10 * 60000);
  for (const a of cs.abr || []) { const m = (a.mu || []).find(x => String(x.cd) === String(mun)); if (m) return ((m.zon || []).find(z => z.cd === zona)?.sec || []).map(s => s.ns); }
  return [];
}
const buCache = new Map();
function buDe(ano, pl, uf, mun, z, s) {
  const key = [pl, uf, mun, z, s].join('/');
  if (!buCache.has(key)) {
    const p = (async () => {
      const dir = `${baseUrna(ano, pl)}/dados/${uf}/${mun}/${z}/${s}`;
      const aux = await getJSON(`${dir}/p${pad(pl, 6)}-${uf}-m${mun}-z${z}-s${s}-aux.json`, 10 * 60000);
      const nomeArq = h => (h.arq || []).map(a => typeof a === 'string' ? a : a.nm).find(n => /-bu\.dat$/i.test(n));
      const h = [...(aux.hashes || [])].reverse().find(nomeArq);
      if (!h) return null;
      const r = await fetch(`${dir}/${h.hash}/${nomeArq(h)}`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return lerBU(new Uint8Array(await r.arrayBuffer()));
    })();
    buCache.set(key, p); p.catch(() => buCache.delete(key));
  }
  return buCache.get(key);
}

/* ---------------- combinação de várias cidades / zonas / seções ---------------- */
// esc: { uf, por: 'cidade'|'zona'|'secao', muns: [cód], zonas: ['mun-zona'], secs: Set('mun-zona-seção') }
async function valores(s, esc, progresso) {
  const out = new Map(), notas = new Set(); let locais = null;
  if (esc.por === 'cidade') {
    const r = await valores1(s, { uf: esc.uf, nivel: 'estado' });
    for (const [id, x] of r.out) if (!esc.muns.length || esc.muns.includes(id)) out.set(id, x);
    if (r.nota) notas.add(r.nota);
  } else if (esc.por === 'zona') {
    await Promise.all(esc.muns.map(async m => {
      const r = await valores1(s, { uf: esc.uf, mun: m, nivel: 'cidade' });
      for (const [z, x] of r.out) { const id = m + '-' + z; if (!esc.zonas.length || esc.zonas.includes(id)) out.set(id, x); }
      if (r.nota) notas.add(r.nota);
    }));
  } else {
    let feito = 0;
    for (const mz of esc.zonas) {
      const [m, z] = mz.split('-');
      const r = await valores1(s, { uf: esc.uf, mun: m, zona: z, nivel: 'zona' }, (f, t) => progresso && progresso(feito + f / t, esc.zonas.length));
      for (const [sec, x] of r.out) { const id = mz + '-' + sec; if (!esc.secs.size || esc.secs.has(id)) out.set(id, x); }
      if (r.nota) notas.add(r.nota);
      if (r.locais) locais = Object.assign(locais || {}, { [mz]: r.locais });
      feito++;
    }
  }
  return { out, nota: [...notas].join(' '), locais };
}

/* ---------------- tela ---------------- */
const CMP = { modo: 'dif', ord: 'dif', dir: -1, marcados: new Set(), soMarcados: false };
const lista = v => (v || '').split(',').filter(Boolean);
// caixa de seleção múltipla com busca
function caixaMarcar(id, titulo, itens, marcados, dica) {
  const sel = new Set(marcados);
  const ord = [...itens].sort((a, b) => (sel.has(b.v) - sel.has(a.v)) || 0);
  return `<div class="card" style="padding:10px;min-width:0">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px"><b>${titulo}</b>
      <span class="sub" id="${id}Cont">${sel.size ? sel.size + ' marcad' + (sel.size > 1 ? 'os' : 'o') : esc(dica)}</span></div>
    <input class="search" data-busca="${id}" placeholder="Buscar…" style="margin:0 0 6px">
    <div class="rolagem" style="max-height:210px" id="${id}">${ord.map(x => `<label class="opc" data-txt="${esc(norm(x.t + ' ' + (x.s || '')))}" style="display:flex;gap:8px;align-items:center;padding:4px 6px;border-radius:6px;cursor:pointer">
      <input type="checkbox" value="${esc(x.v)}" ${sel.has(x.v) ? 'checked' : ''}> <span style="min-width:0">${esc(x.t)}${x.s ? ` <small style="color:var(--muted)">${esc(x.s)}</small>` : ''}</span></label>`).join('')}</div>
    <div style="display:flex;gap:8px;margin-top:6px"><button class="chip" data-limpa="${id}" style="cursor:pointer">Limpar</button><button class="chip" data-todos="${id}" style="cursor:pointer">Marcar visíveis</button></div>
  </div>`;
}

ABAS.comparar = async function () {
  const A = $('abaComparar');
  const q = S.q;
  const uf = q.get('uf') || 'rj';
  const por = ['cidade', 'zona', 'secao'].includes(q.get('por')) ? q.get('por') : 'cidade';
  const muns = lista(q.get('mun')), zonasSel = lista(q.get('zona')), secsSel = new Set(lista(q.get('sec')));
  const sa = lerSerie(q.get('a')) || lerSerie('2024.13.1.cand.'), sb = lerSerie(q.get('b')) || lerSerie('2026.6.1.cand.');
  const params = o => Object.fromEntries(Object.entries({ uf, por, mun: muns.join(','), zona: zonasSel.join(','), sec: [...secsSel].join(','), a: textoSerie(sa), b: textoSerie(sb), ...o }).filter(([, v]) => v));
  const link = o => '#/comparar?' + new URLSearchParams(params(o)).toString();
  const ir2 = o => { location.hash = link(o); };

  const geo = await getS(`geo/${uf}.json`);
  const nomeCid = cd => cap(geo.mu.find(m => m.t === cd)?.n || cd);
  const munUnico = muns.length === 1 ? muns[0] : '';

  // candidatos e partidos para escolher (municipais: da cidade marcada, se houver só uma)
  const [lca, lcb] = await Promise.all([candidatosDe(sa, uf, munUnico), candidatosDe(sb, uf, munUnico)]);
  const partidosDe = async s => {
    if (pres26(s)) return [...new Set((await candidatosDe(s, uf, '')).map(k => atual(k.sg)))];
    const P = await partidoUF(s.ano, uf), g = `c${cargoDoUF(uf, s.cargo)}t${s.turno}`, tot = new Map();
    for (const cd in P.mu) for (const [sg, v] of Object.entries(P.mu[cd][g] || {})) tot.set(atual(sg), (tot.get(atual(sg)) || 0) + v);
    return [...tot].sort((a, b) => b[1] - a[1]).map(x => x[0]);
  };
  const [pa, pb] = await Promise.all([partidosDe(sa), partidosDe(sb)]);
  const cartao = (s, lado_, lc, ps) => {
    const E = CMP_ELEICOES[s.ano];
    const set = o => link({ [lado_]: textoSerie({ ...s, ...o }) });
    const turnos = (s.cargo === '1' || s.cargo === '3' || s.cargo === '11') && s.ano !== '2026' ? ['1', '2'] : ['1'];
    let alvo;
    if (s.tipo === 'cand') {
      alvo = !E.geral && !munUnico ? '<div class="note">Eleição municipal: marque <b>uma</b> cidade em "Onde comparar" para listar os candidatos.</div>'
        : `<select class="sel-cand" data-lado="${lado_}" data-campo="alvo"><option value="">Escolha o candidato…</option>${lc.filter(k => k.total).slice(0, 1500).map(k => `<option value="${k.n}" ${String(k.n) === String(s.alvo) ? 'selected' : ''}>${esc(cap(k.nmu))} (${esc(k.sg)} ${k.n}) · ${fmt(k.total)}</option>`).join('')}</select>`;
    } else if (s.tipo === 'part') {
      alvo = `<select class="sel-cand" data-lado="${lado_}" data-campo="alvo"><option value="">Escolha o partido…</option>${ps.map(p => `<option ${p === s.alvo ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>`;
    } else {
      alvo = `<div class="seg" style="margin:4px 0 8px">${ORDEM_LADO.map(l => `<a href="${set({ alvo: l })}" style="padding:6px 11px;color:${s.alvo === l ? '#fff' : 'var(--ink-2)'};background:${s.alvo === l ? LADO_COR[l] : 'transparent'}">${LADO_NM[l]}</a>`).join('')}</div>`;
    }
    return `<div class="card" style="padding:14px;border-top:3px solid ${lado_ === 'a' ? '#4d9bff' : '#f59e0b'}">
      <div style="font-weight:700;margin-bottom:8px">${lado_ === 'a' ? 'Série A' : 'Série B'}</div>
      <div class="filtros" style="margin:0 0 6px">
        <select data-lado="${lado_}" data-campo="ano">${Object.entries(CMP_ELEICOES).map(([a, e]) => `<option value="${a}" ${a === s.ano ? 'selected' : ''}>${a} · ${e.geral ? 'geral' : 'municipal'}</option>`).join('')}</select>
        <select data-lado="${lado_}" data-campo="cargo">${E.cargos.map(c => `<option value="${c}" ${c === s.cargo ? 'selected' : ''}>${CMP_CARGO[c]}</option>`).join('')}</select>
        ${turnos.length > 1 ? `<select data-lado="${lado_}" data-campo="turno">${turnos.map(t => `<option value="${t}" ${t === s.turno ? 'selected' : ''}>${t}º turno</option>`).join('')}</select>` : ''}
      </div>
      <div class="seg" style="margin-bottom:6px">${Object.entries(CMP_TIPO).map(([k, v]) => `<a href="${set({ tipo: k, alvo: '' })}" style="padding:6px 11px;color:${s.tipo === k ? '#fff' : 'var(--ink-2)'};background:${s.tipo === k ? 'var(--accent)' : 'transparent'}">${v}</a>`).join('')}</div>
      ${alvo}</div>`;
  };

  // listas para marcar
  const itensCid = geo.mu.map(m => ({ v: m.t, t: cap(m.n) })).sort((x, y) => x.t.localeCompare(y.t));
  const zonasDasCidades = (await Promise.all(muns.map(async m => (await secZonasCompletas(uf, m)).map(z => ({ ...z, m }))))).flat();
  const itensZona = zonasDasCidades.map(z => ({ v: z.m + '-' + z.cd, t: `${muns.length > 1 ? nomeCid(z.m) + ' · ' : ''}Zona ${Number(z.cd)}`, s: `${z.sec.length} seções` }));
  // locais de votação (votação por seção de 2022) para mostrar e buscar pelo nome da escola
  const loc22 = {};
  if (por === 'secao') await Promise.all(zonasSel.map(async mz => { const [m, z] = mz.split('-'); const Z = await secao2022(uf, m, z); if (Z) loc22[mz] = Z; }));
  const nomeLocal = (mz, ns) => { const L = loc22[mz], l = L?.s?.[ns]?.l; return l ? cap(L.loc[l]?.[0] || '') : ''; };
  const itensSec = zonasDasCidades.filter(z => zonasSel.includes(z.m + '-' + z.cd))
    .flatMap(z => z.sec.map(x => ({ v: `${z.m}-${z.cd}-${x.ns}`, t: `${zonasSel.length > 1 ? 'Z' + Number(z.cd) + ' · ' : ''}Seção ${Number(x.ns)}`, s: nomeLocal(z.m + '-' + z.cd, x.ns) })));
  const btnPor = (k, t) => `<button data-por="${k}" class="${por === k ? 'on' : ''}">${t}</button>`;
  const pede = por === 'zona' && !muns.length ? 'Marque ao menos uma cidade para comparar zona a zona.'
    : por === 'secao' && !zonasSel.length ? (muns.length ? 'Marque ao menos uma zona para comparar seção a seção.' : 'Marque a cidade e depois as zonas para comparar seção a seção.')
    : por === 'secao' && zonasSel.length > 8 ? 'Marque no máximo 8 zonas na comparação por seção.' : '';

  A.innerHTML = `
    <h2 class="tit">Comparar</h2>
    <div class="sub">Compare duas votações (candidato, partido ou campo político, de 2014 a 2026) entre cidades, zonas eleitorais ou seções que você escolher.</div>
    <div class="filtros" style="margin-top:14px">${CMP_PRESETS.map((p, i) => `<button class="chip" data-preset="${i}" style="cursor:pointer" title="${esc(p.dica)}">${esc(p.nm)}</button>`).join('')}</div>
    <div class="grid2">${cartao(sa, 'a', lca, pa)}${cartao(sb, 'b', lcb, pb)}</div>
    <div class="card" style="padding:14px;margin-top:14px">
      <div style="font-weight:700;margin-bottom:6px">Onde comparar</div>
      <div class="filtros" style="margin:0 0 10px">
        <select id="cmpUf">${Object.keys(UF_NM).map(u => `<option value="${u}" ${u === uf ? 'selected' : ''}>${UF_NM[u]}</option>`).join('')}</select>
        <span class="sub">Detalhar por</span><div class="seg" id="cmpPor">${btnPor('cidade', 'Cidade')}${btnPor('zona', 'Zona')}${btnPor('secao', 'Seção')}</div>
      </div>
      <div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))">
        ${caixaMarcar('mkMun', 'Cidades', itensCid, muns, por === 'cidade' ? 'nenhuma = todas' : 'marque 1 ou mais')}
        ${por !== 'cidade' && muns.length ? caixaMarcar('mkZona', 'Zonas', itensZona, zonasSel, por === 'zona' ? 'nenhuma = todas' : 'marque 1 a 8') : ''}
        ${por === 'secao' && zonasSel.length ? caixaMarcar('mkSec', 'Seções', itensSec, [...secsSel], 'nenhuma = todas') : ''}
      </div>
      <div class="note">${por === 'cidade' ? 'Cada linha é uma cidade.' : por === 'zona' ? 'Cada linha é uma zona eleitoral das cidades marcadas.' : 'Cada linha é uma seção das zonas marcadas (2022: Dados Abertos do TSE; 2024 e 2026: boletins de urna).'}</div>
    </div>
    <div id="cmpRes" style="margin-top:14px"></div>`;

  // eventos
  A.querySelectorAll('select[data-lado]').forEach(el => el.onchange = () => {
    const s = el.dataset.lado === 'a' ? sa : sb, o = { [el.dataset.campo]: el.value };
    if (el.dataset.campo === 'ano') { o.cargo = CMP_ELEICOES[el.value].cargos.includes(s.cargo) ? s.cargo : CMP_ELEICOES[el.value].cargos[0]; o.turno = '1'; if (s.tipo === 'cand') o.alvo = ''; }
    if (el.dataset.campo === 'cargo') { o.turno = '1'; if (s.tipo === 'cand') o.alvo = ''; }
    ir2({ [el.dataset.lado]: textoSerie({ ...s, ...o }) });
  });
  A.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => { const p = CMP_PRESETS[b.dataset.preset]; ir2({ a: p.a, b: p.b }); });
  $('cmpUf').onchange = e => ir2({ uf: e.target.value, mun: '', zona: '', sec: '' });
  A.querySelectorAll('[data-por]').forEach(b => b.onclick = () => ir2({ por: b.dataset.por }));
  A.querySelectorAll('[data-busca]').forEach(inp => inp.oninput = () => {
    const t = norm(inp.value); $(inp.dataset.busca).querySelectorAll('.opc').forEach(l => { l.style.display = !t || l.dataset.txt.includes(t) ? 'flex' : 'none'; });
  });
  // marcar/desmarcar: aplica depois de uma pausa curta, para dar tempo de marcar várias
  let tempo;
  const aplica = () => {
    clearTimeout(tempo);
    tempo = setTimeout(() => {
      const val = id => $(id) ? [...$(id).querySelectorAll('input:checked')].map(i => i.value) : [];
      const m = val('mkMun'), z = val('mkZona').filter(x => m.includes(x.split('-')[0])), s = val('mkSec').filter(x => z.includes(x.split('-').slice(0, 2).join('-')));
      ir2({ mun: m.join(','), zona: z.join(','), sec: s.join(',') });
    }, 900);
  };
  A.querySelectorAll('#mkMun input, #mkZona input, #mkSec input').forEach(i => i.onchange = () => {
    const box = i.closest('.rolagem'), n = box.querySelectorAll('input:checked').length;
    $(box.id + 'Cont').textContent = n ? `${n} marcad${n > 1 ? 'os' : 'o'} · atualizando…` : 'atualizando…';
    aplica();
  });
  A.querySelectorAll('[data-limpa]').forEach(b => b.onclick = () => { $(b.dataset.limpa).querySelectorAll('input').forEach(i => { i.checked = false; }); aplica(); });
  A.querySelectorAll('[data-todos]').forEach(b => b.onclick = () => { $(b.dataset.todos).querySelectorAll('.opc').forEach(l => { if (l.style.display !== 'none') l.querySelector('input').checked = true; }); aplica(); });

  const R = $('cmpRes');
  const pronta = s => s.tipo !== 'cand' || s.alvo;
  if (pede) { R.innerHTML = `<div class="card empty" style="padding:14px">${pede}</div>`; return; }
  if (!pronta(sa) || !pronta(sb)) { R.innerHTML = `<div class="card empty" style="padding:14px">Escolha o ${!pronta(sa) ? 'candidato da série A' : 'candidato da série B'} para ver a comparação.</div>`; return; }
  R.innerHTML = `<div class="card" style="padding:14px"><div class="sub" id="cmpMsg">Calculando…</div><div class="prog"><i id="cmpProg" style="width:5%"></i></div></div>`;
  const prog = (f, t) => { const el = $('cmpProg'); if (el) el.style.width = Math.min(100, f / t * 100).toFixed(0) + '%'; };
  const escopo = { uf, por, muns, zonas: zonasSel, secs: secsSel };
  const [ra, rb] = await Promise.all([valores(sa, escopo, prog), valores(sb, escopo, prog)]);
  if (S.aba !== 'comparar') return;
  const nomeA = rotulo(sa, lca), nomeB = rotulo(sb, lcb);
  // locais de votação (da votação por seção de 2022, quando disponível)
  const locais = { ...(ra.locais || {}), ...(rb.locais || {}) };
  if (por === 'secao' && !Object.keys(locais).length) await Promise.all(zonasSel.map(async mz => { const [m, z] = mz.split('-'); const Z = await secao2022(uf, m, z); if (Z) locais[mz] = Z; }));
  const nomeUn = id => {
    const p = id.split('-');
    if (por === 'cidade') return nomeCid(id);
    if (por === 'zona') return `${muns.length > 1 ? nomeCid(p[0]) + ' · ' : ''}Zona ${Number(p[1])}`;
    const L = locais[p[0] + '-' + p[1]], loc = L?.s?.[p[2]]?.l, nl = loc && L.loc[loc]?.[0];
    return `${zonasSel.length > 1 ? 'Z' + Number(p[1]) + ' · ' : ''}Seção ${Number(p[2])}${nl ? ' · ' + cap(nl) : ''}`;
  };
  const ids = [...new Set([...ra.out.keys(), ...rb.out.keys()])];
  const linhas = ids.map(id => {
    const a = ra.out.get(id) || { v: 0, t: 0 }, b = rb.out.get(id) || { v: 0, t: 0 };
    const pa_ = a.t ? a.v / a.t : null, pb_ = b.t ? b.v / b.t : null;
    return { id, nome: nomeUn(id), a, b, pa: pa_, pb: pb_, dif: pa_ != null && pb_ != null ? pb_ - pa_ : null };
  }).filter(l => l.a.t || l.b.t);
  const notas = [ra.nota, rb.nota].filter(Boolean);
  if (!linhas.length) { R.innerHTML = `<div class="card" style="padding:14px">${notas.map(n => `<div class="empty">${esc(n)}</div>`).join('') || '<div class="empty">Sem dados para essa comparação.</div>'}</div>`; return; }
  const chave = JSON.stringify([uf, por, textoSerie(sa), textoSerie(sb)]);
  if (CMP.chave !== chave) { CMP.chave = chave; CMP.marcados = new Set(); CMP.soMarcados = false; }
  CMP.dados = { linhas, nomeA, nomeB, por, uf };
  desenhaResultado(R, notas);
};
function rotulo(s, lc) {
  const base = `${CMP_CARGO[s.cargo]} ${s.ano}${s.turno === '2' ? ' (2º t.)' : ''}`;
  if (s.tipo === 'cand') { const k = lc.find(x => String(x.n) === String(s.alvo)); return `${k ? cap(k.nmu) : 'Candidato ' + s.alvo} · ${base}`; }
  if (s.tipo === 'part') return `${s.alvo} · ${base}`;
  return `${LADO_NM[s.alvo] || s.alvo} · ${base}`;
}
async function secZonasCompletas(uf, mun) {
  try { return await zonasDe(uf, mun); } catch (e) { return []; }
}
function pearson(l) {
  const p = l.filter(x => x.pa != null && x.pb != null); if (p.length < 3) return null;
  const mx = p.reduce((s, x) => s + x.pa, 0) / p.length, my = p.reduce((s, x) => s + x.pb, 0) / p.length;
  let sxy = 0, sxx = 0, syy = 0; for (const x of p) { sxy += (x.pa - mx) * (x.pb - my); sxx += (x.pa - mx) ** 2; syy += (x.pb - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}
const unidade = (por, n) => por === 'cidade' ? (n === 1 ? 'cidade' : 'cidades') : por === 'zona' ? (n === 1 ? 'zona' : 'zonas') : (n === 1 ? 'seção' : 'seções');
function resumoCmp(l) {
  const VA = l.reduce((s, x) => s + x.a.v, 0), TA = l.reduce((s, x) => s + x.a.t, 0), VB = l.reduce((s, x) => s + x.b.v, 0), TB = l.reduce((s, x) => s + x.b.t, 0);
  return { VA, TA, VB, TB, r: pearson(l) };
}
function desenhaResultado(R, notas) {
  const { linhas, nomeA, nomeB, por, uf } = CMP.dados;
  const corA = '#4d9bff', corB = '#f59e0b';
  const marc = linhas.filter(l => CMP.marcados.has(l.id));
  const base = CMP.soMarcados && marc.length ? marc : linhas;
  const T = resumoCmp(base), M = marc.length ? resumoCmp(marc) : null;
  const forca = r => r == null ? '' : Math.abs(r) > .7 ? 'forte' : Math.abs(r) > .4 ? 'moderada' : 'fraca';
  const cartoes = (X, rot) => `
      <div class="stat" style="border-left:3px solid ${corA}"><span>A · ${esc(nomeA)}${rot}</span><b>${fmt(X.VA)}</b> <small style="color:var(--muted)">${pc(X.TA ? X.VA / X.TA * 100 : 0, 2)}</small></div>
      <div class="stat" style="border-left:3px solid ${corB}"><span>B · ${esc(nomeB)}${rot}</span><b>${fmt(X.VB)}</b> <small style="color:var(--muted)">${pc(X.TB ? X.VB / X.TB * 100 : 0, 2)}</small></div>
      <div class="stat"><span>B para cada 100 votos de A${rot}</span><b>${X.VA ? fmt(Math.round(X.VB / X.VA * 100)) : '—'}</b></div>
      <div class="stat"><span>Correlação${rot}</span><b>${X.r == null ? '—' : X.r.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</b> <small style="color:var(--muted)">${forca(X.r)}</small></div>`;
  R.innerHTML = `
    ${notas.map(n => `<div class="note" style="margin-bottom:8px">⚠️ ${esc(n)}</div>`).join('')}
    <div class="sub" style="margin-bottom:6px">${base.length} ${unidade(por, base.length)}${CMP.soMarcados && marc.length ? ' (só os marcados)' : ''}</div>
    <div class="stats" style="margin-top:0">${cartoes(T, '')}</div>
    ${M && !CMP.soMarcados ? `<div class="sub" style="margin:10px 0 6px">★ Soma dos ${marc.length} marcados</div><div class="stats" style="margin-top:0">${cartoes(M, '')}</div>` : ''}
    <div class="grid2" style="margin-top:14px">
      ${por === 'cidade' ? `<div class="card"><div class="filtros" style="margin:0 0 8px"><div class="seg">${[['a', 'A'], ['b', 'B'], ['dif', 'Diferença B − A']].map(([k, t]) => `<button data-modo="${k}" class="${CMP.modo === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
        <svg id="cmpMapa" style="width:100%;height:auto;display:block"></svg><div class="legend" id="cmpLeg"></div></div>` : ''}
      <div class="card"><div style="font-weight:600;margin-bottom:6px">Dispersão: % de A × % de B</div>${dispersao(base, corA, corB)}
        <div class="note">Cada ponto é ${por === 'cidade' ? 'uma cidade' : por === 'zona' ? 'uma zona' : 'uma seção'}${marc.length ? '; os marcados têm contorno branco' : ''}. Acima da linha, B foi proporcionalmente melhor que A.</div></div>
    </div>
    <div class="card" style="padding:14px;margin-top:14px">
      <div class="filtros" style="margin:0 0 8px;justify-content:space-between">
        <input class="search" id="cmpBusca" placeholder="Filtrar a tabela…" style="max-width:260px;margin:0">
        <label class="sub" style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" id="cmpSo" ${CMP.soMarcados ? 'checked' : ''}> Mostrar só os marcados</label>
        <button class="chip" id="cmpLimpa" style="cursor:pointer">Desmarcar todos</button>
        <button class="chip" id="cmpCsv" style="cursor:pointer">⬇ Baixar planilha (CSV)</button></div>
      <div class="rolagem"><table class="tab"><thead><tr><th style="width:28px">★</th>
        <th data-ord="nome">${por === 'cidade' ? 'Cidade' : por === 'zona' ? 'Zona' : 'Seção'}</th>
        <th class="n" data-ord="av" style="color:${corA}">A votos</th><th class="n" data-ord="pa" style="color:${corA}">A %</th>
        <th class="n" data-ord="bv" style="color:${corB}">B votos</th><th class="n" data-ord="pb" style="color:${corB}">B %</th>
        <th class="n" data-ord="dif">B − A (p.p.)</th><th class="n" data-ord="razao">B / A</th></tr></thead><tbody id="cmpTab"></tbody></table></div>
      <div class="note">Marque linhas para somar e destacar no gráfico. % sobre os votos válidos do cargo em cada ${por === 'cidade' ? 'cidade' : por === 'zona' ? 'zona' : 'seção'}. Clique no cabeçalho para ordenar.</div>
    </div>`;
  if (por === 'cidade') mapaCmp(uf);
  R.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => { CMP.modo = b.dataset.modo; R.querySelectorAll('[data-modo]').forEach(x => x.classList.toggle('on', x === b)); mapaCmp(uf); });
  const tabela = () => {
    const q = norm($('cmpBusca').value);
    const val = (l, k) => k === 'nome' ? l.nome : k === 'av' ? l.a.v : k === 'bv' ? l.b.v : k === 'razao' ? (l.a.v ? l.b.v / l.a.v : -1) : (l[k] ?? -9);
    const lst = base.filter(l => !q || norm(l.nome).includes(q)).sort((x, y) => {
      const a = val(x, CMP.ord), b = val(y, CMP.ord);
      return (typeof a === 'string' ? a.localeCompare(b) : a - b) * CMP.dir;
    });
    $('cmpTab').innerHTML = lst.slice(0, 800).map(l => `<tr data-id="${l.id}"><td><input type="checkbox" data-mk="${l.id}" ${CMP.marcados.has(l.id) ? 'checked' : ''}></td><td>${esc(l.nome)}</td>
      <td class="n">${fmt(l.a.v)}</td><td class="n">${l.pa == null ? '—' : pc(l.pa * 100, 2)}</td>
      <td class="n">${fmt(l.b.v)}</td><td class="n">${l.pb == null ? '—' : pc(l.pb * 100, 2)}</td>
      <td class="n ${l.dif >= 0 ? 'up' : 'dn'}">${l.dif == null ? '—' : (l.dif >= 0 ? '+' : '') + (l.dif * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td class="n">${l.a.v ? (l.b.v / l.a.v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—'}</td></tr>`).join('');
  };
  $('cmpBusca').oninput = tabela; tabela();
  R.querySelectorAll('th[data-ord]').forEach(th => th.onclick = () => { CMP.dir = CMP.ord === th.dataset.ord ? -CMP.dir : (th.dataset.ord === 'nome' ? 1 : -1); CMP.ord = th.dataset.ord; tabela(); });
  const redesenha = () => { const y = scrollY, busca = $('cmpBusca').value; desenhaResultado(R, notas); $('cmpBusca').value = busca; if (busca) $('cmpBusca').oninput(); scrollTo(0, y); };
  $('cmpTab').onchange = e => { const c = e.target.closest('[data-mk]'); if (!c) return; c.checked ? CMP.marcados.add(c.dataset.mk) : CMP.marcados.delete(c.dataset.mk); redesenha(); };
  $('cmpSo').onchange = e => { CMP.soMarcados = e.target.checked; redesenha(); };
  $('cmpLimpa').onclick = () => { CMP.marcados.clear(); CMP.soMarcados = false; redesenha(); };
  $('cmpCsv').onclick = () => {
    const cab = ['unidade', 'marcado', 'A_votos', 'A_validos', 'A_pct', 'B_votos', 'B_validos', 'B_pct', 'B_menos_A_pp'];
    const lin = base.map(l => [l.nome, CMP.marcados.has(l.id) ? 'sim' : '', l.a.v, l.a.t, l.pa == null ? '' : (l.pa * 100).toFixed(3), l.b.v, l.b.t, l.pb == null ? '' : (l.pb * 100).toFixed(3), l.dif == null ? '' : (l.dif * 100).toFixed(3)]);
    const csv = '﻿' + [`# A: ${nomeA}`, `# B: ${nomeB}`, cab.join(';'), ...lin.map(x => x.map(v => String(v).replace('.', ',')).join(';'))].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'comparacao.csv'; a.click();
  };
}
function dispersao(linhas, corA, corB) {
  const p = linhas.filter(x => x.pa != null && x.pb != null);
  const max = Math.max(0.001, ...p.map(x => Math.max(x.pa, x.pb))) * 1.05;
  const W = 420, H = 320, m = 40;
  const X = v => m + v / max * (W - m - 10), Y = v => H - m - v / max * (H - m - 10);
  const tt = Math.max(1, ...p.map(x => x.a.t + x.b.t));
  const ticks = [0, .25, .5, .75, 1].map(f => f * max);
  const ord = [...p].sort((a, b) => CMP.marcados.has(a.id) - CMP.marcados.has(b.id));
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:560px;height:auto;display:block;margin:0 auto">
    ${ticks.map(t => `<line x1="${X(t)}" y1="${Y(0)}" x2="${X(t)}" y2="${Y(max)}" stroke="var(--grid)"/><line x1="${X(0)}" y1="${Y(t)}" x2="${X(max)}" y2="${Y(t)}" stroke="var(--grid)"/>
      <text x="${X(t)}" y="${H - m + 14}" font-size="10" fill="var(--muted)" text-anchor="middle">${(t * 100).toFixed(t * 100 < 10 ? 1 : 0)}%</text>
      <text x="${m - 4}" y="${Y(t) + 3}" font-size="10" fill="var(--muted)" text-anchor="end">${(t * 100).toFixed(t * 100 < 10 ? 1 : 0)}%</text>`).join('')}
    <line x1="${X(0)}" y1="${Y(0)}" x2="${X(max)}" y2="${Y(max)}" stroke="var(--muted)" stroke-dasharray="4 4"/>
    ${ord.map(x => { const mk = CMP.marcados.has(x.id); return `<circle cx="${X(x.pa).toFixed(1)}" cy="${Y(x.pb).toFixed(1)}" r="${(2.5 + 9 * Math.sqrt((x.a.t + x.b.t) / tt)).toFixed(1)}" fill="${x.dif >= 0 ? corB : corA}" fill-opacity="${mk ? .95 : CMP.marcados.size ? .25 : .55}" stroke="#fff" stroke-width="${mk ? 2 : .5}" stroke-opacity="${mk ? 1 : .3}"><title>${esc(x.nome)} · A ${pc(x.pa * 100, 2)} · B ${pc(x.pb * 100, 2)}</title></circle>`; }).join('')}
    <text x="${(W + m) / 2}" y="${H - 6}" font-size="11" fill="${corA}" text-anchor="middle">% de A</text>
    <text x="12" y="${(H - m) / 2}" font-size="11" fill="${corB}" text-anchor="middle" transform="rotate(-90 12 ${(H - m) / 2})">% de B</text></svg>`;
}
async function mapaCmp(uf) {
  const svgM = $('cmpMapa'); if (!svgM) return;
  const g = await getS(`geo/${uf}.json`);
  const { linhas } = CMP.dados, por = new Map(linhas.map(l => [l.id, l]));
  const modo = CMP.modo;
  const vals = linhas.map(l => modo === 'dif' ? l.dif : modo === 'a' ? l.pa : l.pb).filter(v => v != null);
  const maxAbs = Math.max(0.0001, ...vals.map(Math.abs));
  const corDe = l => {
    const v = l && (modo === 'dif' ? l.dif : modo === 'a' ? l.pa : l.pb);
    if (v == null) return 'var(--land)';
    if (modo === 'dif') return `color-mix(in srgb, ${v >= 0 ? '#f59e0b' : '#4d9bff'} ${Math.round(12 + 88 * Math.abs(v) / maxAbs)}%, #15294d)`;
    return `color-mix(in srgb, ${modo === 'a' ? '#4d9bff' : '#f59e0b'} ${Math.round(8 + 92 * Math.sqrt(v / maxAbs))}%, #15294d)`;
  };
  svgM.setAttribute('viewBox', `0 0 ${g.w} ${g.h}`);
  svgM.innerHTML = g.mu.map(m => { const l = por.get(m.t), mk = CMP.marcados.has(m.t); return `<path d="${m.d}" fill="${corDe(l)}" stroke="${mk ? '#fff' : '#0a1830'}" stroke-width="${mk ? 2 : .6}" vector-effect="non-scaling-stroke" fill-rule="evenodd" data-t="${m.t}" style="cursor:pointer"><title>${esc(cap(m.n))}${l ? ` · A ${l.pa == null ? '—' : pc(l.pa * 100, 2)} · B ${l.pb == null ? '—' : pc(l.pb * 100, 2)}` : ' · fora da seleção'}</title></path>`; }).join('');
  // clicar numa cidade marca/desmarca
  svgM.onclick = e => {
    const p = e.target.closest('path[data-t]'); if (!p || !por.has(p.dataset.t)) return;
    const id = p.dataset.t; CMP.marcados.has(id) ? CMP.marcados.delete(id) : CMP.marcados.add(id);
    const y = scrollY; desenhaResultado($('cmpRes'), []); scrollTo(0, y);
  };
  $('cmpLeg').innerHTML = (modo === 'dif'
    ? `<span><i class="sw" style="background:#4d9bff"></i>A proporcionalmente melhor</span><span><i class="sw" style="background:#f59e0b"></i>B proporcionalmente melhor</span><span style="margin-left:auto;color:var(--muted)">até ${pc(maxAbs * 100, 1).replace('%', '')} p.p.</span>`
    : `<span><i class="sw" style="background:${modo === 'a' ? '#4d9bff' : '#f59e0b'}"></i>mais forte = maior % (até ${pc(maxAbs * 100, 1)})</span>`)
    + '<span style="color:var(--muted)">clique numa cidade para marcar</span>';
}
