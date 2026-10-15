"""Páginas estáticas de candidatos a deputado (para o Google): votos em cada cidade e comparação com 2022.

  /candidatos/2026/<uf>/<nome-de-urna>-<número>/

Entram os eleitos e todos os candidatos com pelo menos MIN_VOTOS votos.
Lê mapa/<uf>-c6|c7|c8.json (votos por cidade), hist/2022/<uf>.json (2022) e a situação oficial no TSE.
Escreve sitemap-candidatos.xml e atualiza o índice sitemap.xml.
Rodar da raiz do site:  python ferramentas/gerar_seo_cand.py .
"""
import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gerar_seo as G
from gerar_seo import e, fmt, pc, cap, slug, le, escreve, pagina, UF_NM, UF_EM, SITE, ANO

MIN_VOTOS = 10000
CARGO_NM = {'6': 'Deputado federal', '7': 'Deputado estadual', '8': 'Deputado distrital'}
FOTO = 'https://resultados.tse.jus.br/oficial/ele2026/6259/fotos/{uf}/{sq}.jpeg'

def situacao(st):
    st = (st or '').upper()
    if st.startswith('ELEITO'): return 'Eleito(a)' + (' por média' if 'MÉDIA' in st else ' por quociente partidário' if 'QP' in st else '')
    if 'SUPLENTE' in st: return 'Suplente'
    if 'NÃO ELEITO' in st: return 'Não eleito(a)'
    return cap(st) if st else ''

def url_cand(uf, k):
    return f'candidatos/{ANO}/{uf}/{slug(k["nm"])}-{k["n"]}/'

def carrega(uf):
    """Candidatos de deputado do estado: [{n, nm, sg, nmc, sq, cargo, v, pos, st, mu:{cidade: votos}, vv:{cidade: válidos}}]."""
    out = []
    for c in (['6', '8'] if uf == 'df' else ['6', '7']):
        d = le(f'mapa/{uf}-c{c}.json')
        if not d: continue
        ks = [{'n': k[0], 'nm': k[1], 'sg': k[2], 'nmc': k[3], 'sq': k[4] if len(k) > 4 else '', 'cargo': c, 'v': 0, 'mu': {}} for k in d['cands']]
        vv = {}
        for cd, a in d['mu'].items():
            vv[cd] = a[1]; l = a[2:]
            for j in range(0, len(l), 2):
                k = ks[l[j]]; k['v'] += l[j + 1]; k['mu'][cd] = l[j + 1]
        ord_ = sorted(ks, key=lambda k: -k['v'])
        for i, k in enumerate(ord_): k['pos'] = i + 1; k['vvmu'] = vv
        r = G.tse(uf, c, '6259')
        st = r[4] if r else {}
        tot = r[1] if r else sum(vv.values())
        for k in ord_: k['st'] = st.get(k['n'], ''); k['vvuf'] = tot
        out += ord_
    return out

def main():
    t0 = time.time()
    urls, n_pag = [], 0
    for uf in sorted(UF_NM):
        geo, ks = le(f'geo/{uf}.json'), carrega(uf)
        if not geo or not ks: print('sem dados:', uf); continue
        nome_mu = {m['t']: cap(m['n']) for m in geo['mu']}
        slug_mu = {m['t']: slug(m['n']) for m in geo['mu']}
        h22 = {}
        for c in (le(f'hist/2022/{uf}.json') or {}).get('c', []):
            h22.setdefault(G.slug(c[0]), []).append(c)
        nm_uf, em_uf = UF_NM[uf], f'{UF_EM[uf]} {UF_NM[uf]}'
        escolhidos = [k for k in ks if k['v'] >= MIN_VOTOS or k['st'].startswith('ELEITO')]
        por_partido = {}
        for k in escolhidos:
            if k['st'].startswith('ELEITO'): por_partido.setdefault((k['cargo'], k['sg']), []).append(k)
        for k in escolhidos:
            nm, cargo = cap(k['nm']), CARGO_NM[k['cargo']]
            sit = situacao(k['st'])
            ant = next((x for x in h22.get(G.slug(k['nmc']), []) if x[4] in ('6', '7', '8', '5', '3', '1')), None)
            cidades = sorted(k['mu'].items(), key=lambda x: -x[1])
            frases = [f'{nm} ({k["sg"]}) recebeu {fmt(k["v"])} votos para {cargo.lower()} {em_uf} em {ANO}, {pc(k["v"], k["vvuf"])} dos votos válidos, '
                      f'e ficou em {k["pos"]}º lugar no estado.' + (f' Situação: {sit.lower()}.' if sit else '')]
            if cidades:
                cd, v = cidades[0]
                frases.append(f'A maior votação foi em {nome_mu.get(cd, cd)}, com {fmt(v)} votos.')
            if ant:
                frases.append(f'Em 2022, concorreu a {G.CARGO.get(ant[4], "").lower() or "outro cargo"} e teve {fmt(ant[7])} votos' + (f' ({situacao(ant[6]).lower()})' if situacao(ant[6]) else '') + '.')
            m22 = ant[8] if ant and len(ant) > 8 else {}
            linhas = ''.join(
                f'<tr><td><a href="/resultados/{uf}/{slug_mu.get(cd, "")}/">{e(nome_mu.get(cd, cd))}</a></td><td class="n">{fmt(v)}</td>'
                f'<td class="n">{pc(v, k["vvmu"].get(cd, 0))}</td><td class="n">{fmt(m22[cd]) if cd in m22 else "–"}</td></tr>' for cd, v in cidades)
            colegas = [x for x in por_partido.get((k['cargo'], k['sg']), []) if x is not k][:12]
            caminho = url_cand(uf, k)
            foto = FOTO.format(uf=uf, sq=k['sq']) if k['sq'] else ''
            corpo = f'''<div class="cand-topo">{f'<img src="{foto}" alt="Foto de {e(nm)}" width="96" height="128" loading="lazy" onerror="this.remove()">' if foto else ''}
<div><h1>{e(nm)} ({e(k['sg'])}): votos por cidade na eleição {ANO}</h1>
<p class="sub">{e(cargo)} · {e(nm_uf)} · número {k['n']}{' · ' + e(sit) if sit else ''}</p></div></div>
<p class="lead">{e(' '.join(frases))}</p>
<a class="cta" href="/#/{uf}?c={k['cargo']}&amp;k={k['n']}">Ver {e(nm)} no mapa interativo →</a> <!--COMPARTILHAR-->
<section class="card bloco"><h2>Resumo</h2><div class="rolar"><table><tbody>
<tr><th>Votos em {ANO}</th><td class="n">{fmt(k['v'])}</td></tr>
<tr><th>% dos votos válidos {e(em_uf)}</th><td class="n">{pc(k['v'], k['vvuf'])}</td></tr>
<tr><th>Posição no estado</th><td class="n">{k['pos']}º</td></tr>
<tr><th>Cidades com votos</th><td class="n">{len(cidades)}</td></tr>
{f'<tr><th>Votos em 2022 ({e(G.CARGO.get(ant[4], ""))})</th><td class="n">{fmt(ant[7])}</td></tr>' if ant else ''}
</tbody></table></div></section>
<section class="card bloco"><h2>Votos de {e(nm)} em cada cidade</h2><p class="sub">% = parcela dos votos válidos para {e(cargo.lower())} na cidade. {'2022 = votos na mesma cidade na eleição anterior.' if ant else ''}</p>
<div class="rolar"><table><thead><tr><th>Cidade</th><th class="n">Votos {ANO}</th><th class="n">%</th><th class="n">2022</th></tr></thead><tbody>{linhas}</tbody></table></div></section>
{f'<section class="card bloco"><h2>Outros eleitos do {e(k["sg"])} {e(em_uf)}</h2><ul class="links">' + ''.join(f'<li><a href="/{url_cand(uf, x)}">{e(cap(x["nm"]))}</a> <span class="sub">{fmt(x["v"])} votos</span></li>' for x in colegas) + '</ul></section>' if colegas else ''}
<p class="sub"><a href="/resultados/{uf}/">Todos os eleitos {e(em_uf)} →</a></p>'''
            titulo = f'{nm} ({k["sg"]}): votos por cidade · {cargo} {uf.upper()} {ANO} | Radar da Eleição'
            desc = (f'Quantos votos {nm} teve em cada cidade {em_uf} na eleição {ANO} para {cargo.lower()}: {fmt(k["v"])} votos, {k["pos"]}º lugar'
                    + (f', {sit.lower()}' if sit else '') + '. Comparação com 2022.')
            ld = {'@context': 'https://schema.org', '@type': 'Person', 'name': nm, 'alternateName': cap(k['nmc']),
                  'affiliation': {'@type': 'Organization', 'name': k['sg']}, **({'image': foto} if foto else {})}
            escreve(caminho + 'index.html', pagina(caminho, titulo, desc[:300],
                    [('Resultados', 'resultados/'), (nm_uf, f'resultados/{uf}/'), (nm, caminho)], corpo, extra_ld=[ld],
                    imagem=f'{SITE}/img/og/{uf}.png', compart=f'Votos de {nm} ({k["sg"]}) em cada cidade, eleição {ANO}:'))
            urls.append((caminho, '0.6')); n_pag += 1
        print(uf, len(escolhidos), flush=True)
    G.escreve_sitemap('sitemap-candidatos.xml', urls)
    print(f'candidatos: {n_pag} páginas, {time.time() - t0:.1f}s')

if __name__ == '__main__':
    main()
