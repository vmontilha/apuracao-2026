"""Eleitos nas eleições municipais (a partir de site/mun/<ano>/<uf>/<cidade>.json):

  site/eleitosmun/<ano>/<uf>.json
    {"mu": {cidade: {"p": [nome_urna, partido, número, votos, turno] | null,
                     "v": [[nome_urna, partido, número, votos], ...]}}}   (p = prefeito, v = vereadores)
Uso: python gerar_eleitos_mun.py 2024 2020
"""
import json, os, sys

AQUI = os.path.dirname(os.path.abspath(__file__))


def eleito(sit):
    return sit.upper().startswith('ELEITO')


def processa(ano):
    base = os.path.join(AQUI, 'site', 'mun', ano)
    for uf in sorted(os.listdir(base)):
        out = {}
        for arq in os.listdir(os.path.join(base, uf)):
            c = json.load(open(os.path.join(base, uf, arq), encoding='utf-8'))['c']
            pref = [x for x in c if x[4] == '11' and eleito(x[6])]
            pref.sort(key=lambda x: x[5], reverse=True)   # 2º turno vale sobre o 1º
            ver = sorted([x for x in c if x[4] == '13' and eleito(x[6])], key=lambda x: -x[7])
            out[arq[:-5]] = {'p': [pref[0][1], pref[0][3], pref[0][2], pref[0][7], pref[0][5]] if pref else None,
                             'v': [[x[1], x[3], x[2], x[7]] for x in ver]}
        dest = os.path.join(AQUI, 'site', 'eleitosmun', ano, f'{uf}.json')
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        json.dump({'ano': ano, 'mu': out}, open(dest, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        nv = sum(len(m['v']) for m in out.values()); npf = sum(1 for m in out.values() if m['p'])
        print(ano, uf, len(out), 'cidades', npf, 'prefeitos', nv, 'vereadores', os.path.getsize(dest) // 1000, 'KB', flush=True)


if __name__ == '__main__':
    for a in sys.argv[1:]:
        processa(a)
