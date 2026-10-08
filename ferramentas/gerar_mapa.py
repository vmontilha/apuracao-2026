"""Gera site/mapa/<uf>.json: quem lidera em cada município (presidente, governador, senador).

Serve para pintar o mapa do estado sem que cada visitante baixe centenas de arquivos do TSE:
o resumo fica estático no site (CDN) e o detalhe de cada cidade continua vindo ao vivo do TSE.
Rodar de novo durante uma apuração atualiza os resumos (ex.: python gerar_mapa.py rj sp).
"""
import gzip, json, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, 'site', 'mapa')
T = 'https://resultados.tse.jus.br/oficial/ele2026'
CARGOS = {'1': '6257', '3': '6259', '5': '6259'}
TOPO = 4


def get(url, tent=4):
    for i in range(tent):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers={'Accept-Encoding': 'gzip'}), timeout=60)
            b = r.read()
            return json.loads(gzip.decompress(b) if r.headers.get('Content-Encoding') == 'gzip' else b)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(1 + i * 2)
        except Exception:
            time.sleep(1 + i * 2)
    return None


def n_(v):
    try:
        return int(str(v).split(',')[0]) if v not in (None, '') else 0
    except ValueError:
        return 0


def resumo(r, nomes):
    """[pst%, votos válidos, [[número, votos], ...]]"""
    cands = []
    for g in r['carg'][0].get('agr', []):
        for p in g.get('par', []):
            for c in p.get('cand', []):
                v = n_(c.get('vap'))
                cands.append((str(c['n']), v))
                nomes.setdefault(str(c['n']), [c.get('nmu') or c.get('nm'), p.get('sg', '')])
    cands.sort(key=lambda x: -x[1])
    pst = float(str(r.get('s', {}).get('pstn', '0')).replace(',', '.'))
    return [round(pst, 2), n_(r.get('v', {}).get('vv')), [[n, v] for n, v in cands[:TOPO] if v]]


def um_estado(uf, cm, nome=None):
    mus = [m['cd'] for m in cm]
    out = {'uf': uf, 'gerado': time.strftime('%Y-%m-%dT%H:%M:%S'), 'nomes': {}, 'mu': {}}
    tarefas = [(m, c) for m in mus for c in CARGOS if not (uf == 'df' and c == '0')]

    def baixa(t):
        m, c = t
        return m, c, get(f'{T}/{CARGOS[c]}/dados/{uf}/{uf}{m}-c{int(c):04d}-e{int(CARGOS[c]):06d}-u.json')

    with ThreadPoolExecutor(16) as ex:
        for m, c, r in ex.map(baixa, tarefas):
            if not r:
                continue
            out['nomes'].setdefault(c, {})
            out['mu'].setdefault(m, {})[c] = resumo(r, out['nomes'][c])
    arq = os.path.join(SAIDA, nome or f'{uf}.json')
    json.dump(out, open(arq, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    return f'{uf}: {len(out["mu"])}/{len(mus)} municípios, {os.path.getsize(arq)} bytes'


def deputados(uf, cm, c):
    """site/mapa/<uf>-c<cargo>.json: votos de todos os deputados em cada município.
    cands = [[número, nome de urna, partido, nome completo, sequencial (foto)]]; mu[cidade] = [pst%, válidos, i1, v1, i2, v2, ...]
    (i = posição em cands, só quem teve voto na cidade, em ordem decrescente)."""
    mus = [m['cd'] for m in cm]
    idx, cands, out = {}, [], {}

    def baixa(m):
        return m, get(f'{T}/6259/dados/{uf}/{uf}{m}-c{int(c):04d}-e006259-u.json')

    with ThreadPoolExecutor(16) as ex:
        for m, r in ex.map(baixa, mus):
            if not r:
                continue
            lst = []
            for g in r['carg'][0].get('agr', []):
                for p in g.get('par', []):
                    for k in p.get('cand', []):
                        v = n_(k.get('vap'))
                        n = str(k['n'])
                        if n not in idx:
                            idx[n] = len(cands)
                            cands.append([n, k.get('nmu') or k.get('nm'), p.get('sg', ''), k.get('nm', ''), str(k.get('sqcand', ''))])
                        if v:
                            lst.append((idx[n], v))
            lst.sort(key=lambda x: -x[1])
            pst = float(str(r.get('s', {}).get('pstn', '0')).replace(',', '.'))
            out[m] = [round(pst, 2), n_(r.get('v', {}).get('vv'))] + [x for par in lst for x in par]
    arq = os.path.join(SAIDA, f'{uf}-c{c}.json')
    json.dump({'uf': uf, 'cargo': c, 'gerado': time.strftime('%Y-%m-%dT%H:%M:%S'), 'cands': cands, 'mu': out},
              open(arq, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    return f'{uf}-c{c}: {len(cands)} candidatos, {len(out)}/{len(mus)} municípios, {os.path.getsize(arq)} bytes'


def segundo_turno(uf, cm):
    """mapa/<uf>-t2.json: líder em cada município no 2º turno (presidente e, onde houver, governador)."""
    global CARGOS
    cargos = {'1': '6258'}
    if get(f'{T}/6260/dados/{uf}/{uf}-c0003-e006260-u.json', tent=2):
        cargos['3'] = '6260'
    CARGOS = cargos
    texto = um_estado(uf, cm, f'{uf}-t2.json')
    return texto.replace(f'{uf}:', f'{uf}-t2 ({"presidente e governador" if "3" in cargos else "presidente"}):')


def main():
    global SAIDA
    args = sys.argv[1:]
    if '--saida' in args:
        i = args.index('--saida'); SAIDA = os.path.abspath(args[i + 1]); del args[i:i + 2]
    os.makedirs(SAIDA, exist_ok=True)
    args = [a.lower() for a in args]
    so_dep = '--dep' in args
    t2 = '--t2' in args
    args = [a for a in args if not a.startswith('--')]
    cm = get(f'{T}/6259/config/mun-e006259-cm.json')
    alvo = args or [u['cd'] for u in cm['abr']]
    if t2:
        # 2º turno: só roda se o TSE já publicou o arquivo nacional do 2º turno
        if not get(f'{T}/6258/dados/br/br-c0001-e006258-u.json', tent=2):
            print('2º turno ainda não publicado pelo TSE'); return
        for u in cm['abr']:
            if u['cd'] in alvo:
                print(segundo_turno(u['cd'], u['mu']), flush=True)
        return
    for u in cm['abr']:
        if u['cd'] in alvo:
            if not so_dep:
                print(um_estado(u['cd'], u['mu']), flush=True)
            for c in (['6', '8'] if u['cd'] == 'df' else ['6', '7']):
                print(deputados(u['cd'], u['mu'], c), flush=True)


if __name__ == '__main__':
    main()
