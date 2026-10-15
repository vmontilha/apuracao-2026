/* Busca de estados, cidades e candidatos nas páginas de resultado.
   O índice (/busca.json, gerado pelo gerar_busca.py) só é baixado quando a pessoa clica na caixa. */
(function () {
  const box = document.querySelector('.busca');
  if (!box) return;
  const inp = box.querySelector('input'), ul = box.querySelector('ul');
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let itens = null, carregando = null, atuais = [], ativo = 0;
  const carrega = () => carregando || (carregando = fetch('/busca.json').then(r => r.json()).then(d => {
    itens = d.map(([nome, sub, url]) => ({ nome, sub, url, k: norm(nome + ' ' + sub) }));
  }).catch(() => { carregando = null; }));
  function mostra() {
    const q = norm(inp.value.trim());
    if (!q) { ul.hidden = true; return; }
    if (!itens) { ul.innerHTML = '<li class="vazio">Carregando…</li>'; ul.hidden = false; carrega().then(mostra); return; }
    const termos = q.split(/\s+/);
    const achados = [];
    for (const it of itens) {
      if (!termos.every(t => it.k.includes(t))) continue;
      const comeca = norm(it.nome).startsWith(termos[0]) ? 0 : 1;
      achados.push([comeca, it.nome.length, it]);
      if (achados.length > 400) break;
    }
    achados.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    atuais = achados.slice(0, 10).map(a => a[2]); ativo = 0;
    ul.innerHTML = atuais.map((it, i) => `<li><a href="${it.url}" class="${i ? '' : 'on'}">${it.nome}<small>${it.sub}</small></a></li>`).join('')
      || '<li class="vazio">Nada encontrado. Tente o nome da cidade ou do candidato.</li>';
    ul.hidden = false;
  }
  const marca = i => { if (!atuais.length) return; ativo = (i + atuais.length) % atuais.length; ul.querySelectorAll('a').forEach((a, j) => a.classList.toggle('on', j === ativo)); };
  inp.addEventListener('focus', carrega);
  inp.addEventListener('input', mostra);
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); marca(ativo + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); marca(ativo - 1); }
    else if (e.key === 'Enter' && atuais[ativo]) { e.preventDefault(); location.href = atuais[ativo].url; }
    else if (e.key === 'Escape') ul.hidden = true;
  });
  document.addEventListener('click', e => { if (!box.contains(e.target)) ul.hidden = true; });
})();
