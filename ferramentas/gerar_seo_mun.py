"""Páginas estáticas das eleições municipais (para o Google): prefeito e vereadores eleitos em cada cidade.

  /resultados/<ano>/                 índice com os estados
  /resultados/<ano>/<uf>/            prefeitos eleitos em todas as cidades do estado
  /resultados/<ano>/<uf>/<cidade>/   prefeito (1º e 2º turno), vereadores eleitos e suplentes mais votados

Lê mun/<ano>/<uf>/<cidade>.json (dados do TSE já publicados no site) e geo/<uf>.json.
Escreve sitemap-<ano>.xml e atualiza o índice sitemap.xml.
Rodar da raiz do site:  python ferramentas/gerar_seo_mun.py . 2024
"""
import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gerar_seo as G
from gerar_seo import e, fmt, pc, cap, slug, le, escreve, pagina, UF_NM, UF_EM, SITE, DADOS

ANO = sys.argv[2] if len(sys.argv) > 2 else '2024'
DATAS = {'2024': ('6 de outubro de 2024', '27 de outubro de 2024'), '2020': ('15 de novembro de 2020', '29 de novembro de 2020')}
ELEITO = lambda st: st.startswith('ELEITO')

def tabela_pref(titulo, cands, legenda):
    tot = sum(c[7] for c in cands)
    linhas = ''.join(
        f'<tr><td>{i + 1}º</td><td><b>{e(cap(c[1]))}</b>{" <span class=\"tag el\">Eleito(a)</span>" if ELEITO(c[6]) else " <span class=\"tag t2\">2º turno</span>" if "TURNO" in c[6] else ""}</td>'
        f'<td>{e(c[3])}</td><td class="n">{fmt(c[7])}</td><td class="n">{pc(c[7], tot)}</td></tr>' for i, c in enumerate(cands))
    return (f'<section class="card bloco"><h2>{titulo}</h2><p class="sub">{legenda}</p><div class="rolar"><table><thead><tr><th></th><th>Candidato(a)</th>'
            f'<th>Partido</th><th class="n">Votos</th><th class="n">% válidos</th></tr></thead><tbody>{linhas}</tbody></table></div></section>')

def tabela_ver(titulo, cands, legenda, mostra_sit=True):
    linhas = ''.join(
        f'<tr><td>{i + 1}º</td><td><b>{e(cap(c[1]))}</b></td><td>{e(c[3])}</td><td class="n">{fmt(c[7])}</td>'
        + (f'<td>{e("por média" if "MÉDIA" in c[6] else "por quociente" if "QP" in c[6] else "")}</td>' if mostra_sit else '') + '</tr>'
        for i, c in enumerate(cands))
    return (f'<section class="card bloco"><h2>{titulo}</h2><p class="sub">{legenda}</p><div class="rolar"><table><thead><tr><th></th><th>Vereador(a)</th>'
            f'<th>Partido</th><th class="n">Votos</th>{"<th>Vaga</th>" if mostra_sit else ""}</tr></thead><tbody>{linhas}</tbody></table></div></section>')

def main():
    t0 = time.time()
    d1, d2 = DATAS.get(ANO, ('', ''))
    urls, estados, n_pag = [(f'resultados/{ANO}/', '0.8')], [], 0
    for uf in sorted(UF_NM):
        if uf == 'df': continue   # o DF não tem eleição municipal
        geo = le(f'geo/{uf}.json')
        if not geo or not os.path.isdir(os.path.join(G.RAIZ, 'mun', ANO, uf)): print('sem dados:', uf); continue
        nm_uf, em_uf = UF_NM[uf], f'{UF_EM[uf]} {UF_NM[uf]}'
        cidades = []
        for m in sorted(geo['mu'], key=lambda m: m['n']):
            d = le(f'mun/{ANO}/{uf}/{m["t"]}.json')
            if not d: continue
            nm, s = cap(m['n']), slug(m['n'])
            pref1 = sorted([c for c in d['c'] if c[4] == '11' and c[5] == '1'], key=lambda c: -c[7])
            pref2 = sorted([c for c in d['c'] if c[4] == '11' and c[5] == '2'], key=lambda c: -c[7])
            ver = sorted([c for c in d['c'] if c[4] == '13'], key=lambda c: -c[7])
            eleitos = [c for c in ver if ELEITO(c[6])]
            supl = [c for c in ver if c[6] == 'SUPLENTE'][:10]
            vence = next((c for c in (pref2 or pref1) if ELEITO(c[6])), None)
            frases = []
            if vence:
                tot = sum(c[7] for c in (pref2 or pref1))
                frases.append(f'{cap(vence[1])} ({vence[3]}) venceu a eleição para prefeito de {nm}{" no 2º turno" if pref2 else ""}, com {pc(vence[7], tot)} dos votos válidos.')
            if eleitos:
                frases.append(f'A Câmara Municipal tem {len(eleitos)} vereadores eleitos; a maior votação foi de {cap(eleitos[0][1])} ({eleitos[0][3]}), com {fmt(eleitos[0][7])} votos.')
            partidos = {}
            for c in eleitos: partidos[c[3]] = partidos.get(c[3], 0) + 1
            vagas = ' · '.join(f'{p} {n}' for p, n in sorted(partidos.items(), key=lambda x: (-x[1], x[0])))
            blocos = []
            if pref2: blocos.append(tabela_pref('Prefeito · 2º turno', pref2, f'Votação de {d2}.'))
            if pref1: blocos.append(tabela_pref('Prefeito · 1º turno' if pref2 else 'Prefeito', pref1, f'Votação de {d1}.'))
            if eleitos: blocos.append(tabela_ver(f'Vereadores eleitos ({len(eleitos)})', eleitos, f'Vagas por partido: {e(vagas)}.'))
            if supl: blocos.append(tabela_ver('Suplentes mais votados', supl, 'Assumem se um vereador do mesmo partido ou federação deixar o cargo.', False))
            caminho = f'resultados/{ANO}/{uf}/{s}/'
            corpo = f'''<h1>Eleição {ANO} em {e(nm)} ({uf.upper()}): prefeito e vereadores eleitos</h1>
<p class="lead">Resultado das eleições municipais de {ANO} em {e(nm)}: votação para prefeito e a lista dos vereadores eleitos, com partido e número de votos. {e(' '.join(frases))}</p>
<a class="cta" href="/resultados/{uf}/{s}/">Ver a eleição 2026 em {e(nm)} →</a> <!--COMPARTILHAR-->
{''.join(blocos)}
<section class="card bloco"><h2>Mais sobre {e(nm)}</h2><ul class="links">
<li><a href="/resultados/{uf}/{s}/">Eleição 2026 em {e(nm)}: presidente, governador e senador</a></li>
<li><a href="/#/{uf}/{m['t']}">{e(nm)} no mapa interativo: zonas e seções eleitorais</a></li>
<li><a href="/#/comparar">Comparar a votação de um vereador com a de um deputado</a></li>
<li><a href="/resultados/{ANO}/{uf}/">Prefeitos eleitos em {ANO} {e(em_uf)}</a></li></ul></section>'''
            titulo = f'Eleição {ANO} em {nm} ({uf.upper()}): prefeito e vereadores eleitos | Radar da Eleição'
            desc = f'Resultado da eleição {ANO} em {nm} ({uf.upper()}): prefeito eleito e os {len(eleitos)} vereadores eleitos, com partido e votos. ' + (frases[0] if frases else '')
            escreve(caminho + 'index.html', pagina(caminho, titulo, desc[:300],
                    [('Resultados', 'resultados/'), (ANO, f'resultados/{ANO}/'), (nm_uf, f'resultados/{ANO}/{uf}/'), (nm, caminho)], corpo,
                    imagem=f'{DADOS}/og/{uf}/{s}.png', compart=f'Prefeito e vereadores eleitos em {nm} ({uf.upper()}) em {ANO}:'))
            urls.append((caminho, '0.6')); n_pag += 1
            cidades.append((nm, s, vence, bool(pref2)))
        # estado
        part = {}
        for _, _, v, _ in cidades:
            if v: part[v[3]] = part.get(v[3], 0) + 1
        resumo_part = ' · '.join(f'{p} {n}' for p, n in sorted(part.items(), key=lambda x: (-x[1], x[0])))
        linhas = ''.join(f'<tr><td><a href="/resultados/{ANO}/{uf}/{s}/">{e(nm)}</a></td><td>{e(cap(v[1])) if v else "–"}{" <small>(2º turno)</small>" if t2 else ""}</td><td>{e(v[3]) if v else ""}</td></tr>'
                         for nm, s, v, t2 in cidades)
        corpo = f'''<h1>Prefeitos eleitos em {ANO} {e(em_uf)}</h1>
<p class="lead">Resultado das eleições municipais de {ANO} {e(em_uf)}: o prefeito eleito em cada um dos {len(cidades)} municípios e o link para a lista de vereadores eleitos em cada cidade.</p>
<a class="cta" href="/resultados/{uf}/">Ver a eleição 2026 {e(em_uf)} →</a> <!--COMPARTILHAR-->
<section class="card bloco"><h2>Prefeituras por partido</h2><p class="sub">{e(resumo_part)}</p></section>
<section class="card bloco"><h2>Prefeito eleito em cada cidade</h2><div class="rolar"><table><thead><tr><th>Cidade</th><th>Prefeito(a) eleito(a)</th><th>Partido</th></tr></thead><tbody>{linhas}</tbody></table></div></section>'''
        caminho = f'resultados/{ANO}/{uf}/'
        escreve(caminho + 'index.html', pagina(caminho, f'Prefeitos eleitos em {ANO} {em_uf}: resultado em todas as cidades | Radar da Eleição',
                f'Resultado das eleições municipais de {ANO} {em_uf}: prefeito eleito em cada um dos {len(cidades)} municípios, partidos e vereadores eleitos.',
                [('Resultados', 'resultados/'), (ANO, f'resultados/{ANO}/'), (nm_uf, caminho)], corpo,
                imagem=f'{SITE}/img/og/{uf}.png', compart=f'Prefeitos eleitos em {ANO} {em_uf}:'))
        urls.append((caminho, '0.7')); n_pag += 1
        estados.append((uf, nm_uf, len(cidades)))
    corpo = f'''<h1>Eleições municipais de {ANO}: prefeitos e vereadores eleitos</h1>
<p class="lead">Resultado das eleições municipais de {ANO} em todo o Brasil: prefeito e vereadores eleitos em cada cidade, com partido e votos. Dados oficiais do TSE.</p>
<a class="cta" href="/resultados/">Ver a eleição 2026 →</a> <!--COMPARTILHAR-->
<section class="card bloco"><h2>Escolha o estado</h2><ul class="estados">{''.join(f'<li><a href="/resultados/{ANO}/{uf}/"><b>{e(nm)}</b><span>{n} municípios</span></a></li>' for uf, nm, n in estados)}</ul></section>'''
    escreve(f'resultados/{ANO}/index.html', pagina(f'resultados/{ANO}/', f'Eleições {ANO}: prefeitos e vereadores eleitos em todas as cidades | Radar da Eleição',
            f'Resultado das eleições municipais de {ANO}: prefeitos e vereadores eleitos em todos os municípios do Brasil, com partido e votos.',
            [('Resultados', 'resultados/'), (ANO, f'resultados/{ANO}/')], corpo, imagem=f'{SITE}/img/og/br.png',
            compart=f'Prefeitos e vereadores eleitos em {ANO} em todas as cidades:'))
    n_pag += 1
    G.escreve_sitemap(f'sitemap-{ANO}.xml', urls)
    print(f'{ANO}: {n_pag} páginas, {time.time() - t0:.1f}s')

if __name__ == '__main__':
    main()
