/* Aba Partidos: votos e cadeiras por partido e por campo político (esquerda/centro/direita), 2014 a 2026. */
const ANOS = ['2014', '2018', '2022', '2026'];

ABAS.partidos = async function () {
  const A = $('abaPartidos');
  const uf = S.q.get('uf') || '', cargo = S.q.get('cargo') || '6';
  const link = o => '#/partidos?' + new URLSearchParams(Object.fromEntries(Object.entries({ uf, cargo, ...o }).filter(([, v]) => v))).toString();
  A.innerHTML = `<h2 class="tit">Partidos e campos políticos</h2><div class="sub">carregando 4 eleições…</div>`;
  const Rs = await Promise.all(ANOS.map(a => resumo(a)));
  const ufs = uf ? [uf] : Object.keys(UF_NM);
  const g = c => (c === '7' && uf === 'df') ? 'c8t1' : `c${c}t1`;
  // por ano: votos e eleitos por partido atual
  const porAno = Rs.map((R, i) => {
    const part = new Map(); let tot = 0, cad = 0;
    for (const u of ufs) {
      const grp = (cargo === '7' && u === 'df') ? 'c8t1' : g(cargo);
      const x = R.uf[u]?.[grp]; if (!x) continue;
      tot += x.tot;
      for (const [sg, [v, e]] of Object.entries(x.part)) {
        const p = atual(sg), o = part.get(p) || { v: 0, e: 0 };
        o.v += v; o.e += e; cad += e; part.set(p, o);
      }
    }
    return { ano: ANOS[i], part, tot, cad };
  });
  const lados = porAno.map(a => {
    const c = { esquerda: { v: 0, e: 0 }, centro: { v: 0, e: 0 }, direita: { v: 0, e: 0 } };
    for (const [p, o] of a.part) { c[lado(p)].v += o.v; c[lado(p)].e += o.e; }
    return c;
  });
  const temCadeira = cargo !== '3';
  const barras = (campo, tot) => porAno.map((a, i) => {
    const T = tot(a); if (!T) return `<div style="display:grid;grid-template-columns:44px 1fr;gap:8px;align-items:center"><b>${a.ano}</b><span class="sub">sem dados</span></div>`;
    return `<div style="display:grid;grid-template-columns:44px 1fr;gap:8px;align-items:center"><b>${a.ano}</b>
      <div class="lados" style="margin:3px 0">${ORDEM_LADO.map(l => { const v = lados[i][l][campo]; return v ? `<i style="width:${v / T * 100}%;background:${LADO_COR[l]}" title="${LADO_NM[l]}: ${campo === 'v' ? fmt(v) + ' votos' : v + ' cadeiras'}">${campo === 'v' ? pc(v / T * 100, 0) : v}</i>` : ''; }).join('')}</div></div>`;
  }).join('');
  const atualA = porAno[3], antA = porAno[2];
  const partes = [...new Set(porAno.flatMap(a => [...a.part.keys()]))]
    .map(p => ({ p, a: porAno.map(x => x.part.get(p) || { v: 0, e: 0 }) }))
    .filter(x => x.a.some(o => o.v))
    .sort((x, y) => (y.a[3].e - x.a[3].e) || (y.a[3].v - x.a[3].v));
  const delta = (n, o) => !o ? '' : `<span class="${n >= o ? 'up' : 'dn'}">${n >= o ? '▲' : '▼'} ${pc(Math.abs(n / o - 1) * 100, 0)}</span>`;
  const CARGOS_P = { '6': 'Deputado Federal', '7': 'Deputado Estadual', '5': 'Senador', '3': 'Governador' };
  A.innerHTML = `
    <h2 class="tit">Partidos e campos políticos</h2>
    <div class="sub">Votos nominais e eleitos por partido em 2014, 2018, 2022 e 2026 · ${esc(CARGOS_P[cargo])} · ${uf ? UF_NM[uf] : 'Brasil'}</div>
    <div class="filtros">
      <select id="ptCargo">${Object.entries(CARGOS_P).map(([k, v]) => `<option value="${k}" ${k === cargo ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <select id="ptUf"><option value="">Brasil</option>${Object.keys(UF_NM).map(u => `<option value="${u}" ${u === uf ? 'selected' : ''}>${UF_NM[u]}</option>`).join('')}</select>
    </div>
    <div class="grid2">
      <div class="card"><h3 style="margin-top:0">Votos por campo político</h3>${barras('v', a => a.tot)}
        <div class="note">Percentual dos votos nominais em candidatos de cada campo.</div></div>
      ${temCadeira || cargo === '3' ? `<div class="card"><h3 style="margin-top:0">${cargo === '3' ? 'Governadores eleitos' : 'Cadeiras conquistadas'} por campo</h3>${barras('e', a => a.cad)}
        <div class="note">${cargo === '3' ? 'Eleitos no 1º turno (o 2º turno de 2026 ainda não aconteceu).' : 'Número de eleitos de cada campo.'}</div></div>` : ''}
    </div>
    <div class="card" style="padding:14px;margin-top:14px"><h3 style="margin-top:0">Por partido</h3>
      <div class="rolagem"><table class="tab"><thead><tr><th>Partido</th><th>Campo</th>
        ${ANOS.map(a => `<th class="n">Votos ${a}</th>`).join('')}<th class="n">2026 x 2022</th>
        ${ANOS.map(a => `<th class="n">Eleitos ${a}</th>`).join('')}</tr></thead><tbody>
      ${partes.map(x => `<tr><td><b>${esc(x.p)}</b></td><td><i class="sw" style="background:${LADO_COR[lado(x.p)]}"></i>${LADO_NM[lado(x.p)]}</td>
        ${x.a.map(o => `<td class="n">${o.v ? fmt(o.v) : '—'}</td>`).join('')}<td class="n">${delta(x.a[3].v, x.a[2].v)}</td>
        ${x.a.map(o => `<td class="n">${o.e || (o.v ? 0 : '—')}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div>
      <div class="note">Siglas antigas somadas ao partido atual (PMDB→MDB, PR→PL, PRB→REPUBLICANOS, DEM e PSL→UNIÃO, PTB e Patriota→PRD, entre outras). Votos de legenda não entram.</div></div>`;
  $('ptCargo').onchange = e => { location.hash = link({ cargo: e.target.value }); };
  $('ptUf').onchange = e => { location.hash = link({ uf: e.target.value }); };
};
