/* Aba Histórico: resultados de 2014, 2018, 2022 e 2026 por estado e cargo, e a trajetória de cada político
   (todas as candidaturas dele no estado, com votos e situação). Dados: hist/<ano>/<uf>.json. */
ABAS.historico = async function () {
  const A = $('abaHistorico');
  const ano = S.q.get('ano') || '2022', uf = S.q.get('uf') || 'rj', cargo = S.q.get('cargo') || '6', turno = S.q.get('turno') || '1';
  const quem = S.q.get('quem') || '';
  const link = o => '#/historico?' + new URLSearchParams({ ano, uf, cargo, turno, ...o }).toString();
  A.innerHTML = `<h2 class="tit">Histórico de eleições</h2><div class="sub">carregando…</div>`;
  const H = await histUF(ano, uf);
  const doCargo = H.lista.filter(o => o.cargo === cargo && o.turno === turno).sort((a, b) => b.total - a.total);
  const tot = doCargo.reduce((s, o) => s + o.total, 0);
  const turnos = [...new Set(H.lista.filter(o => o.cargo === cargo).map(o => o.turno))];
  const cargos = [...new Set(H.lista.map(o => o.cargo))].sort();
  const nomeMun = await getJSON(`geo/${uf}.json`, Infinity).then(g => new Map(g.mu.map(m => [m.t, cap(m.n)]))).catch(() => new Map());
  const sitTag = s => /^ELEITO/i.test(s) ? `<span class="tag el">${esc(cap(s))}</span>` : /2º TURNO/i.test(s) ? `<span class="tag t2">2º turno</span>` : `<span style="color:var(--muted)">${esc(cap(s))}</span>`;
  A.innerHTML = `
    <h2 class="tit">Histórico de eleições</h2>
    <div class="sub">Resultados oficiais (TSE, Dados Abertos) de 2014, 2018, 2022 e 2026, por estado.</div>
    <div class="filtros">
      <select id="hAno">${['2026', '2022', '2018', '2014'].map(a => `<option ${a === ano ? 'selected' : ''}>${a}</option>`).join('')}</select>
      <select id="hUf">${Object.keys(UF_NM).map(u => `<option value="${u}" ${u === uf ? 'selected' : ''}>${UF_NM[u]}</option>`).join('')}</select>
      <select id="hCargo">${cargos.map(c => `<option value="${c}" ${c === cargo ? 'selected' : ''}>${CARGO_NM[c]}</option>`).join('')}</select>
      ${turnos.length > 1 ? `<select id="hTurno">${turnos.map(t => `<option value="${t}" ${t === turno ? 'selected' : ''}>${t}º turno</option>`).join('')}</select>` : ''}
      <input id="hQuem" class="search" style="max-width:300px;margin:0" placeholder="Buscar político em todas as eleições…" value="${esc(quem)}">
    </div>
    <div id="hTraj"></div>
    <div class="card" style="padding:14px">
      <h3 style="margin-top:0">${CARGO_NM[cargo]} · ${UF_NM[uf]} · ${ano}${turnos.length > 1 ? ' · ' + turno + 'º turno' : ''}</h3>
      ${!doCargo.length ? `<div class="empty">Sem dados para essa combinação${ano === '2026' && cargo === '1' ? ' (o TSE ainda não publicou a votação de presidente de 2026 nos Dados Abertos; veja no Mapa)' : ''}.</div>` : `
      <input class="search" id="hFiltro" placeholder="Filtrar a lista…" style="max-width:300px">
      <div class="rolagem"><table class="tab"><thead><tr><th>#</th><th>Candidato</th><th>Partido</th><th class="n">Número</th><th class="n">Votos</th><th class="n">%</th><th>Situação</th></tr></thead><tbody id="hLista"></tbody></table></div>
      <div class="note">% sobre os votos nominais do cargo. Clique num nome para ver a trajetória e as cidades.</div>`}
    </div>`;
  const ir2 = o => { location.hash = link(o); };
  $('hAno').onchange = e => ir2({ ano: e.target.value });
  $('hUf').onchange = e => ir2({ uf: e.target.value, quem: '' });
  $('hCargo').onchange = e => ir2({ cargo: e.target.value, turno: '1' });
  if ($('hTurno')) $('hTurno').onchange = e => ir2({ turno: e.target.value });
  let t0; $('hQuem').oninput = e => { clearTimeout(t0); t0 = setTimeout(() => trajetoria(e.target.value), 300); };
  if ($('hFiltro')) {
    const lista = () => {
      const q = norm($('hFiltro').value);
      $('hLista').innerHTML = doCargo.map((o, i) => ({ o, i })).filter(({ o }) => !q || norm(o.nmu + ' ' + o.nm + ' ' + o.sg + ' ' + o.n).includes(q)).slice(0, 400)
        .map(({ o, i }) => `<tr data-nm="${esc(o.nm)}" style="cursor:pointer"><td>${i + 1}</td><td><b>${esc(cap(o.nmu))}</b></td><td><i class="sw" style="background:${LADO_COR[lado(o.sg)]}"></i>${esc(o.sg)}</td><td class="n">${o.n}</td>
          <td class="n">${fmt(o.total)}</td><td class="n">${pc(tot ? o.total / tot * 100 : 0, 2)}</td><td>${sitTag(o.sit)}</td></tr>`).join('');
    };
    $('hFiltro').oninput = lista; lista();
    $('hLista').onclick = e => { const tr = e.target.closest('tr[data-nm]'); if (tr) { $('hQuem').value = tr.dataset.nm; trajetoria(tr.dataset.nm, true); scrollTo({ top: A.offsetTop - 60, behavior: 'smooth' }); } };
  }
  if (quem) trajetoria(quem);

  // todas as candidaturas de um nome no estado, em todas as eleições
  async function trajetoria(q, exato) {
    const k = chaveNome(q);
    if (k.length < 3) { $('hTraj').innerHTML = ''; return; }
    const Hs = await Promise.all(['2014', '2018', '2022', '2026'].map(a => histUF(a, uf)));
    const achou = [];
    for (const h of Hs) for (const o of h.lista) {
      const nk = chaveNome(o.nm), uk = chaveNome(o.nmu);
      if (exato ? nk === k : (nk.includes(k) || uk.includes(k))) achou.push(o);
    }
    const pessoas = new Map();
    for (const o of achou) (pessoas.get(chaveNome(o.nm)) || pessoas.set(chaveNome(o.nm), []).get(chaveNome(o.nm))).push(o);
    const lst = [...pessoas.values()].sort((a, b) => Math.max(...b.map(o => o.total)) - Math.max(...a.map(o => o.total))).slice(0, 6);
    $('hTraj').innerHTML = !lst.length ? `<div class="card" style="padding:14px;margin-bottom:14px" class="empty">Nenhum candidato com esse nome em ${UF_NM[uf]}.</div>` : lst.map(l => {
      l.sort((a, b) => a.ano.localeCompare(b.ano) || a.turno.localeCompare(b.turno));
      const ult = l[l.length - 1];
      const cid = Object.entries(ult.mun).sort((a, b) => b[1] - a[1]).slice(0, 8);
      const max = Math.max(...l.map(o => o.total));
      return `<div class="card" style="padding:14px;margin-bottom:14px">
        <h3 style="margin:0 0 2px;text-transform:none;letter-spacing:0;color:var(--ink);font-size:17px">${esc(cap(ult.nmu))} <small class="sub">${esc(cap(ult.nm))}</small></h3>
        <div class="grid2" style="margin-top:8px">
          <div><div class="res">${l.map(o => `<div class="r"><div class="n">${o.ano} · ${CARGO_NM[o.cargo]}${o.turno === '2' ? ' (2º turno)' : ''} <small>${esc(o.sg)} ${o.n}</small> ${sitTag(o.sit)}</div>
            <div class="v">${fmt(o.total)}</div><div class="bar"><i style="width:${o.total / max * 100}%;background:${LADO_COR[lado(o.sg)]}"></i></div></div>`).join('')}</div></div>
          <div><div class="sub" style="margin-bottom:6px">Cidades com mais votos em ${ult.ano}</div>
            <table class="tab"><tbody>${cid.map(([cd, v]) => `<tr><td>${esc(nomeMun.get(cd) || cd)}</td><td class="n">${fmt(v)}</td><td class="n" style="color:var(--muted)">${pc(v / ult.total * 100, 1)}</td></tr>`).join('')}</tbody></table>
            ${ult.ano === '2026' && !['1', '3', '5'].includes(ult.cargo) ? `<a class="cta" style="margin-top:10px" href="#/${uf}?c=${ult.cargo}&k=${ult.n}">Ver no mapa →</a>` : ''}</div>
        </div></div>`;
    }).join('');
  }
};
