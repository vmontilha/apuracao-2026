"""Votação por seção de 2022 (Dados Abertos do TSE, votacao_secao_2022_<UF>.zip) em um arquivo por zona:

  dados/secao/2022/<uf>/<município>-<zona>.json
    {"loc": {local: [nome, endereço]},
     "s": {seção: {"l": local, "c<cargo>t<turno>": [número, votos, número, votos, ...]}}}

Números de 2 dígitos são votos de legenda; brancos e nulos (95, 96, 97) ficam de fora,
então a soma de cada cargo é o total de votos válidos (como no boletim de urna).
Uso: python gerar_secao2022.py [UF ...]   (os zips ficam em %TEMP%/apur2022/secao2022/)
"""
import csv, io, json, os, sys, zipfile
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor

AQUI = os.path.dirname(os.path.abspath(__file__))
ORIG = os.path.join(os.environ.get('TEMP', '.'), 'apur2022', 'secao2022')
SAIDA = os.path.join(AQUI, 'dados', 'secao', '2022')
FORA = {'95', '96', '97'}


def processa(uf):
    z = zipfile.ZipFile(os.path.join(ORIG, f'{uf}.zip'))
    nome = [n for n in z.namelist() if n.lower().endswith('.csv')][0]
    zonas = defaultdict(lambda: {'loc': {}, 's': defaultdict(lambda: defaultdict(list))})
    with z.open(nome) as fh:
        for r in csv.DictReader(io.TextIOWrapper(fh, encoding='latin-1'), delimiter=';'):
            nv = r['NR_VOTAVEL']
            if nv in FORA:
                continue
            chave = (r['CD_MUNICIPIO'].zfill(5), r['NR_ZONA'].zfill(4))
            Z = zonas[chave]
            sec = r['NR_SECAO'].zfill(4)
            loc = r['NR_LOCAL_VOTACAO']
            if loc not in Z['loc']:
                Z['loc'][loc] = [r['NM_LOCAL_VOTACAO'], r.get('DS_LOCAL_VOTACAO_ENDERECO', '')]
            S = Z['s'][sec]
            S['l'] = loc
            S[f"c{r['CD_CARGO']}t{r['NR_TURNO']}"] += [int(nv), int(r['QT_VOTOS'])]
    pasta = os.path.join(SAIDA, uf.lower())
    os.makedirs(pasta, exist_ok=True)
    total = 0
    for (cm, zn), Z in zonas.items():
        arq = os.path.join(pasta, f'{cm}-{zn}.json')
        with open(arq, 'w', encoding='utf-8') as f:
            json.dump({'loc': Z['loc'], 's': {s: dict(v) for s, v in Z['s'].items()}}, f, ensure_ascii=False, separators=(',', ':'))
        total += os.path.getsize(arq)
    return f'{uf}: {len(zonas)} zonas, {total // 1_000_000} MB'


if __name__ == '__main__':
    ufs = [a.upper() for a in sys.argv[1:]] or sorted(f[:2] for f in os.listdir(ORIG) if f.endswith('.zip'))
    with ProcessPoolExecutor(4) as ex:
        for x in ex.map(processa, ufs):
            print(x, flush=True)
