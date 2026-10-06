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
  // membros: [{nm, sg, uf, v, extra}] ; ordena esquerda -> direita, maiores bancadas no meio de cada lado
  const porPart = new Map();
  for (const m of membros) (porPart.get(m.sg) || porPart.set(m.sg, []).get(m.sg)).push(m);
  const partes = [...porPart.entries()].sort((a, b) => ORDEM_LADO.indexOf(lado(a[0])) - ORDEM_LADO.indexOf(lado(b[0])) || b[1].length - a[1].length);
  const ord = [];
  partes.forEach(([sg, l], k) => l.sort((a, b) => b.v - a.v).forEach(m => ord.push({ ...m, cor: corPartidoLado(sg, k) })));
  const { pos, rr } = cadeiras(ord.length);
  const W = 1000, H = 540, cx = W / 2, cy = 510, R = 480;
  let h = `<svg class="hemi" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.titulo || 'Composição')}">`;
  pos.forEach((p, i) => {
    const m = ord[i]; if (!m) return;
    h += `<circle cx="${(cx + p.x * R).toFixed(1)}" cy="${(cy + p.y * R).toFixed(1)}" r="${(rr * R).toFixed(1)}" fill="${m.cor}" ${m.apagado ? 'fill-opacity=".45"' : ''} data-i="${i}" data-sg="${esc(m.sg)}"/>`;
  });
  h += `<text x="${cx}" y="${cy - 40}" text-anchor="middle" fill="#fff" font-size="64" font-weight="700">${ord.length}</text>`;
  h += `<text x="${cx}" y="${cy}" text-anchor="middle" fill="#7f93b8" font-size="22">${esc(opt.legenda || 'cadeiras')}</text></svg>`;
  return { html: h, ord };
}
function barraLados(cont, total, ant) {
  return `<div class="lados">${ORDEM_LADO.map(l => cont[l] ? `<i style="width:${cont[l] / total * 100}%;background:${LADO_COR[l]}" title="${LADO_NM[l]}">${LADO_NM[l]} ${cont[l]}</i>` : '').join('')}</div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:13px">${ORDEM_LADO.map(l => {
      const d = ant ? (cont[l] || 0) - (ant[l] || 0) : null;
      return `<span><i class="sw" style="background:${LADO_COR[l]}"></i>${LADO_NM[l]}: <b>${cont[l] || 0}</b> ${d == null ? '' : `<span class="${d >= 0 ? 'up' : 'dn'}">(${d >= 0 ? '+' : ''}${d})</span>`}</span>`;
    }).join('')}${ant ? '<span style="color:var(--muted)">entre parênteses: diferença para a eleição anterior</span>' : ''}</div>`;
}
const contaLados = l => { const c = { esquerda: 0, centro: 0, direita: 0 }; for (const m of l) c[lado(m.sg)]++; return c; };
const contaPart = l => { const c = new Map(); for (const m of l) { const p = atual(m.sg); c.set(p, (c.get(p) || 0) + 1); } return c; };

function eleitosDe(R, cargo, ufs) {
  const out = [];
  for (const uf of ufs) for (const e of R.uf[uf]?.[`c${cargo}t1`]?.eleitos || []) out.push({ nm: e[0], sg: e[1], n: e[2], v: e[3], sit: e[4], uf });
  return out;
}

ABAS.congresso = async function () {
  const A = $('abaCongresso');
  const casa = S.q.get('casa') || 'camara', uf = S.q.get('uf') || '';
  const link = o => '#/congresso?' + new URLSearchParams({ casa, ...(uf ? { uf } : {}), ...o }).toString().replace(/(^|&)uf=(&|$)/, '$1');
  A.innerHTML = `<h2 class="tit">Congresso eleito</h2><div class="sub">carregando…</div>`;
  const [R26, R22, R18] = await Promise.all([resumo('2026'), resumo('2022'), resumo('2018')]);
  const todas = Object.keys(UF_NM);
  const ufs = uf ? [uf] : todas;
  let membros, anteriores, titulo, nota = '';
  if (casa === 'senado') {
    // Senado a partir de 2027: 54 eleitos em 2026 + 27 eleitos em 2022 (mandato até 2031)
    const n26 = eleitosDe(R26, '5', ufs), n22 = eleitosDe(R22, '5', ufs).map(m => ({ ...m, apagado: true, extra: 'eleito em 2022, mandato até 2031' }));
    membros = [...n26, ...n22];
    anteriores = [...eleitosDe(R22, '5', ufs), ...eleitosDe(R18, '5', ufs)]; // composição de 2023 a 2027
    titulo = 'Senado Federal a partir de 2027';
    nota = 'Cadeiras mais claras: senadores eleitos em 2022 (o mandato vai até 2031). Comparação: Senado de 2023–2027 (eleitos em 2018 e 2022).';
  } else if (casa === 'assembleia') {
    const u = uf || 'rj';
    const c = u === 'df' ? '8' : '7';
    membros = eleitosDe(R26, c, [u]); anteriores = eleitosDe(R22, c, [u]);
    titulo = (u === 'df' ? 'Câmara Legislativa do DF' : 'Assembleia Legislativa · ' + UF_NM[u]) + ' (2027–2031)';
  } else {
    membros = eleitosDe(R26, '6', ufs); anteriores = eleitosDe(R22, '6', ufs);
    titulo = 'Câmara dos Deputados (2027–2031)' + (uf ? ' · bancada de ' + UF_NM[uf] : '');
  }
  const H = hemiciclo(membros, { titulo, legenda: casa === 'senado' ? 'senadores' : 'deputados' });
  const cl = contaLados(membros), ca = contaLados(anteriores);
  const cp = contaPart(membros), cpa = contaPart(anteriores);
  const partes = [...new Set([...cp.keys(), ...cpa.keys()])].map(p => ({ p, n: cp.get(p) || 0, a: cpa.get(p) || 0 }))
    .sort((x, y) => y.n - x.n || y.a - x.a);
  const btn = (k, t) => `<a class="${casa === k ? 'on' : ''}" href="${link({ casa: k })}" style="padding:6px 11px;display:inline-block;color:${casa === k ? '#fff' : 'var(--ink-2)'};background:${casa === k ? 'var(--accent)' : 'transparent'}">${t}</a>`;
  A.innerHTML = `
    <h2 class="tit">${esc(titulo)}</h2>
    <div class="sub">Eleitos em 04/10/2026, pelo partido da eleição. Fonte: TSE (Dados Abertos).</div>
    <div class="filtros">
      <div class="seg">${btn('camara', 'Câmara')}${btn('senado', 'Senado')}${btn('assembleia', 'Assembleias')}</div>
      <select id="cgUf"><option value="">${casa === 'assembleia' ? 'Escolha o estado' : 'Brasil (todos os estados)'}</option>${todas.map(u => `<option value="${u}" ${u === uf ? 'selected' : ''}>${UF_NM[u]}</option>`).join('')}</select>
    </div>
    <div class="grid2">
      <div class="card">${H.html}${barraLados(cl, membros.length, ca)}
        ${nota ? `<div class="note">${nota}</div>` : ''}
        <div class="note">Passe o mouse (ou toque) nas cadeiras para ver quem é.</div>
        <div id="cgSel" class="sub" style="min-height:40px;margin-top:6px"></div></div>
      <div class="card"><h3 style="margin-top:0">Bancadas por partido</h3>
        <div class="rolagem"><table class="tab"><thead><tr><th>Partido</th><th>Lado</th><th class="n">Agora</th><th class="n">Antes</th><th class="n">Δ</th></tr></thead><tbody>
        ${partes.map(x => `<tr data-p="${esc(x.p)}" style="cursor:pointer"><td><b>${esc(x.p)}</b></td><td><i class="sw" style="background:${LADO_COR[lado(x.p)]}"></i>${LADO_NM[lado(x.p)]}</td>
          <td class="n"><b>${x.n}</b></td><td class="n">${x.a}</td><td class="n ${x.n - x.a >= 0 ? 'up' : 'dn'}">${x.n - x.a >= 0 ? '+' : ''}${x.n - x.a}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="note">Siglas antigas somadas ao partido atual (ex.: PSL e DEM → UNIÃO; PTB e Patriota → PRD). Clique num partido para destacar.</div></div>
    </div>
    <div class="card" style="padding:14px;margin-top:14px"><h3 style="margin-top:0">${casa === 'senado' ? 'Senadores' : 'Eleitos'} (${membros.length})</h3>
      <input class="search" id="cgBusca" placeholder="Buscar nome, partido ou estado…" style="max-width:360px">
      <div class="rolagem"><table class="tab"><thead><tr><th>Nome</th><th>Partido</th><th>UF</th><th class="n">Votos</th><th>Situação</th></tr></thead><tbody id="cgLista"></tbody></table></div></div>`;
  $('cgUf').onchange = e => { location.hash = link({ uf: e.target.value }); };
  const svgH = A.querySelector('svg.hemi');
  const info = m => `<b>${esc(cap(m.nm))}</b> · ${esc(m.sg)} · ${m.uf.toUpperCase()} · ${fmt(m.v)} votos ${m.extra ? `<span style="color:var(--muted)">(${m.extra})</span>` : `· ${esc(cap(m.sit))}`}`;
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
      .filter(m => !q || norm(m.nm + ' ' + m.sg + ' ' + m.uf + ' ' + UF_NM[m.uf]).includes(q))
      .map(m => `<tr><td>${esc(cap(m.nm))}</td><td><i class="sw" style="background:${LADO_COR[lado(m.sg)]}"></i>${esc(m.sg)}</td><td>${m.uf.toUpperCase()}</td><td class="n">${fmt(m.v)}</td><td style="color:var(--muted)">${esc(m.extra || cap(m.sit))}</td></tr>`).join('');
  };
  $('cgBusca').oninput = lista; lista();
};
