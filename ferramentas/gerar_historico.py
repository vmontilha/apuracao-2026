"""Gera os arquivos de histórico do site a partir dos Dados Abertos do TSE
(votacao_candidato_munzona_<ano>.zip), para 2014, 2018, 2022 e 2026:

  site/hist/<ano>/<uf>.json    candidatos com votos por município
                               {"c": [[nome, nome_urna, número, partido, cargo, turno, situação, total, {município: votos}]]}
  site/zona/<ano>/<uf>-c<cargo>t<turno>.json   votos por zona eleitoral (só municípios com mais de uma zona)
                               {"cands": [[número, nome_urna, partido, nome]], "mu": {município: {zona: [i, votos, i, votos, ...]}}}
  site/resumo/<ano>.json       por estado e cargo: votos por partido, eleitos e mais votados

Uso: python gerar_historico.py 2022 2026    (o zip de cada ano fica em %TEMP%/apur2022/munzona<ano>.zip)
"""
import csv, io, json, os, sys, zipfile
from collections import defaultdict

AQUI = os.path.dirname(os.path.abspath(__file__))
ORIG = os.path.join(os.environ.get('TEMP', '.'), 'apur2022')
CARGOS = {'1', '3', '5', '6', '7', '8'}
COM_ZONA = {'2022', '2026'}


def salvar(caminho, obj):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    with open(caminho, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))


def eleito(sit):
    s = sit.upper()
    return s.startswith('ELEITO') or s == 'ELEITO'


def processa(ano):
    z = zipfile.ZipFile(os.path.join(ORIG, f'munzona{ano}.zip'))
    # por UF: sq -> info; votos por município e por zona
    info = defaultdict(dict)
    mun = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    zon = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    zonas_mun = defaultdict(lambda: defaultdict(set))
    for nome in sorted(z.namelist()):
        base = nome.rsplit('_', 1)[-1][:-4].upper()
        if not nome.lower().endswith('.csv') or base in ('BRASIL', 'ZZ'):
            continue
        with z.open(nome) as fh:
            for r in csv.DictReader(io.TextIOWrapper(fh, encoding='latin-1'), delimiter=';'):
                cargo = r['CD_CARGO']
                if cargo not in CARGOS:
                    continue
                uf = r['SG_UF'].lower()
                if uf in ('zz', 'br') or len(uf) != 2:
                    continue
                turno = r['NR_TURNO']
                sq = r['SQ_CANDIDATO'] + '/' + turno
                if sq not in info[uf]:
                    info[uf][sq] = [r['NM_CANDIDATO'], r['NM_URNA_CANDIDATO'], r['NR_CANDIDATO'], r['SG_PARTIDO'],
                                    cargo, turno, r['DS_SIT_TOT_TURNO']]
                v = int(r['QT_VOTOS_NOMINAIS'] or 0)
                cm = r['CD_MUNICIPIO'].zfill(5)
                zn = r['NR_ZONA'].zfill(4)
                zonas_mun[uf][cm].add(zn)
                if v:
                    mun[uf][sq][cm] += v
                    if ano in COM_ZONA:
                        zon[uf][sq][(cm, zn)] += v
        print(ano, nome, flush=True)

    resumo = {}
    for uf in sorted(info):
        cands = []
        for sq, i in info[uf].items():
            m = {k: v for k, v in mun[uf][sq].items() if v}
            cands.append(i + [sum(m.values()), m, sq])
        cands.sort(key=lambda c: (c[4], c[5], -c[7]))
        salvar(os.path.join(AQUI, 'site', 'hist', ano, f'{uf}.json'), {'ano': ano, 'c': [c[:9] for c in cands]})

        # resumo por cargo/turno
        R = {}
        grupos = defaultdict(list)
        for c in cands:
            grupos[f'c{c[4]}t{c[5]}'].append(c)
        for g, lst in grupos.items():
            part = defaultdict(lambda: [0, 0])
            for c in lst:
                part[c[3]][0] += c[7]
                if eleito(c[6]):
                    part[c[3]][1] += 1
            lim = 20 if g[1] in '678' else 10
            R[g] = {'tot': sum(c[7] for c in lst), 'part': dict(part),
                    'top': [[c[1], c[3], c[2], c[7], c[6]] for c in lst[:lim]],
                    'eleitos': [[c[1], c[3], c[2], c[7], c[6]] for c in lst if eleito(c[6])]}
        resumo[uf] = R

        # zonas: só municípios com mais de uma zona
        if ano in COM_ZONA:
            multi = {cm for cm, zs in zonas_mun[uf].items() if len(zs) > 1}
            for g in grupos:
                lst = grupos[g]
                idx = {c[9]: i for i, c in enumerate(lst)}
                mu = defaultdict(lambda: defaultdict(list))
                for c in lst:
                    for (cm, zn), v in zon[uf][c[9]].items():
                        if cm in multi:
                            mu[cm][zn].append((idx[c[9]], v))
                if not mu:
                    continue
                out = {cm: {zn: [x for p in sorted(l, key=lambda p: -p[1]) for x in p] for zn, l in zs.items()} for cm, zs in mu.items()}
                salvar(os.path.join(AQUI, 'site', 'zona', ano, f'{uf}-{g}.json'),
                       {'ano': ano, 'cands': [[c[2], c[1], c[3], c[0]] for c in lst], 'mu': out})
        print(ano, uf, len(cands), 'candidatos', flush=True)
    salvar(os.path.join(AQUI, 'site', 'resumo', f'{ano}.json'), {'ano': ano, 'uf': resumo})


if __name__ == '__main__':
    for a in sys.argv[1:]:
        processa(a)
