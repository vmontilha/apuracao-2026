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
ANO = '2026'
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
def tse_pres(abr):
    """Votação oficial para presidente (1º turno) no estado ou no Brasil: ([(número, votos)], válidos, {número: [nome, partido]})."""
    try:
        r = json.load(urllib.request.urlopen(f'https://resultados.tse.jus.br/oficial/ele{ANO}/6257/dados/{abr}/{abr}-c0001-e006257-u.json', timeout=60))
    except Exception as x:
        print('TSE indisponível para', abr, x); return None
    n_ = lambda v: int(str(v or 0).replace('.', '') or 0)
    l, nomes = [], {}
    for g in r['carg'][0].get('agr', []):
        for p in g.get('par', []):
            for k in p.get('cand', []):
                l.append((str(k['n']), n_(k.get('vap')))); nomes[str(k['n'])] = [k.get('nmu') or k.get('nm'), p.get('sg', '')]
    return sorted(l, key=lambda x: -x[1]), n_(r.get('v', {}).get('vv')), nomes

def escreve(rel, texto):
    p = os.path.join(RAIZ, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8', newline='\n').write(texto)

def pagina(caminho, titulo, descricao, migalhas, corpo, extra_ld=()):
    url = f'{SITE}/{caminho}'
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
<meta property="og:title" content="{e(titulo)}">
<meta property="og:description" content="{e(descricao)}">
<meta property="og:type" content="article">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="Radar da Eleição">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE}/marca/compartilhar.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#12243A">
<link rel="icon" href="/marca/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/marca/apple-touch-icon.png">
<link rel="stylesheet" href="/css/radar.css">
<link rel="stylesheet" href="/css/resultados.css">
<script>try {{ var t = localStorage.getItem("radar-tema"); if (t) document.documentElement.dataset.theme = t; }} catch (e) {{}}</script>
<script type="application/ld+json">{json.dumps(ld if len(ld) > 1 else ld[0], ensure_ascii=False)}</script>
</head>
<body class="estatica">
<header class="topo-est"><div class="wrap">
  <a class="logo" href="/" aria-label="Radar da Eleição — página inicial"><picture><source srcset="/marca/logo-480.webp 1x, /marca/logo-960.webp 2x" type="image/webp"><img src="/marca/logo-480.png" width="160" height="60" alt="Radar da Eleição"></picture></a>
  <nav><a href="/">Mapa interativo</a><a href="/resultados/">Resultados por estado</a><a href="/#/comparar">Comparar</a></nav>
</div></header>
<main class="wrap est">
<nav class="migalhas" aria-label="Você está em">{mig}</nav>
{corpo}
</main>
<footer class="wrap rodape-est">
  <p><b>Radar da Eleição</b> · A eleição, em dados. Fonte: Tribunal Superior Eleitoral (TSE), resultados oficiais. Percentuais sobre os votos válidos.</p>
  <p><a href="/resultados/">Resultados por estado</a> · <a href="/">Mapa interativo</a> · <a href="/privacidade.html">Privacidade</a></p>
</footer>
</body>
</html>
'''

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

def frase_vencedor(cargo, lista, total, nomes, onde):
    if not lista or not total:
        return ''
    n, v = lista[0]
    nm, sg = nomes.get(str(n), [n, ''])
    return f'{cap(nm)} ({sg}) teve a maior votação para {cargo.lower()} {onde}: {pc(v, total)} dos votos válidos.'

def main():
    t0 = time.time()
    resumo = (le(f'resumo/{ANO}.json') or {}).get('uf', {})
    urls = [('resultados/', '0.9')]
    estados, br_pres, br_nomes = [], {}, {}
    total_paginas = 0
    for uf in sorted(UF_NM):
        geo, mp = le(f'geo/{uf}.json'), le(f'mapa/{uf}.json')
        if not geo or not mp:
            print('sem dados:', uf); continue
        nomes, R = mp['nomes'], resumo.get(uf, {})
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
            for c in ('1', '3', '5'):
                if c not in d: continue
                pst, tot, lst = d[c]
                blocos.append(tabela(CARGO[c], lst, tot, nomes.get(c, {}),
                                     ('Cada eleitor votou em dois candidatos ao Senado; os percentuais somam 200%.' if c == '5' else '') +
                                     f' Principais candidatos na cidade · {pc(pst, 100).replace("%", "")}% das seções apuradas.'))
                frases.append(frase_vencedor(CARGO[c], lst, tot, nomes.get(c, {}), onde))
            if not blocos: continue
            caminho = f'resultados/{uf}/{s}/'
            corpo = f'''<h1>Resultado da eleição {ANO} em {e(nm)} ({uf.upper()})</h1>
<p class="lead">Veja como {e(nm)} votou no 1º turno das eleições gerais de {DATA_T1}: presidente, governador e senador, com votos e percentuais dos votos válidos. {e(' '.join(f for f in frases if f))}</p>
<a class="cta" href="/#/{uf}/{m['t']}">Abrir {e(nm)} no mapa interativo: zonas, seções e deputados →</a>
{''.join(blocos)}
<section class="card bloco"><h2>Mais sobre {e(nm)}</h2><ul class="links">
<li><a href="/#/{uf}/{m['t']}?c=6">Deputados federais mais votados em {e(nm)}</a></li>
<li><a href="/#/{uf}/{m['t']}?c=7">Deputados {'distritais' if uf == 'df' else 'estaduais'} mais votados em {e(nm)}</a></li>
<li><a href="/#/comparar">Comparar a votação de {e(nm)} com 2022, 2018 e 2014</a></li>
<li><a href="/resultados/{uf}/">Resultado da eleição {e(em_uf)}</a></li></ul></section>'''
            titulo = f'Resultado da eleição {ANO} em {nm} ({uf.upper()}): presidente, governador e senador | Radar da Eleição'
            desc = f'Resultado das eleições {ANO} em {nm} ({uf.upper()}): votos e percentuais para presidente, governador e senador no 1º turno. ' + (frases[0] if frases else '')
            escreve(caminho + 'index.html', pagina(caminho, titulo, desc[:300],
                    [('Resultados', 'resultados/'), (nm_uf, f'resultados/{uf}/'), (nm, caminho)], corpo))
            urls.append((caminho, '0.6')); total_paginas += 1

        # ---------- página do estado ----------
        def top_resumo(chave, lim):
            x = R.get(chave)
            if not x: return [], 0, {}, {}
            l = x['top'][:lim]
            return [(k[2], k[3]) for k in l], x['tot'], {k[2]: [k[0], k[1]] for k in x['top']}, {k[2]: k[4] for k in x['top']}
        blocos, frases = [], []
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
            itens = ''.join(f'<li><b>{e(cap(k[0]))}</b> <span>{e(k[1])} · {fmt(k[3])} votos</span></li>' for k in sorted(x['eleitos'], key=lambda k: -k[3]))
            blocos.append(f'<section class="card bloco"><h2>{cargo} {e(em_uf)} ({len(x["eleitos"])})</h2><ol class="eleitos">{itens}</ol>'
                          f'<p class="sub"><a href="/#/{uf}?c={"6" if chave == "c6t1" else ("8" if uf == "df" else "7")}">Ver a votação de cada candidato por cidade no mapa →</a></p></section>')
        lista_cid = ''.join(f'<li><a href="/resultados/{uf}/{s}/">{e(cap(m["n"]))}</a></li>' for m, s, d in cidades if d)
        corpo = f'''<h1>Resultado da eleição {ANO} {e(em_uf)}</h1>
<p class="lead">Resultado das eleições gerais de {DATA_T1} {e(em_uf)}: presidente, governador, senadores e deputados eleitos, com dados oficiais do TSE. {e(' '.join(f for f in frases if f))}</p>
<a class="cta" href="/#/{uf}">Abrir {e(nm_uf)} no mapa interativo →</a>
{''.join(blocos)}
<section class="card bloco"><h2>Resultado por cidade {e(em_uf)} ({len(cidades)} municípios)</h2><ul class="cidades">{lista_cid}</ul></section>'''
        caminho = f'resultados/{uf}/'
        escreve(caminho + 'index.html', pagina(caminho, f'Resultado da eleição {ANO} {em_uf}: governador, senador e deputados eleitos | Radar da Eleição',
                f'Resultado das eleições {ANO} {em_uf}: governador, senadores, deputados federais e estaduais eleitos e a votação em cada um dos {len(cidades)} municípios. Dados do TSE.',
                [('Resultados', 'resultados/'), (nm_uf, caminho)], corpo))
        urls.append((caminho, '0.8')); total_paginas += 1
        estados.append((uf, nm_uf, frases[0] if frases else ''))

    # ---------- índice ----------
    vvbr = br_pres.pop('_vv', 0)
    pres = sorted(br_pres.items(), key=lambda x: -x[1])[:4]
    oficial = tse_pres('br')
    if oficial: pres, vvbr, br_nomes = oficial[0][:6], oficial[1], oficial[2]
    corpo = f'''<h1>Resultado da eleição {ANO} por estado e cidade</h1>
<p class="lead">Resultados oficiais do 1º turno das eleições gerais de {DATA_T1} em todos os estados e nos 5.570 municípios do Brasil: presidente, governador, senador e deputados. Escolha um estado para ver os eleitos e a votação em cada cidade.</p>
<a class="cta" href="/">Abrir o mapa interativo do Brasil →</a>
{tabela('Presidente · Brasil', pres, vvbr, br_nomes, f'Lula e Flávio Bolsonaro disputam o 2º turno em {DATA_T2}.')}
<section class="card bloco"><h2>Escolha o estado</h2><ul class="estados">{''.join(f'<li><a href="/resultados/{uf}/"><b>{e(nm)}</b><span>{e(fr)}</span></a></li>' for uf, nm, fr in estados)}</ul></section>'''
    escreve('resultados/index.html', pagina('resultados/', f'Resultado da eleição {ANO} por estado e cidade | Radar da Eleição',
            f'Resultado das eleições {ANO} em todos os estados e cidades do Brasil: presidente, governador, senador e deputados eleitos, com dados oficiais do TSE.',
            [('Resultados', 'resultados/')], corpo,
            extra_ld=[{'@context': 'https://schema.org', '@type': 'Dataset', 'name': f'Resultados das eleições gerais de {ANO} no Brasil',
                       'description': 'Votos por candidato para presidente, governador, senador e deputados, por estado e município, a partir dos resultados oficiais do TSE.',
                       'url': f'{SITE}/resultados/', 'inLanguage': 'pt-BR', 'isAccessibleForFree': True,
                       'creator': {'@type': 'Organization', 'name': 'Radar da Eleição', 'url': SITE},
                       'isBasedOn': 'https://resultados.tse.jus.br/', 'temporalCoverage': '2026-10-04', 'spatialCoverage': 'Brasil'}]))
    total_paginas += 1

    hoje = time.strftime('%Y-%m-%d')
    escreve('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + f'<url><loc>{SITE}/</loc><lastmod>{hoje}</lastmod><priority>1.0</priority></url>\n'
            + ''.join(f'<url><loc>{SITE}/{u}</loc><lastmod>{hoje}</lastmod><priority>{p}</priority></url>\n' for u, p in urls)
            + f'<url><loc>{SITE}/painel.html</loc><lastmod>{hoje}</lastmod><priority>0.5</priority></url>\n</urlset>\n')
    escreve('robots.txt', f'User-agent: *\nAllow: /\nDisallow: /ferramentas/\n\nSitemap: {SITE}/sitemap.xml\n')
    print(f'{total_paginas} páginas, {len(urls) + 2} endereços no sitemap, {time.time() - t0:.1f}s')

main()
