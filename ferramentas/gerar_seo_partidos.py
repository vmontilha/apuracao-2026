"""Páginas dos partidos (para o Google e para tornar as siglas clicáveis em todo o site).

  /partidos/              todos os partidos, por cadeiras na Câmara
  /partidos/<sigla>/      eleitos em 2026 (governo, Senado, Câmara, Assembleias) e prefeitos/vereadores de 2024

Lê resumo/2026.json e eleitosmun/2024/<uf>.json. Rodar ANTES dos outros geradores (eles só linkam páginas que existem):
  python ferramentas/gerar_seo_partidos.py .
"""
import os, re, sys, time, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gerar_seo as G
from gerar_seo import e, fmt, pc, cap, le, escreve, pagina, UF_NM, UF_EM, SITE

def chave(sg):
    """'PC do B' e 'PCDOB' são o mesmo partido; a chave também é o endereço da página."""
    return re.sub(r'[^A-Z0-9]', '', unicodedata.normalize('NFKD', sg).encode('ascii', 'ignore').decode().upper())

def link_cand(uf, k, rot):
    return G.link_cand(uf, k[0], k[2], rot)

def main():
    t0 = time.time()
    R = (le('resumo/2026.json') or {}).get('uf', {})
    P = {}
    def p(sg):
        k = chave(sg)
        if k not in P:
            P[k] = {'sg': sg, 'gov': [], 'gov2': [], 'sen': [], 'fed': [], 'est': [], 'vfed': 0, 'vest': 0, 'uf': {}, 'pref': 0, 'ver': 0, 'pref_uf': {}, 'ver_uf': {}, 'pref2': []}
        if sg.isupper() and not P[k]['sg'].isupper(): P[k]['sg'] = sg
        return P[k]
    tot_fed = tot_est = 0
    for uf, d in R.items():
        for cg in ('c3t1', 'c5t1', 'c6t1', 'c7t1', 'c8t1'):
            x = d.get(cg)
            if not x: continue
            for sg, (v, el) in x['part'].items():
                o = p(sg); u = o['uf'].setdefault(uf, {'fed': 0, 'est': 0, 'vfed': 0, 'vest': 0})
                if cg == 'c6t1': o['vfed'] += v; u['fed'] += el; u['vfed'] += v; tot_fed += v
                if cg in ('c7t1', 'c8t1'): o['vest'] += v; u['est'] += el; u['vest'] += v; tot_est += v
            for k in x.get('eleitos', []):
                o = p(k[1])
                if cg == 'c3t1': o['gov'].append((uf, k))
                elif cg == 'c5t1': o['sen'].append((uf, k))
                elif cg == 'c6t1': o['fed'].append((uf, k))
                else: o['est'].append((uf, k))
            if cg == 'c3t1':
                for k in x['top']:
                    if 'TURNO' in k[4]: p(k[1])['gov2'].append((uf, k))
    for uf in sorted(UF_NM):
        em = le(f'eleitosmun/2024/{uf}.json')
        if not em: continue
        for m in em['mu'].values():
            if m.get('p'):
                o = p(m['p'][1]); o['pref'] += 1; o['pref_uf'][uf] = o['pref_uf'].get(uf, 0) + 1
            for v in m.get('v', []):
                o = p(v[1]); o['ver'] += 1; o['ver_uf'][uf] = o['ver_uf'].get(uf, 0) + 1
    urls, ordem = [('partidos/', '0.7')], sorted(P.items(), key=lambda kv: (-len(kv[1]['fed']), -kv[1]['vfed'], kv[0]))
    for k, o in ordem:
        sg = o['sg']; caminho = f'partidos/{k.lower()}/'
        nfed, nest, nsen, ngov = len(o['fed']), len(o['est']), len(o['sen']), len(o['gov'])
        frases = [f'Em 2026, o {sg} elegeu {nfed} deputado(s) federal(is), {nest} deputado(s) estadual(is) ou distrital(is), {nsen} senador(es) e {ngov} governador(es) no 1º turno'
                  + (f', e disputa o 2º turno para governador em {len(o["gov2"])} estado(s)' if o['gov2'] else '') + '.',
                  f'Recebeu {fmt(o["vfed"])} votos para deputado federal ({pc(o["vfed"], tot_fed)} do total do país).']
        if o['pref'] or o['ver']:
            frases.append(f'Nas eleições municipais de 2024, elegeu {fmt(o["pref"])} prefeito(s) e {fmt(o["ver"])} vereador(es).')
        lista = lambda itens, rot: ''.join(f'<li>{link_cand(uf, k2, "<b>" + e(cap(k2[0])) + "</b>")} <span>{uf.upper()} · {fmt(k2[3])} votos</span></li>' for uf, k2 in sorted(itens, key=lambda x: -x[1][3]))
        blocos = []
        maj = [('Governadores eleitos no 1º turno', o['gov']), ('No 2º turno para governador', o['gov2']), ('Senadores eleitos', o['sen'])]
        for tit, itens in maj:
            if itens:
                blocos.append(f'<section class="card bloco"><h2>{tit} ({len(itens)})</h2><ul class="links">'
                              + ''.join(f'<li><b>{e(cap(k2[0]))}</b> <span class="sub">· <a href="/resultados/{uf}/">{e(UF_NM[uf])}</a> · {fmt(k2[3])} votos</span></li>' for uf, k2 in itens) + '</ul></section>')
        linhas = ''.join(f'<tr><td><a href="/resultados/{uf}/">{e(UF_NM[uf])}</a></td><td class="n">{u["fed"]}</td><td class="n">{fmt(u["vfed"])}</td><td class="n">{u["est"]}</td>'
                         f'<td class="n">{o["pref_uf"].get(uf, 0)}</td><td class="n">{o["ver_uf"].get(uf, 0)}</td></tr>'
                         for uf, u in sorted(o['uf'].items(), key=lambda x: (-x[1]['fed'], -x[1]['vfed'])) if u['vfed'] or u['vest'] or u['fed'] or u['est'] or o['pref_uf'].get(uf))
        if linhas:
            blocos.append('<section class="card bloco"><h2>Por estado</h2><p class="sub">Deputados eleitos e votos para a Câmara em 2026; prefeitos e vereadores eleitos em 2024.</p>'
                          '<div class="rolar"><table><thead><tr><th>Estado</th><th class="n">Dep. federais</th><th class="n">Votos (federal)</th><th class="n">Dep. estaduais</th>'
                          f'<th class="n">Prefeitos 2024</th><th class="n">Vereadores 2024</th></tr></thead><tbody>{linhas}</tbody></table></div></section>')
        if o['fed']: blocos.append(f'<section class="card bloco"><h2>Deputados federais eleitos ({nfed})</h2><ol class="eleitos">{lista(o["fed"], "")}</ol></section>')
        if o['est']: blocos.append(f'<section class="card bloco"><h2>Deputados estaduais e distritais eleitos ({nest})</h2><ol class="eleitos">{lista(o["est"], "")}</ol></section>')
        corpo = f'''<h1>{e(sg)} nas eleições 2026 e 2024: votos e eleitos</h1>
<p class="lead">{e(' '.join(frases))}</p>
<a class="cta" href="/#/partidos">Ver a evolução do {e(sg)} desde 2014 →</a> <!--COMPARTILHAR-->
{''.join(blocos)}
<p class="sub"><a href="/partidos/">Todos os partidos →</a></p>'''
        escreve(caminho + 'index.html', pagina(caminho, f'{sg}: deputados, senadores e governadores eleitos em 2026 | Radar da Eleição',
                f'{sg} nas eleições: {nfed} deputados federais, {nest} estaduais, {nsen} senadores e {ngov} governadores eleitos em 2026; {o["pref"]} prefeitos e {o["ver"]} vereadores em 2024.',
                [('Partidos', 'partidos/'), (sg, caminho)], corpo, imagem=f'{SITE}/img/og/br.png', compart=f'{sg} nas eleições 2026: quem foi eleito'))
        urls.append((caminho, '0.6'))
    linhas = ''.join(f'<tr><td><a href="/partidos/{k.lower()}/"><b>{e(o["sg"])}</b></a></td><td class="n">{len(o["fed"])}</td><td class="n">{len(o["sen"])}</td>'
                     f'<td class="n">{len(o["gov"])}</td><td class="n">{len(o["est"])}</td><td class="n">{fmt(o["pref"])}</td><td class="n">{fmt(o["ver"])}</td></tr>' for k, o in ordem)
    corpo = f'''<h1>Partidos: eleitos em 2026 e 2024</h1>
<p class="lead">Quantos deputados, senadores, governadores, prefeitos e vereadores cada partido elegeu. Clique no partido para ver a lista de eleitos e o resultado por estado.</p>
<a class="cta" href="/#/partidos">Ver votos por partido e por campo político desde 2014 →</a> <!--COMPARTILHAR-->
<section class="card bloco"><div class="rolar"><table><thead><tr><th>Partido</th><th class="n">Dep. federais</th><th class="n">Senadores</th><th class="n">Governadores (1º turno)</th>
<th class="n">Dep. estaduais</th><th class="n">Prefeitos 2024</th><th class="n">Vereadores 2024</th></tr></thead><tbody>{linhas}</tbody></table></div></section>'''
    escreve('partidos/index.html', pagina('partidos/', 'Partidos: deputados, senadores, governadores, prefeitos e vereadores eleitos | Radar da Eleição',
            'Quantos deputados federais, senadores, governadores, deputados estaduais, prefeitos e vereadores cada partido elegeu em 2026 e 2024.',
            [('Partidos', 'partidos/')], corpo, imagem=f'{SITE}/img/og/br.png', compart='Quantos eleitos cada partido teve em 2026 e 2024:'))
    G.escreve_sitemap('sitemap-partidos.xml', urls)
    print(f'partidos: {len(urls)} páginas, {time.time() - t0:.1f}s')

if __name__ == '__main__':
    main()
