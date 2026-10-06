"""Dados para a aba Comparar (Dados Abertos do TSE, votacao_candidato_munzona_<ano>.zip):

  site/mun/<ano>/<uf>/<município>.json   eleições municipais (2016, 2020, 2024): todos os candidatos
        {"c": [[nome, nome_urna, número, partido, cargo, turno, situação, total, {zona: votos}]]}
  site/partido/<ano>/<uf>.json           qualquer eleição (2014 a 2026): votos nominais por partido em cada município
        {"mu": {município: {"c<cargo>t<turno>": {partido: votos}}}}

Uso: python gerar_municipal.py 2024 2020 2016 2026 2022 2018 2014
"""
import csv, io, json, os, sys, zipfile
from collections import defaultdict

AQUI = os.path.dirname(os.path.abspath(__file__))
ORIG = os.path.join(os.environ.get('TEMP', '.'), 'apur2022')
MUNICIPAIS = {'2016', '2020', '2024'}
CARGOS_GERAIS = {'1', '3', '5', '6', '7', '8'}
CARGOS_MUN = {'11', '13'}


def salvar(caminho, obj):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    with open(caminho, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))


def processa(ano):
    municipal = ano in MUNICIPAIS
    cargos = CARGOS_MUN if municipal else CARGOS_GERAIS
    z = zipfile.ZipFile(os.path.join(ORIG, f'munzona{ano}.zip'))
    part = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(int))))  # uf > mun > grupo > sg
    info = defaultdict(dict)                                                               # (uf, mun) > sq > info
    zon = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))                       # (uf, mun) > sq > zona
    for nome in sorted(z.namelist()):
        base = nome.rsplit('_', 1)[-1][:-4].upper()
        if not nome.lower().endswith('.csv') or base in ('BRASIL', 'ZZ'):
            continue
        with z.open(nome) as fh:
            for r in csv.DictReader(io.TextIOWrapper(fh, encoding='latin-1'), delimiter=';'):
                cargo = r['CD_CARGO']
                if cargo not in cargos:
                    continue
                uf = r['SG_UF'].lower()
                if len(uf) != 2 or uf in ('zz', 'br'):
                    continue
                v = int(r['QT_VOTOS_NOMINAIS'] or 0)
                cm = r['CD_MUNICIPIO'].zfill(5)
                turno = r['NR_TURNO']
                if v:
                    part[uf][cm][f'c{cargo}t{turno}'][r['SG_PARTIDO']] += v
                if municipal:
                    sq = r['SQ_CANDIDATO'] + '/' + turno
                    d = info[(uf, cm)]
                    if sq not in d:
                        d[sq] = [r['NM_CANDIDATO'], r['NM_URNA_CANDIDATO'], r['NR_CANDIDATO'], r['SG_PARTIDO'],
                                 cargo, turno, r['DS_SIT_TOT_TURNO']]
                    if v:
                        zon[(uf, cm)][sq][r['NR_ZONA'].zfill(4)] += v
        print(ano, nome, flush=True)

    for uf, mus in part.items():
        salvar(os.path.join(AQUI, 'site', 'partido', ano, f'{uf}.json'),
               {'ano': ano, 'mu': {cm: {g: dict(p) for g, p in gs.items()} for cm, gs in mus.items()}})
    if municipal:
        for (uf, cm), d in info.items():
            cands = []
            for sq, i in d.items():
                zz = dict(zon[(uf, cm)][sq])
                cands.append(i + [sum(zz.values()), zz])
            cands.sort(key=lambda c: (c[4], c[5], -c[7]))
            salvar(os.path.join(AQUI, 'site', 'mun', ano, uf, f'{cm}.json'), {'ano': ano, 'c': cands})
    print(ano, 'pronto', len(part), 'estados', len(info), 'municípios', flush=True)


if __name__ == '__main__':
    for a in sys.argv[1:]:
        processa(a)
