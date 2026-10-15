"""Gera as páginas estáticas de resultado (para o Google encontrar) e o sitemap.

O mapa interativo do site é montado no navegador e usa endereços com '#', que o Google não indexa.
Este script escreve uma página HTML simples, com texto e tabelas, para:
  /resultados/                    índice com o Brasil e os 27 estados
  /resultados/<uf>/               estado: presidente, governador, senado e deputados eleitos
  /resultados/<uf>/<cidade>/      cidade: presidente, governador e senador
Cada página leva ao ponto certo do mapa interativo. Também escreve sitemap.xml e robots.txt.

Usa só a biblioteca padrão. Lê os dados já publicados no site (geo/, mapa/, resumo/).
Rodar da raiz do site:  python ferramentas/gerar_seo.py
"""
import html, json, os, re, sys, time, unicodedata, urllib.request

RAIZ = sys.argv[1] if len(sys.argv) > 1 else '.'
SITE = 'https://radardaeleicao.com.br'
DADOS = 'https://apuracao2026-dados.apuracao2026.workers.dev'  # imagens de prévia das cidades (muitas para o GitHub)
ANO = '2026'
T2_BR = False
DATA_T1, DATA_T2 = '4 de outubro de 2026', '25 de outubro de 2026'

UF_NM = {'ac': 'Acre', 'al': 'Alagoas', 'ap': 'Amapá', 'am': 'Amazonas', 'ba': 'Bahia', 'ce': 'Ceará', 'df': 'Distrito Federal',
         'es': 'Espírito Santo', 'go': 'Goiás', 'ma': 'Maranhão', 'mt': 'Mato Grosso', 'ms': 'Mato Grosso do Sul', 'mg': 'Minas Gerais',
         'pa': 'Pará', 'pb': 'Paraíba', 'pr': 'Paraná', 'pe': 'Pernambuco', 'pi': 'Piauí', 'rj': 'Rio de Janeiro', 'rn': 'Rio Grande do Norte',
         'rs': 'Rio Grande do Sul', 'ro': 'Rondônia', 'rr': 'Roraima', 'sc': 'Santa Catarina', 'sp': 'São Paulo', 'se': 'Sergipe', 'to': 'Tocantins'}
# "no Rio de Janeiro", "na Bahia", "em São Paulo"
UF_EM = {'ac': 'no', 'al': 'em', 'ap': 'no', 'am': 'no', 'ba': 'na', 'ce': 'no', 'df': 'no', 'es': 'no', 'go': 'em', 'ma': 'no', 'mt': 'em',
         'ms': 'em', 'mg': 'em', 'pa': 'no', 'pb': 'na', 'pr': 'no', 'pe': 'em', 'pi': 'no', 'rj': 'no', 'rn': 'no', 'rs': 'no', 'ro': 'em',
         'rr': 'em', 'sc': 'em', 'sp': 'em', 'se': 'em', 'to': 'no'}
CARGO = {'1': 'Presidente', '3': 'Governador', '5': 'Senador', '6': 'Deputado federal', '7': 'Deputado estadual', '8': 'Deputado distrital'}

e = lambda s: html.escape(str(s), quote=True)
fmt = lambda n: f'{n:,}'.replace(',', '.')
pc = lambda a, b: (f'{a / b * 100:.1f}'.replace('.', ',') + '%') if b else '–'
MINUSC = {'da', 'de', 'do', 'das', 'dos', 'e', 'di', 'du'}
def cap(s):
    out = []
    for i, w in enumerate(str(s).lower().split()):
        out.append(w if (i and w in MINUSC) else '-'.join(p[:1].upper() + p[1:] for p in w.split('-')))
    return ' '.join(out).replace("D'o", "D'O")
def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')
def le(p):
    try:
        return json.load(open(os.path.join(RAIZ, p), encoding='utf-8'))
    except FileNotFoundError:
        return None
def tse(abr, cargo='1', ele='6257'):
    """Resultado oficial no estado ou no Brasil ('br'): ([(número, votos)], válidos, {número: [nome, partido]}, % seções, {número: situação}).
    Eleições: 6257 presidente 1º turno, 6258 presidente 2º turno, 6260 governador 2º turno. None se ainda não publicado."""
    try:
        r = json.load(urllib.request.urlopen(f'https://resultados.tse.jus.br/oficial/ele{ANO}/{ele}/dados/{abr}/{abr}-c{int(cargo):04d}-e{int(ele):06d}-u.json', timeout=60))
    except Exception as x:
        if '404' not in str(x): print('TSE indisponível para', abr, ele, x)
        return None
    n_ = lambda v: int(str(v or 0).replace('.', '') or 0)
    l, nomes, st = [], {}, {}
    for g in r['carg'][0].get('agr', []):
        for p in g.get('par', []):
            for k in p.get('cand', []):
                l.append((str(k['n']), n_(k.get('vap')))); nomes[str(k['n'])] = [k.get('nmu') or k.get('nm'), p.get('sg', '')]
                st[str(k['n'])] = str(k.get('st') or '').upper()
    pst = float(str(r.get('s', {}).get('pstn', '0')).replace(',', '.'))
    return sorted(l, key=lambda x: -x[1]), n_(r.get('v', {}).get('vv')), nomes, pst, st
def tse_pres(abr):
    return tse(abr)

def frase_t2(cargo, lista, total, nomes, onde, pst, eleito=False):
    """Frase do 2º turno: quem lidera (apuração em andamento) ou quem venceu."""
    if not lista or not total: return ''
    n, v = lista[0]; nm, sg = nomes.get(str(n), [n, ''])
    if eleito: return f'{cap(nm)} ({sg}) venceu o 2º turno para {cargo.lower()}, com {pc(v, total)} dos votos válidos.'
    if pst >= 100: return f'{cap(nm)} ({sg}) teve a maior votação no 2º turno para {cargo.lower()} {onde}: {pc(v, total)} dos votos válidos.'
    return f'Com {pc(pst, 100)} das seções apuradas, {cap(nm)} ({sg}) lidera o 2º turno para {cargo.lower()} {onde}, com {pc(v, total)} dos votos válidos.'
def apurado(pst):
    return 'apuração concluída' if pst >= 100 else f'{pc(pst, 100)} das seções apuradas'

def escreve(rel, texto):
    p = os.path.join(RAIZ, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8', newline='\n').write(texto)

_css = os.path.join(RAIZ, 'css', 'est.css')
CSS = re.sub(r'/\*.*?\*/\s*', '', open(_css, encoding='utf-8').read(), flags=re.S).strip() if os.path.exists(_css) else ''
# Depois que a página aparece: cache local (abre mais rápido na próxima visita) e, só então, o script de anúncios
POS_CARGA = ("addEventListener('load',function(){"
             "if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('/sw.js');"
             "var f=function(){if(f.ok)return;f.ok=1;var s=document.createElement('script');s.async=1;s.crossOrigin='anonymous';"
             "s.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8173681283177170';document.head.appendChild(s)};"
             "setTimeout(f,4000);['scroll','pointerdown','keydown'].forEach(function(e){addEventListener(e,f,{once:true,passive:true})})})")

def pagina(caminho, titulo, descricao, migalhas, corpo, extra_ld=(), imagem=None, compart=''):
    url = f'{SITE}/{caminho}'
    imagem = imagem or f'{SITE}/marca/compartilhar.png'
    ld = [{'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': i + 1, 'name': nm, 'item': f'{SITE}/{href}'} for i, (nm, href) in enumerate(migalhas)]}, *extra_ld]
    mig = ' <span>›</span> '.join(f'<a href="/{href}">{e(nm)}</a>' if i < len(migalhas) - 1 else f'<b>{e(nm)}</b>' for i, (nm, href) in enumerate(migalhas))
    return f'''<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(titulo)}</title>
<meta name="description" content="{e(descricao)}">
<link rel="canonical" href="{url}">
<meta property="og:title" content="{e(titulo.split(' | ')[0])}">
<meta property="og:description" content="{e(descricao)}">
<meta property="og:type" content="article">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="Radar da Eleição">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{imagem}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:image" content="{imagem}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#12243A">
<meta name="google-adsense-account" content="ca-pub-8173681283177170">
<link rel="icon" href="/marca/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/marca/apple-touch-icon.png">
<link rel="preload" as="image" href="/marca/logo-200.webp" imagesrcset="/marca/logo-200.webp 1x, /marca/logo-400.webp 2x" fetchpriority="high">
<style>{CSS}</style>
<script>try {{ var t = localStorage.getItem("radar-tema"); if (t) document.documentElement.dataset.theme = t; }} catch (e) {{}}</script>
<script type="application/ld+json">{json.dumps(ld if len(ld) > 1 else ld[0], ensure_ascii=False)}</script>
</head>
<body>
<header class="topo-est"><div class="wrap">
  <a class="logo" href="/" aria-label="Radar da Eleição — página inicial"><picture><source srcset="/marca/logo-200.webp 1x, /marca/logo-400.webp 2x" type="image/webp"><img src="/marca/logo-200.png" width="160" height="60" alt="Radar da Eleição" fetchpriority="high"></picture></a>
  <div class="busca" role="search"><input type="search" placeholder="Buscar cidade ou candidato…" aria-label="Buscar cidade ou candidato" autocomplete="off"><ul hidden></ul></div>
  <nav aria-label="Seções"><a href="/">Mapa</a><a href="/resultados/">2026</a><a href="/resultados/2024/">2024</a><a href="/#/comparar">Comparar</a></nav>
</div></header>
<main class="wrap est">
<nav class="migalhas" aria-label="Você está em">{mig}</nav>
{corpo.replace('<!--COMPARTILHAR-->', botao_compart(titulo.split(' | ')[0], compart or descricao, url))}
</main>
<footer class="wrap rodape-est">
  <p><b>Radar da Eleição</b> · A eleição, em dados. Fonte: Tribunal Superior Eleitoral (TSE), resultados oficiais. Percentuais sobre os votos válidos.</p>
  <p><a href="/resultados/">Eleição 2026 por estado</a> · <a href="/resultados/2024/">Eleição municipal 2024</a> · <a href="/">Mapa interativo</a> · <a href="/privacidade.html">Privacidade</a></p>
</footer>
<script src="/js/compartilhar.js" defer></script>
<script src="/js/busca.js" defer></script>
<script>{POS_CARGA}</script>
</body>
</html>
'''

def botao_compart(titulo, texto, url):
    return (f'<button class="compart-bt" type="button" data-compartilhar data-titulo="{e(titulo)}" data-texto="{e(texto)}" data-url="{url}">'
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a3 3 0 1 0-2.8-4M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12 6a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>'
            '<span>Compartilhar no WhatsApp e redes</span></button>')

def tabela(cargo, lista, total, nomes, legenda='', status=None):
    """lista = [(numero, votos)]; nomes = {numero: [nome, partido]}."""
    if not lista:
        return ''
    linhas = []
    for i, (n, v) in enumerate(lista):
        nm, sg = nomes.get(str(n), [n, ''])
        st = (status or {}).get(str(n), '')
        tag = f' <span class="tag {"el" if "ELEITO" in st and "NÃO" not in st else "t2"}">{e(cap(st) if "TURNO" not in st else "2º turno")}</span>' if st and 'NÃO' not in st and 'SUPLENTE' not in st else ''
        linhas.append(f'<tr><td>{i + 1}º</td><td><b>{e(cap(nm))}</b>{tag}</td><td>{e(sg)}</td><td class="n">{fmt(v)}</td><td class="n">{pc(v, total)}</td></tr>')
    return f'''<section class="card bloco"><h2>{e(cargo)}</h2>{f'<p class="sub">{legenda}</p>' if legenda else ''}
<div class="rolar"><table><thead><tr><th></th><th>Candidato(a)</th><th>Partido</th><th class="n">Votos</th><th class="n">% válidos</th></tr></thead>
<tbody>{''.join(linhas)}</tbody></table></div></section>'''

def incorporar(hash_, titulo):
    """Código para blogs e jornais colocarem o mapa no site deles (com link de volta para cá)."""
    cod = (f'<iframe src="{SITE}/?embed=1{hash_}" width="100%" height="680" style="border:0;max-width:1100px" loading="lazy" title="{e(titulo)}"></iframe>'
           f'<p style="font:13px Arial,sans-serif">Mapa: <a href="{SITE}/">Radar da Eleição</a></p>')
    return (f'<details class="card bloco incorporar"><summary>Incorporar este mapa no seu site ou blog</summary>'
            f'<p class="sub">Copie o código abaixo e cole no seu site. O mapa é interativo e se atualiza sozinho.</p>'
            f'<textarea readonly rows="4" onclick="this.select()">{e(cod)}</textarea></details>')

def link_cand(uf, nome_urna, numero, rotulo):
    """Link para a página do candidato, se ela existir (gerar_seo_cand.py)."""
    c = f'candidatos/{ANO}/{uf}/{slug(nome_urna)}-{numero}/'
    return f'<a href="/{c}">{rotulo}</a>' if os.path.exists(os.path.join(RAIZ, c, 'index.html')) else rotulo

def mais_votados(uf, cd, nm, deps, lim=5):
    """Deputados mais votados na cidade (federal e estadual/distrital)."""
    partes = []
    for c, d in deps.items():
        if not d or cd not in d['mu']: continue
        a = d['mu'][cd]; vv, l = a[1], a[2:]
        itens = ''.join(f'<li>{link_cand(uf, d["cands"][l[j]][1], d["cands"][l[j]][0], "<b>" + e(cap(d["cands"][l[j]][1])) + "</b>")} '
                        f'<span>{e(d["cands"][l[j]][2])} · {fmt(l[j + 1])} votos · {pc(l[j + 1], vv)}</span></li>' for j in range(0, min(len(l), lim * 2), 2))
        if itens:
            partes.append(f'<h3>{CARGO[c]}</h3><ol class="eleitos">{itens}</ol>')
    return f'<section class="card bloco"><h2>Deputados mais votados em {e(nm)}</h2>{"".join(partes)}</section>' if partes else ''

def frase_vencedor(cargo, lista, total, nomes, onde):
    if not lista or not total:
        return ''
    n, v = lista[0]
    nm, sg = nomes.get(str(n), [n, ''])
    return f'{cap(nm)} ({sg}) teve a maior votação para {cargo.lower()} {onde}: {pc(v, total)} dos votos válidos.'

def main():
    global T2_BR
    t0 = time.time()
    x = tse('br', '1', '6258')  # o TSE publica o arquivo vazio antes da votação: só conta com votos apurados
    T2_BR = bool(x and x[1])
    print('2º turno com votos apurados' if T2_BR else '2º turno ainda sem votos: páginas só com o 1º turno')
    resumo = (le(f'resumo/{ANO}.json') or {}).get('uf', {})
    urls = [('resultados/', '0.9')]
    estados, br_pres, br_nomes = [], {}, {}
    total_paginas = 0
    for uf in sorted(UF_NM):
        geo, mp, mp2 = le(f'geo/{uf}.json'), le(f'mapa/{uf}.json'), (le(f'mapa/{uf}-t2.json') if T2_BR else None)
        if not geo or not mp:
            print('sem dados:', uf); continue
        nomes, R = mp['nomes'], resumo.get(uf, {})
        deps = {c: le(f'mapa/{uf}-c{c}.json') for c in (['6', '8'] if uf == 'df' else ['6', '7'])}
        mus = sorted(geo['mu'], key=lambda m: m['n'])
        usados, cidades = set(), []
        soma = {c: {} for c in ('1', '3', '5')}; vv = {c: 0 for c in soma}
        for m in mus:
            d = mp['mu'].get(m['t'], {})
            s = slug(m['n'])
            if s in usados: s += '-' + m['t']
            usados.add(s)
            cidades.append((m, s, d))
            for c in soma:
                if c in d:
                    vv[c] += d[c][1]
                    for n, v in d[c][2]: soma[c][n] = soma[c].get(n, 0) + v
        br_nomes.update(nomes.get('1', {}))
        for n, v in soma['1'].items(): br_pres[n] = br_pres.get(n, 0) + v
        br_pres['_vv'] = br_pres.get('_vv', 0) + vv['1']
        nm_uf, em_uf = UF_NM[uf], f'{UF_EM[uf]} {UF_NM[uf]}'

        # ---------- páginas das cidades ----------
        for m, s, d in cidades:
            nm = cap(m['n'])
            onde = f'em {nm} ({uf.upper()})'
            blocos, frases = [], []
            d2 = (mp2 or {}).get('mu', {}).get(m['t'], {})
            for c in ('1', '3'):
                if c not in d2 or not d2[c][1] or not d2[c][2]: continue
                pst, tot, lst = d2[c]
                blocos.append(tabela(f'{CARGO[c]} · 2º turno', lst, tot, mp2['nomes'].get(c, {}), f'Votação de {DATA_T2} na cidade · {apurado(pst)}.'))
                frases.append(frase_t2(CARGO[c], lst, tot, mp2['nomes'].get(c, {}), onde, pst))
            if blocos:
                blocos.append('<h2 class="turno-sep">1º turno · 4 de outubro</h2>')
            for c in ('1', '3', '5'):
                if c not in d: continue
                pst, tot, lst = d[c]
                blocos.append(tabela(CARGO[c], lst, tot, nomes.get(c, {}),
                                     ('Cada eleitor votou em dois candidatos ao Senado; os percentuais somam 200%.' if c == '5' else '') +
                                     f' Principais candidatos na cidade · {pc(pst, 100).replace("%", "")}% das seções apuradas.'))
                frases.append(frase_vencedor(CARGO[c], lst, tot, nomes.get(c, {}), onde))
            if not blocos: continue
            d2 = {c: x for c, x in d2.items() if x[1] and x[2]}
            if d2:  # com o 2º turno, o resumo fala dele e do Senado (o 1º turno de presidente e governador fica só nas tabelas)
                n2 = sum(1 for c in ('1', '3') if c in d2)
                frases = frases[:n2] + [f for f in frases[n2:] if 'senador' in f]
            caminho = f'resultados/{uf}/{s}/'
            corpo = f'''<h1>Resultado da eleição {ANO} em {e(nm)} ({uf.upper()})</h1>
<p class="lead">Veja como {e(nm)} votou {'no 2º turno de ' + DATA_T2 + ' e ' if d2 else ''}no 1º turno das eleições gerais de {DATA_T1}: presidente, governador e senador, com votos e percentuais dos votos válidos. {e(' '.join(f for f in frases if f))}</p>
<a class="cta" href="/#/{uf}/{m['t']}">Abrir {e(nm)} no mapa interativo: zonas, seções e deputados →</a> <!--COMPARTILHAR-->
{''.join(blocos)}
{mais_votados(uf, m['t'], nm, deps)}
<section class="card bloco"><h2>Mais sobre {e(nm)}</h2><ul class="links">
<li><a href="/#/{uf}/{m['t']}?c=6">Deputados federais mais votados em {e(nm)}</a></li>
<li><a href="/#/{uf}/{m['t']}?c=7">Deputados {'distritais' if uf == 'df' else 'estaduais'} mais votados em {e(nm)}</a></li>
{f'<li><a href="/resultados/2024/{uf}/{s}/">Eleição 2024 em {e(nm)}: prefeito e vereadores eleitos</a></li>' if os.path.exists(os.path.join(RAIZ, 'mun', '2024', uf, m['t'] + '.json')) else ''}
<li><a href="/#/comparar">Comparar a votação de {e(nm)} com 2022, 2018 e 2014</a></li>
<li><a href="/resultados/{uf}/">Resultado da eleição {e(em_uf)}</a></li></ul></section>
{incorporar(f"#/{uf}/{m['t']}", f'Mapa da eleição 2026 em {nm} ({uf.upper()})')}'''
            titulo = f'Resultado da eleição {ANO} em {nm} ({uf.upper()}): {"2º turno, " if d2 else ""}presidente, governador e senador | Radar da Eleição'
            desc = f'Resultado das eleições {ANO} em {nm} ({uf.upper()}): votos e percentuais para presidente, governador e senador{" no 1º e no 2º turno" if d2 else " no 1º turno"}. ' + (frases[0] if frases else '')
            escreve(caminho + 'index.html', pagina(caminho, titulo, desc[:300],
                    [('Resultados', 'resultados/'), (nm_uf, f'resultados/{uf}/'), (nm, caminho)], corpo,
                    imagem=f'{DADOS}/og/{uf}/{s}.png', compart=f'Veja como {nm} ({uf.upper()}) votou na eleição {ANO}:'))
            urls.append((caminho, '0.6')); total_paginas += 1

        # ---------- página do estado ----------
        def top_resumo(chave, lim):
            x = R.get(chave)
            if not x: return [], 0, {}, {}
            l = x['top'][:lim]
            return [(k[2], k[3]) for k in l], x['tot'], {k[2]: [k[0], k[1]] for k in x['top']}, {k[2]: k[4] for k in x['top']}
        blocos, frases = [], []
        tem_t2 = False
        for c, ele in (('1', '6258'), ('3', '6260')):
            x = tse(uf, c, ele) if T2_BR else None
            if not x or not x[1]: continue
            tem_t2 = True
            blocos.append(tabela(f'{CARGO[c]} · 2º turno', x[0][:2], x[1], x[2], f'Votação de {DATA_T2} {e(em_uf)} · {apurado(x[3])}.', x[4] if c == '3' else None))
            frases.append(frase_t2(CARGO[c], x[0], x[1], x[2], em_uf, x[3], eleito=(c == '3' and x[4].get(x[0][0][0], '').startswith('ELEITO'))))
        if tem_t2:
            blocos.append('<h2 class="turno-sep">1º turno · 4 de outubro</h2>')
        oficial = tse_pres(uf)
        pres, vvp, nmp = (oficial[0][:6], oficial[1], oficial[2]) if oficial else (sorted(soma['1'].items(), key=lambda x: -x[1])[:4], vv['1'], nomes.get('1', {}))
        blocos.append(tabela('Presidente', pres, vvp, nmp, f'Votação para presidente {e(em_uf)}.'))
        frases.append(frase_vencedor('Presidente', pres, vvp, nmp, em_uf))
        c_gov = 'c3t1'
        if R.get(c_gov):
            l, tot, nm_, st = top_resumo(c_gov, 8)
            if l:
                blocos.append(tabela('Governador', l, tot, nm_, '', st))
                segundo = [nm_[n][0] for n, _ in l if 'TURNO' in st.get(n, '')]
                eleito = [nm_[n][0] for n, _ in l if st.get(n, '').startswith('ELEITO')]
                frases.append(f'{cap(eleito[0])} venceu a eleição para governador no 1º turno.' if eleito else
                              f'A disputa para governador vai para o 2º turno, em {DATA_T2}, entre {cap(segundo[0])} e {cap(segundo[1])}.' if len(segundo) == 2 else '')
        l, tot, nm_, st = top_resumo('c5t1', 8)
        if l:
            blocos.append(tabela('Senador', l, tot, nm_, 'Duas vagas em disputa; cada eleitor votou em dois candidatos.', st))
            el = [cap(nm_[n][0]) for n, _ in l if st.get(n, '').startswith('ELEITO')]
            if el: frases.append(f'Eleitos para o Senado: {" e ".join(el)}.')
        for chave, cargo in (('c6t1', 'Deputados federais eleitos'), ('c7t1', 'Deputados distritais eleitos' if uf == 'df' else 'Deputados estaduais eleitos')):
            x = R.get(chave) or (R.get('c8t1') if chave == 'c7t1' else None)
            if not x or not x.get('eleitos'): continue
            itens = ''.join(f'<li>{link_cand(uf, k[0], k[2], "<b>" + e(cap(k[0])) + "</b>")} <span>{e(k[1])} · {fmt(k[3])} votos</span></li>' for k in sorted(x['eleitos'], key=lambda k: -k[3]))
            blocos.append(f'<section class="card bloco"><h2>{cargo} {e(em_uf)} ({len(x["eleitos"])})</h2><ol class="eleitos">{itens}</ol>'
                          f'<p class="sub"><a href="/#/{uf}?c={"6" if chave == "c6t1" else ("8" if uf == "df" else "7")}">Ver a votação de cada candidato por cidade no mapa →</a></p></section>')
        if tem_t2:
            n2 = sum(1 for f in frases if '2º turno' in f and 'vai para' not in f)
            frases = frases[:n2] + [f for f in frases[n2:] if f.startswith('Eleitos para o Senado')]
        lista_cid = ''.join(f'<li><a href="/resultados/{uf}/{s}/">{e(cap(m["n"]))}</a></li>' for m, s, d in cidades if d)
        corpo = f'''<h1>Resultado da eleição {ANO} {e(em_uf)}</h1>
<p class="lead">Resultado das eleições gerais de {DATA_T1}{(' e do 2º turno de ' + DATA_T2) if tem_t2 else ''} {e(em_uf)}: presidente, governador, senadores e deputados eleitos, com dados oficiais do TSE. {e(' '.join(f for f in frases if f))}</p>
<a class="cta" href="/#/{uf}">Abrir {e(nm_uf)} no mapa interativo →</a> <!--COMPARTILHAR-->
{''.join(blocos)}
<section class="card bloco"><h2>Resultado por cidade {e(em_uf)} ({len(cidades)} municípios)</h2><ul class="cidades">{lista_cid}</ul></section>
{incorporar(f'#/{uf}', f'Mapa da eleição 2026 {em_uf}')}
{f'<section class="card bloco"><h2>Eleições municipais de 2024 {e(em_uf)}</h2><p class="sub"><a href="/resultados/2024/{uf}/">Prefeitos e vereadores eleitos em 2024 em cada cidade →</a></p></section>' if uf != 'df' else ''}'''
        caminho = f'resultados/{uf}/'
        escreve(caminho + 'index.html', pagina(caminho, f'Resultado da eleição {ANO} {em_uf}: governador, senador e deputados eleitos | Radar da Eleição',
                f'Resultado das eleições {ANO} {em_uf}: governador, senadores, deputados federais e estaduais eleitos e a votação em cada um dos {len(cidades)} municípios. Dados do TSE.',
                [('Resultados', 'resultados/'), (nm_uf, caminho)], corpo,
                imagem=f'{SITE}/img/og/{uf}.png', compart=f'Resultado da eleição {ANO} {em_uf}: governador, senadores e deputados eleitos.'))
        urls.append((caminho, '0.8')); total_paginas += 1
        estados.append((uf, nm_uf, frases[0] if frases else ''))

    # ---------- índice ----------
    t2 = tse('br', '1', '6258') if T2_BR else None
    vvbr = br_pres.pop('_vv', 0)
    pres = sorted(br_pres.items(), key=lambda x: -x[1])[:4]
    oficial = tse_pres('br')
    if oficial: pres, vvbr, br_nomes = oficial[0][:6], oficial[1], oficial[2]
    corpo = f'''<h1>Resultado da eleição {ANO} por estado e cidade</h1>
<p class="lead">Resultados oficiais {'do 2º turno de ' + DATA_T2 + ' e ' if t2 and t2[1] else ''}do 1º turno das eleições gerais de {DATA_T1} em todos os estados e nos 5.570 municípios do Brasil: presidente, governador, senador e deputados. Escolha um estado para ver os eleitos e a votação em cada cidade.</p>
<a class="cta" href="/">Abrir o mapa interativo do Brasil →</a> <!--COMPARTILHAR-->
{tabela('Presidente · 2º turno · Brasil', t2[0][:2], t2[1], t2[2], f'Votação de {DATA_T2} · {apurado(t2[3])}. ' + frase_t2('Presidente', t2[0], t2[1], t2[2], 'no Brasil', t2[3], eleito=t2[4].get(t2[0][0][0], '').startswith('ELEITO')), t2[4]) if t2 and t2[1] else ''}
{tabela('Presidente · 1º turno · Brasil', pres, vvbr, br_nomes, '' if t2 and t2[1] else f'Lula e Flávio Bolsonaro disputam o 2º turno em {DATA_T2}.')}
<section class="card bloco"><h2>Escolha o estado</h2><ul class="estados">{''.join(f'<li><a href="/resultados/{uf}/"><b>{e(nm)}</b><span>{e(fr)}</span></a></li>' for uf, nm, fr in estados)}</ul></section>
<section class="card bloco"><h2>Eleições municipais de 2024</h2><p class="sub"><a href="/resultados/2024/">Prefeitos e vereadores eleitos em 2024 em todas as cidades →</a></p></section>'''
    escreve('resultados/index.html', pagina('resultados/', f'Resultado da eleição {ANO} por estado e cidade | Radar da Eleição',
            f'Resultado das eleições {ANO} em todos os estados e cidades do Brasil: presidente, governador, senador e deputados eleitos, com dados oficiais do TSE.',
            [('Resultados', 'resultados/')], corpo,
            extra_ld=[{'@context': 'https://schema.org', '@type': 'Dataset', 'name': f'Resultados das eleições gerais de {ANO} no Brasil',
                       'description': 'Votos por candidato para presidente, governador, senador e deputados, por estado e município, a partir dos resultados oficiais do TSE.',
                       'url': f'{SITE}/resultados/', 'inLanguage': 'pt-BR', 'isAccessibleForFree': True,
                       'creator': {'@type': 'Organization', 'name': 'Radar da Eleição', 'url': SITE},
                       'isBasedOn': 'https://resultados.tse.jus.br/', 'temporalCoverage': '2026-10-04', 'spatialCoverage': 'Brasil'}],
            imagem=f'{SITE}/img/og/br.png', compart=f'Resultado da eleição {ANO} em todos os estados e cidades do Brasil:'))
    total_paginas += 1

    escreve_sitemap('sitemap-2026.xml', [('', '1.0')] + urls + [('painel.html', '0.5')])
    escreve('robots.txt', f'User-agent: *\nAllow: /\nDisallow: /ferramentas/\n\nSitemap: {SITE}/sitemap.xml\n')
    print(f'{total_paginas} páginas, {len(urls) + 2} endereços no sitemap, {time.time() - t0:.1f}s')

def escreve_sitemap(nome, urls):
    """Um sitemap por assunto (sitemap-2026.xml, sitemap-2024.xml…) e o índice sitemap.xml com todos eles."""
    hoje = time.strftime('%Y-%m-%d')
    escreve(nome, '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + ''.join(f'<url><loc>{SITE}/{u}</loc><lastmod>{hoje}</lastmod><priority>{p}</priority></url>\n' for u, p in urls) + '</urlset>\n')
    partes = sorted(a for a in os.listdir(RAIZ) if re.fullmatch(r'sitemap-[\w-]+\.xml', a))
    escreve('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + ''.join(f'<sitemap><loc>{SITE}/{a}</loc><lastmod>{hoje}</lastmod></sitemap>\n' for a in partes) + '</sitemapindex>\n')

if __name__ == '__main__':
    main()
