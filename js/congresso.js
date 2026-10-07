/* Aba Congresso: hemiciclos da Câmara, do Senado e das Assembleias, coloridos por esquerda/centro/direita,
   com comparação com a composição eleita na eleição anterior. Dados: resumo/<ano>.json (Dados Abertos do TSE). */
const RESUMO = {};
function resumo(ano) {
  if (!RESUMO[ano]) { const p = getJSON(`resumo/${ano}.json`, Infinity); p.then(v => { p.v = v; }, () => { delete RESUMO[ano]; }); RESUMO[ano] = p; }
  return RESUMO[ano];
}

// posições das cadeiras num semicírculo (fileiras proporcionais ao raio), da esquerda para a direita
function cadeiras(n) {
  const filas = Math.max(3, Math.round(Math.sqrt(n / 3.2)));
  const r0 = 0.38, r1 = 1, raios = Array.from({ length: filas }, (_, i) => r0 + (r1 - r0) * i / (filas - 1));
  const soma = raios.reduce((s, r) => s + r, 0);
  let qtd = raios.map(r => Math.floor(n * r / soma));
  let falta = n - qtd.reduce((s, x) => s + x, 0);
  for (let i = filas - 1; falta > 0; i = (i - 1 + filas) % filas, falta--) qtd[i]++;
  const pos = [];
  raios.forEach((r, i) => {
    const q = qtd[i];
    for (let j = 0; j < q; j++) {
      const a = Math.PI * (1 - (q === 1 ? .5 : j / (q - 1)));
      pos.push({ x: Math.cos(a) * r, y: -Math.sin(a) * r, a });
    }
  });
  pos.sort((p, q) => q.a - p.a || Math.hypot(p.x, p.y) - Math.hypot(q.x, q.y));
  // raio da cadeira: menor que metade da distância entre fileiras e entre vizinhas da mesma fileira
  const passoFila = (r1 - r0) / (filas - 1);
  const passoArco = Math.min(...raios.map((r, i) => qtd[i] > 1 ? Math.PI * r / (qtd[i] - 1) : 9));
  return { pos, rr: 0.46 * Math.min(passoFila, passoArco) };
}
function corPartidoLado(sg, k) {
  // tons do lado, alternando por partido para dar para distinguir as bancadas
  const base = LADO_COR[lado(sg)];
  return k % 2 ? base : `color-mix(in srgb, ${base} 72%, white)`;
}
function hemiciclo(membros, opt = {}) {
  // membros: [{nm, sg, uf, v, extra}] ; ordena esquerda -> direita, maiores bancadas no meio de cada lado.
  // Com muitas cadeiras (ex.: todos os prefeitos do Brasil), cada ponto passa a valer k cadeiras.
  const porPart = new Map();
  for (const m of membros) (porPart.get(m.sg) || porPart.set(m.sg, []).get(m.sg)).push(m);
  const partes = [...porPart.entries()].sort((a, b) => ORDEM_LADO.indexOf(lado(a[0])) - ORDEM_LADO.indexOf(lado(b[0])) || b[1].length - a[1].length);
  const k = membros.length > 700 ? Math.ceil(membros.length / 600) : 1;
  const ord = [];
  partes.forEach(([sg, l], i) => {
    l.sort((a, b) => b.v - a.v);
    if (k === 1) l.forEach(m => ord.push({ ...m, cor: corPartidoLado(sg, i) }));
    else for (let j = 0, q = Math.max(1, Math.round(l.length / k)); j < q; j++) ord.push({ nm: `${sg}: ${l.length} cadeiras`, sg, uf: '', v: 0, agreg: l.length, cor: corPartidoLado(sg, i) });
  });
  const { pos, rr } = cadeiras(ord.length);
  const W = 1000, H = 540, cx = W / 2, cy = 510, R = 480;
  let h = `<svg class="hemi" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.titulo || 'Composição')}">`;
  pos.forEach((p, i) => {
    const m = ord[i]; if (!m) return;
    h += `<circle cx="${(cx + p.x * R).toFixed(1)}" cy="${(cy + p.y * R).toFixed(1)}" r="${(rr * R).toFixed(1)}" fill="${m.cor}" ${m.apagado ? 'fill-opacity=".45"' : ''} data-i="${i}" data-sg="${esc(m.sg)}"/>`;
  });
  h += `<text x="${cx}" y="${cy - 40}" text-anchor="middle" fill="#12243A" font-size="64" font-weight="700">${fmt(membros.length)}</text>`;
  h += `<text x="${cx}" y="${cy}" text-anchor="middle" fill="#526277" font-size="22">${esc(opt.legenda || 'cadeiras')}${k > 1 ? ` · cada ponto ≈ ${k}` : ''}</text></svg>`;
  return { html: h, ord, k };
}
function barraLados(cont, total, ant) {
  return `<div class="lados">${ORDEM_LADO.map(l => cont[l] ? `<i style="width:${cont[l] / total * 100}%;background:${LADO_COR[l]}" title="${LADO_NM[l]}">${LADO_NM[l]} ${fmt(cont[l])}</i>` : '').join('')}</div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:13px">${ORDEM_LADO.map(l => {
      const d = ant ? (cont[l] || 0) - (ant[l] || 0) : null;
      return `<span><i class="sw" style="background:${LADO_COR[l]}"></i>${LADO_NM[l]}: <b>${fmt(cont[l] || 0)}</b> ${d == null ? '' : `<span class="${d >= 0 ? 'up' : 'dn'}">(${d >= 0 ? '+' : ''}${fmt(d)})</span>`}</span>`;
    }).join('')}${ant ? '<span style="color:var(--muted)">entre parênteses: diferença para a eleição anterior</span>' : ''}</div>`;
}
const contaLados = l => { const c = { esquerda: 0, centro: 0, direita: 0 }; for (const m of l) c[lado(m.sg)]++; return c; };
const contaPart = l => { const c = new Map(); for (const m of l) { const p = atual(m.sg); c.set(p, (c.get(p) || 0) + 1); } return c; };

function eleitosDe(R, cargo, ufs) {
  const out = [];
  for (const uf of ufs) for (const e of R.uf[uf]?.[`c${cargo === '7' && uf === 'df' ? '8' : cargo}t1`]?.eleitos || []) out.push({ nm: e[0], sg: e[1], n: e[2], v: e[3], sit: e[4], uf });
  return out;
}
// eleitos municipais (prefeitos e vereadores) de um estado
const eleitosMun = (ano, uf) => getJSON(`eleitosmun/${ano}/${uf}.json`, Infinity).catch(() => ({ mu: {} }));

ABAS.congresso = async function () {
  const A = $('abaCongresso');
  const esfera = ['federal', 'estadual', 'municipal'].includes(S.q.get('esfera')) ? S.q.get('esfera') : (S.q.get('casa') === 'assembleia' ? 'estadual' : 'federal');
  const casa = S.q.get('casa') === 'senado' ? 'senado' : 'camara';
  const uf = S.q.get('uf') || '', mun = S.q.get('mun') || '';
  const link = o => '#/congresso?' + new URLSearchParams(Object.fromEntries(Object.entries({ esfera, casa, uf, mun, ...o }).filter(([, v]) => v))).toString();
  A.innerHTML = `<h2 class="tit">Composição eleita</h2><div class="sub">carregando…</div>`;
  const todas = Object.keys(UF_NM);
  const ufs = uf ? [uf] : todas;
  let membros, anteriores, titulo, sub, nota = '', extra = '', abaixo = '';

  if (esfera === 'municipal') {
    const [E24, E20] = await Promise.all([Promise.all(ufs.map(u => eleitosMun('2024', u))), Promise.all(ufs.map(u => eleitosMun('2020', u)))]);
    const nomeCid = uf ? await getJSON(`geo/${uf}.json`, Infinity).then(g => new Map(g.mu.map(m => [m.t, cap(m.n)]))).catch(() => new Map()) : new Map();
    if (mun && uf) {
      const a = E24[0].mu[mun] || { v: [] }, b = E20[0].mu[mun] || { v: [] };
      membros = a.v.map(x => ({ nm: x[0], sg: x[1], n: x[2], v: x[3], uf, sit: 'Vereador eleito' }));
      anteriores = b.v.map(x => ({ nm: x[0], sg: x[1], n: x[2], v: x[3], uf }));
      titulo = `Câmara Municipal · ${nomeCid.get(mun) || mun} (2025–2028)`;
      sub = 'Vereadores eleitos em 2024; comparação com a Câmara eleita em 2020.';
      const pf = p => p ? `<b>${esc(cap(p[0]))}</b> · ${esc(p[1])} · ${fmt(p[3])} votos${p[4] === '2' ? ' (2º turno)' : ''}` : '<span style="color:var(--muted)">sem eleito registrado</span>';
      extra = `<div class="card" style="padding:14px;margin-bottom:14px"><div class="stats" style="margin:0">
        <div class="stat"><span>Prefeito eleito em 2024</span><div style="font-size:14px;margin-top:2px">${pf(a.p)}</div></div>
        <div class="stat"><span>Prefeito eleito em 2020</span><div style="font-size:14px;margin-top:2px">${pf(b.p)}</div></div></div></div>`;
    } else {
      const prefs = (E, ano) => E.flatMap((e, i) => Object.entries(e.mu).filter(([, m]) => m.p).map(([cd, m]) => ({ nm: m.p[0], sg: m.p[1], n: m.p[2], v: m.p[3], uf: ufs[i], cid: cd, sit: 'Prefeito eleito em ' + ano })));
      membros = prefs(E24, '2024'); anteriores = prefs(E20, '2020');
      membros.forEach(m => { m.extra = uf ? (nomeCid.get(m.cid) || m.cid) : m.uf.toUpperCase(); });
      titulo = `Prefeitos eleitos em 2024 · ${uf ? UF_NM[uf] : 'Brasil'}`;
      sub = 'Prefeituras conquistadas por partido; comparação com 2020. Escolha uma cidade para ver a Câmara de Vereadores.';
      const ver = E24.flatMap(e => Object.values(e.mu).flatMap(m => m.v)), ver20 = E20.flatMap(e => Object.values(e.mu).flatMap(m => m.v));
      const cv = contaLados(ver.map(x => ({ sg: x[1] }))), cv20 = contaLados(ver20.map(x => ({ sg: x[1] })));
      extra = `<div class="card" style="padding:14px;margin-bottom:14px"><b>Vereadores eleitos em 2024 · ${uf ? UF_NM[uf] : 'Brasil'}: ${fmt(ver.length)}</b>${barraLados(cv, ver.length, cv20)}</div>`;
    }
  } else {
    const [R26, R22, R18] = await Promise.all([resumo('2026'), resumo('2022'), resumo('2018')]);
    if (esfera === 'federal' && casa === 'senado') {
      // Senado a partir de 2027: 54 eleitos em 2026 + 27 eleitos em 2022 (mandato até 2031)
      const n26 = eleitosDe(R26, '5', ufs), n22 = eleitosDe(R22, '5', ufs).map(m => ({ ...m, apagado: true, extra: 'eleito em 2022, mandato até 2031' }));
      membros = [...n26, ...n22];
      anteriores = [...eleitosDe(R22, '5', ufs), ...eleitosDe(R18, '5', ufs)];
      titulo = `Senado Federal a partir de 2027${uf ? ' · ' + UF_NM[uf] : ''}`;
      sub = 'Eleitos em 04/10/2026, pelo partido da eleição.';
      nota = 'Cadeiras mais claras: senadores eleitos em 2022 (o mandato vai até 2031). Comparação: Senado de 2023–2027 (eleitos em 2018 e 2022).';
    } else if (esfera === 'federal') {
      membros = eleitosDe(R26, '6', ufs); anteriores = eleitosDe(R22, '6', ufs);
      titulo = `Câmara dos Deputados (2027–2031)${uf ? ' · bancada de ' + UF_NM[uf] : ''}`;
      sub = 'Eleitos em 04/10/2026, pelo partido da eleição; comparação com 2022.';
    } else {
      membros = eleitosDe(R26, '7', ufs); anteriores = eleitosDe(R22, '7', ufs);
      titulo = uf ? (uf === 'df' ? 'Câmara Legislativa do DF (2027–2031)' : `Assembleia Legislativa · ${UF_NM[uf]} (2027–2031)`) : 'Assembleias Legislativas · todos os estados (2027–2031)';
      sub = 'Deputados estaduais eleitos em 04/10/2026; comparação com 2022.';
      const gov = ufs.map(u => { const g = R26.uf[u]?.c3t1; const el = g?.eleitos?.[0]; const t2 = (g?.top || []).filter(x => /2º TURNO/i.test(x[4])); return { u, el, t2 }; });
      abaixo = `<div class="card" style="padding:14px;margin-top:14px"><b>Governador${uf ? '' : 'es'}</b>
        <div style="margin-top:6px;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:2px 10px">${gov.map(({ u, el, t2 }) => `<div class="li" style="cursor:default"><div><div class="t">${UF_NM[u]}</div>
          <div class="m">${el ? `<span class="tag el">Eleito</span> ${esc(cap(el[0]))} · ${esc(el[1])}` : t2.length ? `<span class="tag t2">2º turno</span> ${t2.map(x => esc(cap(x[0])) + ' (' + esc(x[1]) + ')').join(' × ')}` : '—'}</div></div></div>`).join('')}</div></div>`;
    }
  }

  const H = hemiciclo(membros, { titulo, legenda: esfera === 'municipal' ? (mun ? 'vereadores' : 'prefeituras') : casa === 'senado' && esfera === 'federal' ? 'senadores' : 'deputados' });
  const cl = contaLados(membros), ca = contaLados(anteriores);
  const cp = contaPart(membros), cpa = contaPart(anteriores);
  const partes = [...new Set([...cp.keys(), ...cpa.keys()])].map(p => ({ p, n: cp.get(p) || 0, a: cpa.get(p) || 0 })).sort((x, y) => y.n - x.n || y.a - x.a);
  const seg = (lista, atual_, campo) => `<div class="seg">${lista.map(([k, t]) => `<a href="${link({ [campo]: k, ...(campo === 'esfera' ? { mun: '' } : {}) })}" style="padding:7px 13px;display:inline-block;color:${atual_ === k ? '#fff' : 'var(--ink-2)'};background:${atual_ === k ? 'var(--navy)' : 'transparent'}">${t}</a>`).join('')}</div>`;
  const cidades = esfera === 'municipal' && uf ? await getJSON(`geo/${uf}.json`, Infinity).then(g => [...g.mu].sort((a, b) => a.n.localeCompare(b.n))).catch(() => []) : [];
  const anoAnt = esfera === 'municipal' ? '2020' : '2022';
  A.innerHTML = `
    <h2 class="tit">${esc(titulo)}</h2>
    <div class="sub">${esc(sub)} Fonte: TSE (Dados Abertos).</div>
    <div class="filtros">
      ${seg([['federal', 'Federal'], ['estadual', 'Estadual'], ['municipal', 'Municipal']], esfera, 'esfera')}
      ${esfera === 'federal' ? seg([['camara', 'Câmara'], ['senado', 'Senado']], casa, 'casa') : ''}
      <select id="cgUf"><option value="">Brasil (todos os estados)</option>${todas.map(u => `<option value="${u}" ${u === uf ? 'selected' : ''}>${UF_NM[u]}</option>`).join('')}</select>
      ${esfera === 'municipal' && uf ? `<select id="cgMun"><option value="">Todas as cidades (prefeitos)</option>${cidades.map(m => `<option value="${m.t}" ${m.t === mun ? 'selected' : ''}>${esc(cap(m.n))}</option>`).join('')}</select>` : ''}
    </div>
    ${esfera === 'municipal' && !uf ? '<div class="note" style="margin:-4px 0 10px">Escolha um estado para ver as cidades e as Câmaras de Vereadores.</div>' : ''}
    ${extra}
    <div class="grid2">
      <div class="card">${H.html}${barraLados(cl, membros.length, anteriores.length ? ca : null)}
        ${nota ? `<div class="note">${nota}</div>` : ''}
        <div class="note">Passe o mouse (ou toque) nos pontos para ver ${H.k > 1 ? 'o partido' : 'quem é'}.</div>
        <div id="cgSel" class="sub" style="min-height:40px;margin-top:6px"></div></div>
      <div class="card"><h3 style="margin-top:0">Por partido</h3>
        <div class="rolagem"><table class="tab"><thead><tr><th>Partido</th><th>Lado</th><th class="n">Agora</th><th class="n">${anoAnt}</th><th class="n">Δ</th></tr></thead><tbody>
        ${partes.map(x => `<tr data-p="${esc(x.p)}" style="cursor:pointer"><td><b>${esc(x.p)}</b></td><td><i class="sw" style="background:${LADO_COR[lado(x.p)]}"></i>${LADO_NM[lado(x.p)]}</td>
          <td class="n"><b>${fmt(x.n)}</b></td><td class="n">${fmt(x.a)}</td><td class="n ${x.n - x.a >= 0 ? 'up' : 'dn'}">${x.n - x.a >= 0 ? '+' : ''}${fmt(x.n - x.a)}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="note">Siglas antigas somadas ao partido atual (ex.: PSL e DEM → UNIÃO; PTB e Patriota → PRD). Clique num partido para destacar.</div></div>
    </div>
    ${abaixo}
    <div class="card" style="padding:14px;margin-top:14px"><h3 style="margin-top:0">Eleitos (${fmt(membros.length)})</h3>
      <input class="search" id="cgBusca" placeholder="Buscar nome, partido ou ${esfera === 'municipal' && uf ? 'cidade' : 'estado'}…" style="max-width:360px">
      <div class="rolagem"><table class="tab"><thead><tr><th>Nome</th><th>Partido</th><th>${esfera === 'municipal' && uf && !mun ? 'Cidade' : 'UF'}</th><th class="n">Votos</th><th>Situação</th></tr></thead><tbody id="cgLista"></tbody></table></div></div>`;
  $('cgUf').onchange = e => { location.hash = link({ uf: e.target.value, mun: '' }); };
  if ($('cgMun')) $('cgMun').onchange = e => { location.hash = link({ mun: e.target.value }); };
  const svgH = A.querySelector('svg.hemi');
  const info = m => m.agreg ? `<b>${esc(m.sg)}</b> · ${fmt(m.agreg)} cadeiras` : `<b>${esc(cap(m.nm))}</b> · ${esc(m.sg)}${m.extra && esfera === 'municipal' ? ' · ' + esc(m.extra) : ' · ' + m.uf.toUpperCase()} · ${fmt(m.v)} votos ${m.extra && esfera !== 'municipal' ? `<span style="color:var(--muted)">(${m.extra})</span>` : `· ${esc(cap(m.sit || ''))}`}`;
  const mostra = e => { const c = e.target.closest('circle'); if (c) $('cgSel').innerHTML = info(H.ord[c.dataset.i]); };
  svgH.addEventListener('mousemove', mostra); svgH.addEventListener('click', mostra);
  A.querySelectorAll('tr[data-p]').forEach(tr => tr.onclick = () => {
    const p = tr.dataset.p, ativo = tr.classList.toggle('on');
    A.querySelectorAll('tr[data-p]').forEach(o => { if (o !== tr) o.classList.remove('on'); });
    svgH.querySelectorAll('circle').forEach(c => c.classList.toggle('apaga', ativo && atual(c.dataset.sg) !== p));
  });
  const lista = () => {
    const q = norm($('cgBusca').value);
    $('cgLista').innerHTML = [...membros].sort((a, b) => b.v - a.v)
      .filter(m => !q || norm(m.nm + ' ' + m.sg + ' ' + m.uf + ' ' + (UF_NM[m.uf] || '') + ' ' + (m.extra || '')).includes(q)).slice(0, 1500)
      .map(m => `<tr><td>${esc(cap(m.nm))}</td><td><i class="sw" style="background:${LADO_COR[lado(m.sg)]}"></i>${esc(m.sg)}</td><td>${esc(esfera === 'municipal' && m.extra ? m.extra : m.uf.toUpperCase())}</td><td class="n">${fmt(m.v)}</td><td style="color:var(--muted)">${esc(esfera !== 'municipal' && m.extra ? m.extra : cap(m.sit || ''))}</td></tr>`).join('');
  };
  $('cgBusca').oninput = lista; lista();
};
