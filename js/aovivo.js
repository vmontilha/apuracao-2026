/* Tela inicial do 2º turno de presidente: parcial, projeção do resultado final e da abstenção, regiões.

   Projeção (estimativa estatística, não é resultado oficial), feita estado a estado (27 UFs + exterior):
   - o que já foi apurado entra como está;
   - para as urnas que faltam, parte-se do 1º turno daquele estado (comparecimento, % de votos válidos e
     divisão entre os dois candidatos) e aplica-se a mudança já observada nas urnas apuradas do próprio estado;
   - quando o estado ainda apurou pouco, pesa mais a mudança média observada no país (encolhimento k = 3%).
   Fonte: TSE (resultados.tse.jus.br), arquivos de presidente do 1º (6257) e do 2º turno (6258). */
(function () {
  const box = document.getElementById('aoVivo');
  if (!box) return;
  const TSE = 'https://resultados.tse.jus.br/oficial/ele2026';
  const UNID = [...Object.keys(UF_NM), 'zz'];
  const REGS = [...Object.entries(REG).map(([k, r]) => [k, r.nm, r.ufs]), ['ZZ', 'Exterior', ['zz']]];
  const K = 0.03;
  const n_ = v => Number(String(v ?? 0).replace(',', '.')) || 0;
  const arq = (e, u) => `${TSE}/${e}/dados/${u}/${u}-c0001-e00${e}-u.json`;
  const pega = (url, fresco) => fetch(url, fresco ? { cache: 'no-cache' } : {}).then(r => r.ok ? r.json() : null).catch(() => null);
  const logit = p => Math.log(Math.max(1e-6, p) / Math.max(1e-6, 1 - p));
  const sig = x => 1 / (1 + Math.exp(-x));
  const pp = x => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x * 100).toFixed(1).replace('.', ',') + ' p.p.';
  const P = (x, d = 1) => (x * 100).toFixed(d).replace('.', ',') + '%';
  let T1 = null, timer = null;

  const lista = r => {
    const out = [];
    for (const g of r?.carg?.[0]?.agr || []) for (const p of g.par || []) for (const c of p.cand || [])
      out.push({ n: String(c.n), nm: c.nmu || c.nm, sg: p.sg, v: n_(c.vap), sq: c.sqcand, st: c.st || '' });
    return out.sort((a, b) => b.v - a.v);
  };
  const unidade = r => r && {
    te: n_(r.e?.te), est: n_(r.e?.est), c: n_(r.e?.c), a: n_(r.e?.a), vv: n_(r.v?.vv),
    st: n_(r.s?.st), ts: n_(r.s?.ts), pst: n_(r.s?.pstn), cands: lista(r), hg: r.hg, dg: r.dg,
  };

  async function carrega1T() {
    if (T1) return T1;
    // 1º turno já resumido num arquivo do site (1 download em vez de 29 do TSE); se faltar, busca no TSE
    T1 = await pega('mapa/presidente-t1.json');
    if (!T1 || !T1.br) {
      const us = [...UNID, 'br'], rs = await Promise.all(us.map(u => pega(arq('6257', u))));
      T1 = Object.fromEntries(us.map((u, i) => [u, unidade(rs[i])]));
    }
    return T1;
  }

  function projeta(t1, t2, A, B) {
    // mudanças observadas nas urnas apuradas: em cada estado, somadas por região e no país (médias ponderadas)
    const regDe = u => (REGS.find(([, , ufs]) => ufs.includes(u)) || ['BR'])[0];
    const acum = () => ({ wt: 0, dt: 0, wq: 0, dq: 0, wb: 0, db: 0, est: 0, te: 0 });
    const R = {}, N = acum();
    const vot = (x, n) => x?.cands.find(c => c.n === n)?.v || 0;
    for (const u of UNID) {
      const a = t1[u], b = t2[u]; if (!a) continue;
      const r = R[regDe(u)] || (R[regDe(u)] = acum());
      r.te += b?.te || a.te; N.te += b?.te || a.te;
      if (!b || !b.est || !b.c) continue;
      const vA2 = vot(b, A), vB2 = vot(b, B), vA1 = vot(a, A), vB1 = vot(a, B);
      for (const g of [r, N]) {
        g.est += b.est;
        g.dt += b.est * (b.c / b.est - a.c / a.te); g.wt += b.est;
        g.dq += b.c * (b.vv / b.c - a.vv / a.c); g.wq += b.c;
        if (vA2 + vB2 && vA1 + vB1) { g.db += (vA2 + vB2) * (logit(vA2 / (vA2 + vB2)) - logit(vA1 / (vA1 + vB1))); g.wb += vA2 + vB2; }
      }
    }
    if (!N.wt) return null;
    const med = g => ({ t: g.wt ? g.dt / g.wt : 0, q: g.wq ? g.dq / g.wq : 0, b: g.wb ? g.db / g.wb : 0 });
    const Dn = med(N);
    // mudança de cada região; região que apurou pouco se apoia no país (mesmo encolhimento K)
    const Dr = {};
    for (const [k, g] of Object.entries(R)) {
      const f = g.te ? g.est / g.te : 0, w = f / (f + K), d = med(g);
      Dr[k] = { t: w * d.t + (1 - w) * Dn.t, q: w * d.q + (1 - w) * Dn.q, b: w * d.b + (1 - w) * Dn.b };
    }
    const tot = { te: 0, c: 0, vv: 0, A: 0, B: 0, te1: 0, c1: 0 }, porU = {};
    for (const u of UNID) {
      const a = t1[u], b = t2[u]; if (!a) continue;
      const D = Dr[regDe(u)] || Dn;
      const te = b?.te || a.te, est = b?.est || 0, f = te ? est / te : 0, w = f / (f + K);
      const t1r = a.c / a.te, q1r = a.vv / a.c;
      const vA1 = vot(a, A), vB1 = vot(a, B), b1 = vA1 + vB1 ? vA1 / (vA1 + vB1) : 0.5;
      const vA2 = vot(b, A), vB2 = vot(b, B);
      const t2r = est && b.c ? b.c / est : t1r, q2r = b?.c ? b.vv / b.c : q1r, b2 = vA2 + vB2 ? vA2 / (vA2 + vB2) : b1;
      // urnas ainda não abertas do estado: 1º turno do estado + mudança do próprio estado (pesando pela apuração) ou da região
      const tU = t1r + w * (t2r - t1r) + (1 - w) * D.t;
      const qU = q1r + w * (q2r - q1r) + (1 - w) * D.q;
      const bU = sig(logit(b1) + w * (logit(b2) - logit(b1)) + (1 - w) * D.b);
      const resto = Math.max(0, te - est), cU = resto * tU, vvU = cU * qU;
      const o = { te, c: (b?.c || 0) + cU, vv: (b?.vv || 0) + vvU, A: vA2 + vvU * bU, B: vB2 + vvU * (1 - bU), te1: a.te, c1: a.c };
      porU[u] = o;
      tot.te += te; tot.c += o.c; tot.vv += o.vv; tot.A += o.A; tot.B += o.B; tot.te1 += a.te; tot.c1 += a.c;
    }
    return { tot, porU };
  }

  const somaReg = (t, ufs) => {
    const o = { st: 0, ts: 0, est: 0, c: 0, vv: 0, te: 0, cand: {} };
    for (const u of ufs) {
      const x = t[u]; if (!x) continue;
      o.st += x.st; o.ts += x.ts; o.est += x.est; o.c += x.c; o.vv += x.vv; o.te += x.te;
      for (const c of x.cands) o.cand[c.n] = (o.cand[c.n] || 0) + c.v;
    }
    return o;
  };

  function desenha(t1, t2) {
    const br = t2.br, br1 = t1.br;
    const [A, B] = (br?.cands?.length >= 2 ? br.cands : br1.cands).slice(0, 2);
    const apurado = br ? br.pst : 0, vivo = br && br.st > 0;
    // foto do 1º turno (mesmo candidato, arquivo que já existe com certeza)
    const foto = c => `${TSE}/6257/fotos/br/${(br1.cands.find(x => x.n === c.n) || c).sq}.jpeg`;
    const abst1 = br1.a / br1.te;
    const abst2 = vivo && br.est ? 1 - br.c / br.est : null;
    const pr = vivo ? projeta(t1, t2, A.n, B.n) : null;
    const cartao = c => {
      const s = vivo && br.vv ? c.v / br.vv : null;
      return `<div class="av-cand" style="--c:${cor(c.n)}">
        <img src="${foto(c)}" alt="" width="64" height="64" onerror="this.style.visibility='hidden'">
        <div><div class="nm">${esc(cap(c.nm))}${c.st && /eleito/i.test(c.st) && !/não/i.test(c.st) ? ' <span class="tag el">Eleito</span>' : ''}</div>
        <div class="sg">${linkPartido(c.sg)}${vivo ? ' · ' + fmt(c.v) + ' votos' : ''}</div>
        <div class="pc">${s == null ? '–' : P(s, 2)}</div></div></div>`;
    };
    const sA = vivo && br.vv ? A.v / br.vv : 0;
    let h = `<div class="av-topo"><div><span class="av-selo">${vivo ? (apurado < 100 ? '● Ao vivo' : 'Apuração concluída') : '2º turno hoje'}</span>
        <h2>Presidente · 2º turno</h2></div>
        <div class="av-prog"><b>${vivo ? P(apurado / 100, 2) : '0%'}</b> das urnas apuradas<div class="bar"><i style="width:${apurado}%"></i></div>
        <small>${vivo ? 'Atualizado às ' + esc(String(br.hg || '').slice(0, 5).replace(':', 'h')) + ' · atualiza sozinho' : 'A apuração começa às 17h (horário de Brasília), quando as urnas fecham.'}</small></div></div>
      <div class="av-duelo">${cartao(A)}${cartao(B)}</div>
      ${vivo ? `<div class="av-barra" title="Parcial dos votos válidos"><i style="width:${(sA * 100).toFixed(2)}%;background:${cor(A.n)}"></i><i style="width:${(100 - sA * 100).toFixed(2)}%;background:${cor(B.n)}"></i><span></span></div>
      <div class="sub" style="text-align:center">Parcial dos votos válidos · a linha marca 50%</div>` : ''}`;
    // projeção
    if (pr) {
      const pa = pr.tot.A / pr.tot.vv, abstP = 1 - pr.tot.c / pr.tot.te;
      const conf = apurado < 20 ? 'baixa' : apurado < 60 ? 'média' : 'alta';
      h += `<div class="av-grid">
        <div class="av-box"><h3>Projeção do resultado final</h3>
          <div class="av-proj"><span><i class="av-sw" style="background:${cor(A.n)}"></i>${esc(cap(A.nm))}</span><b>${P(pa)}</b><small>${fmt(Math.round(pr.tot.A))} votos</small></div>
          <div class="av-proj"><span><i class="av-sw" style="background:${cor(B.n)}"></i>${esc(cap(B.nm))}</span><b>${P(1 - pa)}</b><small>${fmt(Math.round(pr.tot.B))} votos</small></div>
          <div class="sub">Diferença projetada: ${fmt(Math.round(Math.abs(pr.tot.A - pr.tot.B)))} votos · confiabilidade ${conf} (${P(apurado / 100, 0)} apurado)</div></div>
        <div class="av-box"><h3>Abstenção</h3>
          <div class="av-abst"><span>1º turno</span><b>${P(abst1)}</b></div>
          <div class="av-abst"><span>2º turno · urnas apuradas</span><b>${abst2 == null ? '–' : P(abst2)}</b></div>
          <div class="av-abst"><span>2º turno · projeção final</span><b>${P(abstP)}</b></div>
          <div class="av-var ${abstP > abst1 ? 'sobe' : 'cai'}">Variação projetada: ${pp(abstP - abst1)} · ${fmt(Math.round(Math.abs((pr.tot.te - pr.tot.c) - (br1.te - br1.c))))} eleitores ${abstP > abst1 ? 'a mais' : 'a menos'} sem votar</div>
          <div class="sub">Comparecimento projetado: ${fmt(Math.round(pr.tot.c))} de ${fmt(pr.tot.te)} eleitores.</div></div>
      </div>
      <p class="sub av-nota">Projeção estatística do Radar da Eleição, não é resultado oficial. Para as urnas que ainda não foram abertas, parte do 1º turno de cada estado e aplica a variação já vista nas urnas apuradas (comparecimento/abstenção, brancos e nulos e divisão dos votos): do próprio estado, na proporção do que ele já apurou, e no restante a da sua região.</p>`;
    } else {
      const c1 = br1.cands;
      h += `<div class="av-grid"><div class="av-box"><h3>Como foi o 1º turno</h3>${c1.slice(0, 2).map(c => `<div class="av-proj"><span><i class="av-sw" style="background:${cor(c.n)}"></i>${esc(cap(c.nm))}</span><b>${P(c.v / br1.vv, 2)}</b><small>${fmt(c.v)} votos</small></div>`).join('')}
          <div class="sub">Os demais candidatos somaram ${P(1 - (c1[0].v + c1[1].v) / br1.vv)} dos votos válidos.</div></div>
        <div class="av-box"><h3>Abstenção no 1º turno</h3><div class="av-abst"><span>Abstenção</span><b>${P(abst1)}</b></div>
          <div class="sub">${fmt(br1.a)} de ${fmt(br1.te)} eleitores não votaram. A projeção do 2º turno aparece assim que as primeiras urnas forem apuradas.</div></div></div>`;
    }
    // regiões
    const linhas = REGS.map(([k, nm, ufs]) => {
      const r2 = somaReg(t2, ufs), r1 = somaReg(t1, ufs);
      const ap = r2.ts ? r2.st / r2.ts : 0, a1 = r1.te ? 1 - r1.c / r1.te : 0, a2 = r2.est ? 1 - r2.c / r2.est : null;
      const vA = r2.cand[A.n] || 0, vB = r2.cand[B.n] || 0, tv = r2.vv;
      let pA = null, aP = null;
      if (pr) {
        let s = { te: 0, c: 0, vv: 0, A: 0 };
        for (const u of ufs) { const o = pr.porU[u]; if (o) { s.te += o.te; s.c += o.c; s.vv += o.vv; s.A += o.A; } }
        if (s.vv) { pA = s.A / s.vv; aP = 1 - s.c / s.te; }
      }
      const link = k === 'ZZ' ? nm : `<a href="#/${k}">${nm}</a>`;
      return `<tr><td>${link}</td><td class="n">${P(ap, 1)}</td><td class="n">${tv ? P(vA / tv) : '–'}</td><td class="n">${tv ? P(vB / tv) : '–'}</td>
        <td class="n av-pj">${pA == null ? '–' : P(pA) + ' × ' + P(1 - pA)}</td>
        <td class="n">${P(a1)}</td><td class="n">${a2 == null ? '–' : P(a2)}</td><td class="n av-pj">${aP == null ? '–' : P(aP)}</td><td class="n">${aP == null ? '–' : pp(aP - a1)}</td></tr>`;
    }).join('');
    h += `<h3 class="av-h3">Por região</h3><div class="rolar"><table class="av-tab"><thead><tr><th>Região</th><th class="n">Urnas apuradas</th>
      <th class="n"><i class="av-sw" style="background:${cor(A.n)}"></i>${esc(cap(A.nm))}</th><th class="n"><i class="av-sw" style="background:${cor(B.n)}"></i>${esc(cap(B.nm))}</th>
      <th class="n">Projeção final</th><th class="n">Abstenção 1º t.</th><th class="n">Abst. 2º t. (apuradas)</th><th class="n">Abst. projetada</th><th class="n">Variação projetada</th></tr></thead><tbody>${linhas}</tbody></table></div>
      <p class="sub av-nota">Votos de cada candidato e "Abst. 2º t." são das urnas já apuradas. "Projeção final" e "Abst. projetada" incluem a estimativa das urnas que faltam, feita estado a estado com a variação da própria região.</p>
      <div class="av-pe"><a href="#explorar">Ver no mapa por estado, cidade e seção ↓</a> · <a href="painel.html">Painel completo da apuração</a></div>`;
    box.innerHTML = h;
    box.hidden = false;
  }

  async function atualiza() {
    try {
      const t1 = await carrega1T();
      if (!t1.br) return;
      const rs = await Promise.all(UNID.map(u => pega(arq('6258', u), true)));
      const t2 = Object.fromEntries(UNID.map((u, i) => [u, unidade(rs[i])]));
      t2.br = unidade(await pega(arq('6258', 'br'), true));
      desenha(t1, t2);
      clearTimeout(timer);
      if (!t2.br || t2.br.pst < 100) timer = setTimeout(() => { if (!document.hidden) atualiza(); else timer = setTimeout(atualiza, 30000); }, 30000);
    } catch (e) { console.warn('ao vivo', e); }
  }
  carrega1T().then(atualiza);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !timer) atualiza(); });
})();
