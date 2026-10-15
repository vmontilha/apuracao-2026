/* Compartilhar (WhatsApp, X, Facebook, Telegram, copiar link).
   No celular usa o menu nativo do aparelho; no computador abre uma lista de opções.
   Uso: <button data-compartilhar data-titulo="…" data-texto="…" data-url="…">  (sem data-url: a própria página)
   ou   radarCompartilhar(botao, { titulo, texto, url }). */
(function () {
  const ICONE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a3 3 0 1 0-2.8-4M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12 6a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';
  let aberto = null;
  const fecha = () => { if (aberto) { aberto.remove(); aberto = null; } };
  document.addEventListener('click', e => { if (aberto && !aberto.contains(e.target) && !e.target.closest('[data-compartilhar],.compart-bt')) fecha(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fecha(); });

  function compartilhar(bt, d) {
    const url = d.url || location.href.split('#')[0];
    const texto = d.texto || d.titulo || document.title;
    const toque = matchMedia('(pointer: coarse)').matches;
    if (toque && navigator.share) { navigator.share({ title: d.titulo || document.title, text: texto, url }).catch(() => {}); return; }
    if (aberto) { fecha(); return; }
    const u = encodeURIComponent(url), t = encodeURIComponent(texto);
    const ops = [
      ['WhatsApp', `https://wa.me/?text=${encodeURIComponent(texto + ' ' + url)}`],
      ['X (Twitter)', `https://twitter.com/intent/tweet?text=${t}&url=${u}`],
      ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${u}`],
      ['Telegram', `https://t.me/share/url?url=${u}&text=${t}`],
    ];
    const m = document.createElement('div');
    m.className = 'compart-menu'; m.setAttribute('role', 'menu');
    m.innerHTML = ops.map(([nm, href]) => `<a role="menuitem" href="${href}" target="_blank" rel="noopener">${nm}</a>`).join('')
      + '<button type="button" role="menuitem" data-copiar>Copiar link</button>';
    m.querySelector('[data-copiar]').onclick = async ev => {
      try { await navigator.clipboard.writeText(url); ev.target.textContent = 'Link copiado ✓'; }
      catch (x) { prompt('Copie o link:', url); }
      setTimeout(fecha, 1200);
    };
    m.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setTimeout(fecha, 100)));
    document.body.appendChild(m);
    const r = bt.getBoundingClientRect();
    m.style.top = (r.bottom + window.scrollY + 6) + 'px';
    m.style.left = Math.max(8, Math.min(r.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - m.offsetWidth - 8)) + 'px';
    aberto = m;
  }
  window.radarCompartilhar = compartilhar;
  window.radarIconeCompartilhar = ICONE;
  document.addEventListener('click', e => {
    const bt = e.target.closest('[data-compartilhar]');
    if (!bt) return;
    e.preventDefault();
    compartilhar(bt, { titulo: bt.dataset.titulo, texto: bt.dataset.texto, url: bt.dataset.url });
  });
})();
