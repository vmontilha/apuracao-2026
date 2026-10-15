"""Atualiza resumo/2026.json com a situação oficial mais recente do TSE (governador, senador e deputados).

O TSE corrige resultados depois da eleição (candidaturas anuladas, recálculo do quociente partidário):
em 10/10/2026, por exemplo, os votos de um candidato a governador do RJ foram anulados e o 1º colocado
passou a eleito no 1º turno; em 13/10/2026 a lista de deputados eleitos de Rondônia mudou.
Este script refaz, para cada estado e cargo: quem foi eleito, a situação de cada candidato,
o número de eleitos por partido e, para governador e senador, os votos válidos.
Rodar da raiz do site:  python ferramentas/atualizar_resumo.py .   (mostra o que mudou)
"""
import json, os, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

RAIZ = sys.argv[1] if len(sys.argv) > 1 else '.'
ARQ = os.path.join(RAIZ, 'resumo', '2026.json')
T = 'https://resultados.tse.jus.br/oficial/ele2026/6259/dados'
n_ = lambda v: int(str(v or 0).split(',')[0] or 0)

def baixa(t):
    uf, chave = t
    c = chave[1]
    try:
        return uf, chave, json.load(urllib.request.urlopen(f'{T}/{uf}/{uf}-c{int(c):04d}-e006259-u.json', timeout=60))
    except Exception as x:
        print('TSE indisponível:', uf, chave, x); return uf, chave, None

def main():
    d = json.load(open(ARQ, encoding='utf-8'))
    tarefas = [(uf, k) for uf, cs in d['uf'].items() for k in cs]
    mudou = 0
    with ThreadPoolExecutor(12) as ex:
        for uf, k, r in ex.map(baixa, tarefas):
            if not r: continue
            x = d['uf'][uf][k]; maj = k[1] in '35'
            cand = {}
            for g in r['carg'][0].get('agr', []):
                for p in g.get('par', []):
                    for c in p.get('cand', []):
                        cand[str(c['n'])] = (c.get('nmu') or c.get('nm'), p.get('sg', ''), n_(c.get('vap')), str(c.get('st') or '').upper())
            # retotalização em andamento (ex.: Rondônia em 13/10/2026): ninguém tem situação ainda -> mantém a lista anterior
            if r.get('tf') != 's' or not any(st for *_, st in cand.values()):
                print(f'{uf} {k}: TSE retotalizando (atualizado {r.get("dg")}); mantida a situação anterior'); continue
            antes = {e[2] for e in x['eleitos']}
            eleitos = sorted(([nm, sg, n, v, st] for n, (nm, sg, v, st) in cand.items() if st.startswith('ELEITO')), key=lambda e: -e[3])
            depois = {e[2] for e in eleitos}
            # situação (e, no majoritário, votos) atualizada na lista dos mais votados
            for e in x['top']:
                if e[2] in cand:
                    e[4] = cand[e[2]][3]
                    if maj: e[3] = cand[e[2]][2]
            if maj:
                x['top'].sort(key=lambda e: -e[3])
                x['tot'] = n_(r['v']['vv'])
            x['eleitos'] = eleitos
            for sg in x['part']: x['part'][sg][1] = 0
            for e in eleitos:
                x['part'].setdefault(e[1], [0, 0])[1] += 1
            if antes != depois:
                mudou += 1
                print(f'{uf} {k}: entraram {sorted(depois - antes)} · saíram {sorted(antes - depois)}')
    json.dump(d, open(ARQ, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'resumo atualizado ({mudou} listas de eleitos mudaram)')

if __name__ == '__main__':
    main()
