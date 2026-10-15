"""Índice da busca das páginas de resultado: /busca.json = [[nome, detalhe, endereço], ...].
Junta estados, cidades (2026 e 2024) e candidatos a partir das páginas já geradas.
Rodar da raiz do site, depois dos outros geradores:  python ferramentas/gerar_busca.py .
"""
import html, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gerar_seo as G

R = G.RAIZ
out = []
for uf, nm in sorted(G.UF_NM.items(), key=lambda x: x[1]):
    out.append([nm, f'Estado · {uf.upper()}', f'/resultados/{uf}/'])
pdir = os.path.join(R, 'partidos')
for d in sorted(os.listdir(pdir)) if os.path.isdir(pdir) else []:
    f = os.path.join(pdir, d, 'index.html')
    if os.path.exists(f):
        m = re.search(r'<title>(.*?):', html.unescape(open(f, encoding='utf-8').read(2000)))
        if m: out.append([m.group(1), 'Partido · eleitos em 2026 e 2024', f'/partidos/{d}/'])
for uf in sorted(G.UF_NM):
    geo = G.le(f'geo/{uf}.json')
    for m in (geo or {}).get('mu', []):
        s = G.slug(m['n'])
        if os.path.exists(os.path.join(R, 'resultados', uf, s, 'index.html')):
            out.append([G.cap(m['n']), f'{uf.upper()} · eleição 2026', f'/resultados/{uf}/{s}/'])
        if os.path.exists(os.path.join(R, 'resultados', '2024', uf, s, 'index.html')):
            out.append([G.cap(m['n']), f'{uf.upper()} · prefeito e vereadores 2024', f'/resultados/2024/{uf}/{s}/'])
base = os.path.join(R, 'candidatos', G.ANO)
for uf in sorted(os.listdir(base)) if os.path.isdir(base) else []:
    for d in sorted(os.listdir(os.path.join(base, uf))):
        t = open(os.path.join(base, uf, d, 'index.html'), encoding='utf-8').read(3000)
        m = re.search(r'<title>(.*?) \((.*?)\): votos por cidade · (.*?) [A-Z]{2} ', html.unescape(t))
        if m:
            out.append([m.group(1), f'{m.group(2)} · {m.group(3)} {uf.upper()}', f'/candidatos/{G.ANO}/{uf}/{d}/'])
G.escreve('busca.json', json.dumps(out, ensure_ascii=False, separators=(',', ':')))
print(len(out), 'itens na busca')
