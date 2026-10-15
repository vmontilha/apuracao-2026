/* Anúncios (Google AdSense). Enquanto ADSENSE_CLIENT estiver vazio, nenhum anúncio é carregado
   e os espaços ficam invisíveis. Depois da aprovação do site no AdSense, preencha:
     ADSENSE_CLIENT = 'ca-pub-XXXXXXXXXXXXXXXX'
     SLOTS = { anuncio1: 'NNNNNNNNNN', anuncio2: 'NNNNNNNNNN' }   (ids dos blocos criados no painel do AdSense)
   e publique também um arquivo ads.txt na raiz do site com a linha que o AdSense indicar. */
const ADSENSE_CLIENT = 'ca-pub-8173681283177170';
const SLOTS = { anuncio1: '', anuncio2: '' };
(function () {
  if (!ADSENSE_CLIENT || document.documentElement.classList.contains('embed')) return;
  // o script do AdSense pesa ~230 KB: só entra depois que a página aparece (4 s ou o primeiro toque/rolagem)
  let pedido = false;
  const carrega = () => {
    if (pedido) return; pedido = true;
    const s = document.createElement('script');
    s.async = true; s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + ADSENSE_CLIENT;
    document.head.appendChild(s);
  };
  const depois = () => { setTimeout(carrega, 4000); ['scroll', 'pointerdown', 'keydown'].forEach(e => addEventListener(e, carrega, { once: true, passive: true })); };
  if (document.readyState === 'complete') depois(); else addEventListener('load', depois, { once: true });
  for (const [id, slot] of Object.entries(SLOTS)) {
    const el = document.getElementById(id);
    if (!el || !slot) continue;
    el.innerHTML = `<div style="font-size:11px;color:var(--muted);margin-bottom:4px">Publicidade</div>
      <ins class="adsbygoogle" style="display:block" data-ad-client="${ADSENSE_CLIENT}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  }
})();
