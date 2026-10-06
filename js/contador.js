/* Contador de acessos (total, hoje e online agora). Servidor: pasta contador/ (Cloudflare Worker).
   Enquanto CONTADOR_URL estiver vazio, nada aparece. */
const CONTADOR_URL = '';
(function () {
  if (!CONTADOR_URL) return;
  const el = document.getElementById('contador');
  let id = '';
  try { id = sessionStorage.getItem('apur-id') || ''; } catch (e) {}
  const nova = !id;
  if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); try { sessionStorage.setItem('apur-id', id); } catch (e) {} }
  const mostra = d => {
    if (!d || d.total == null) return;
    el.hidden = false;
    el.innerHTML = `<span title="Pessoas com o site aberto agora"><i class="on"></i><b>${fmt(d.online)}</b> online</span><span title="Acessos hoje: ${fmt(d.hoje)}">👁 <b>${fmt(d.total)}</b> acessos</span>`;
  };
  const chama = rota => fetch(CONTADOR_URL + rota, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    .then(r => r.json()).then(mostra).catch(() => {});
  chama(nova ? '/hit' : '/ping');
  setInterval(() => { if (!document.hidden) chama('/ping'); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) chama('/ping'); });
})();
