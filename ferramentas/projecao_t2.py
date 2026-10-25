"""Coeficientes da projeção do 2º turno de presidente, por região (mapa/projecao-t2.json).

Para uma amostra das seções já recebidas pelo TSE em cada região (até AMOSTRA por região), compara a MESMA
seção no 1º e no 2º turno (boletins de urna) e calcula:
  dComp  variação do comparecimento (comparecimento/aptos 2º turno − 1º turno)
  val2   votos válidos (Lula + Flávio) / comparecimento, no 2º turno
  p      parte dos votos dos OUTROS candidatos do 1º turno que foi para Lula:
         em cada seção, (fatia de Lula nos válidos do 2º turno × válidos do 1º turno − votos de Lula no 1º turno) / votos dos outros,
         limitado a 0–1 e somado pesando pelos votos dos outros da seção.
O site (js/aovivo.js) aplica esses números ao 1º turno de cada estado:
  comparecimento = aptos × (comparecimento do 1º turno + dComp da região); válidos = comparecimento × val2;
  Lula = válidos × (Lula 1º turno + p × outros) / válidos do 1º turno; Flávio = o resto.
Rodar da raiz do site:  python ferramentas/projecao_t2.py .
"""
import json, os, random, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

RAIZ = sys.argv[1] if len(sys.argv) > 1 else '.'
B = 'https://resultados.tse.jus.br/oficial/ele2026/arquivo-urna'
P1, P2 = '3220', '3221'
A, Bn = '13', '22'
AMOSTRA = int(os.environ.get('AMOSTRA', '400'))
REG = {'N': 'ac am ap pa ro rr to', 'NE': 'al ba ce ma pb pe pi rn se', 'CO': 'df go ms mt', 'SE': 'es mg rj sp', 'S': 'pr rs sc', 'ZZ': 'zz'}
UF_REG = {u: r for r, us in REG.items() for u in us.split()}

def get(url, binario=False, tent=3):
    for i in range(tent):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers={'Cache-Control': 'no-cache'}), timeout=25).read()
            return r if binario else json.loads(r)
        except urllib.error.HTTPError as e:
            if e.code == 404: return None
        except Exception:
            pass
        time.sleep(1 + i)
    return None

# ---- leitura do boletim de urna (ASN.1 BER), mesma lógica do lerBU de js/app.js ----
def tlv(b, i):
    t0 = b[i]; i += 1; tag = t0 & 0x1f
    if tag == 0x1f:
        tag = 0
        while True:
            x = b[i]; i += 1; tag = tag * 128 + (x & 0x7f)
            if not x & 0x80: break
    l = b[i]; i += 1
    if l & 0x80:
        n = l & 0x7f; l = 0
        for _ in range(n): l = l * 256 + b[i]; i += 1
    return {'cls': t0 >> 6, 'cons': bool(t0 & 0x20), 'tag': tag, 's': i, 'e': i + l}
def kids(b, s, e):
    o = []
    while s < e:
        k = tlv(b, s); o.append(k); s = k['e']
    return o
def inteiro(b, k):
    v = int.from_bytes(b[k['s']:k['e']], 'big') if k['e'] > k['s'] else 0
    if k['e'] > k['s'] and b[k['s']] & 0x80: v -= 256 ** (k['e'] - k['s'])
    return v
tam = lambda k: k['e'] - k['s']
def presidente(b):
    """{aptos, compar, nom: {número: votos}, branco, nulo} do cargo 1 (presidente) do boletim."""
    env = tlv(b, 0)
    oc = sorted([k for k in kids(b, env['s'], env['e']) if k['cls'] == 0 and not k['cons'] and k['tag'] == 4], key=tam, reverse=True)[0]
    bu = tlv(b, oc['s']); top = kids(b, bu['s'], bu['e'])
    seqs = [k for k in top if k['cls'] == 0 and k['cons'] and k['tag'] == 16]
    res = max(seqs, key=tam)
    for el in kids(b, res['s'], res['e']):
        f = kids(b, el['s'], el['e']); aptos = inteiro(b, f[1]); rvs = next((x for x in f if x['cons']), None)
        if not rvs: continue
        for rv in kids(b, rvs['s'], rvs['e']):
            g = kids(b, rv['s'], rv['e']); compar = inteiro(b, g[1]); tots = next((x for x in g if x['cons']), None)
            if not tots: continue
            for tc in kids(b, tots['s'], tots['e']):
                h = kids(b, tc['s'], tc['e']); cod = h[0]
                if cod['cons']: cod = kids(b, cod['s'], cod['e'])[0]
                if inteiro(b, cod) != 1: continue
                vl = next((x for x in h if x['cons'] and x['cls'] == 0 and x['tag'] == 16), None)
                C = {'aptos': aptos, 'compar': compar, 'nom': {}, 'branco': 0, 'nulo': 0}
                for vv in kids(b, vl['s'], vl['e']) if vl else []:
                    tipo = q = 0; ident = None
                    for x in kids(b, vv['s'], vv['e']):
                        if x['cls'] != 2: continue
                        if x['tag'] == 1: tipo = inteiro(b, x)
                        elif x['tag'] == 2: q = inteiro(b, x)
                        elif x['tag'] == 3 and x['cons']: ident = [inteiro(b, y) for y in kids(b, x['s'], x['e'])]
                    if tipo == 1 and ident: C['nom'][str(ident[1])] = C['nom'].get(str(ident[1]), 0) + q
                    elif tipo == 2: C['branco'] += q
                    elif tipo == 3: C['nulo'] += q
                return C
    return None

def boletim(p, uf, m, z, s):
    d = f'{B}/{p}/dados/{uf}/{m}/{z}/{s}'
    a = get(f'{d}/p00{p}-{uf}-m{m}-z{z}-s{s}-aux.json')
    if not a: return None
    for h in reversed(a.get('hashes') or []):
        nm = next((x['nm'] if isinstance(x, dict) else x for x in (h.get('arq') or h.get('nmarq') or []) if str(x['nm'] if isinstance(x, dict) else x).endswith('-bu.dat')), None)
        if nm:
            b = get(f'{d}/{h["hash"]}/{nm}', binario=True)
            return presidente(b) if b else None
    return None

def main():
    t0 = time.time()
    recebidas = {r: [] for r in REG}
    def cs(uf):
        c = get(f'{B}/{P2}/config/{uf}/{uf}-p00{P2}-cs.json')
        return [(uf, m['cd'], z['cd'], s['ns']) for a in (c or {}).get('abr', []) for m in a['mu'] for z in m['zon'] for s in z['sec'] if s.get('da')]
    with ThreadPoolExecutor(14) as ex:
        for lst in ex.map(cs, UF_REG):
            for t in lst: recebidas[UF_REG[t[0]]].append(t)
    amostra = [t for r, l in recebidas.items() for t in random.sample(l, min(AMOSTRA, len(l)))]
    def um(t):
        c2, c1 = boletim(P2, *t), boletim(P1, *t)
        return (t, c1, c2) if c1 and c2 else None
    with ThreadPoolExecutor(32) as ex: res = [x for x in ex.map(um, amostra) if x]
    acc = {r: dict(n=0, apt1=0, cmp1=0, apt2=0, cmp2=0, V2=0, O1=0, pO=0) for r in list(REG) + ['BR']}
    for (uf, *_), c1, c2 in res:
        L1, F1 = c1['nom'].get(A, 0), c1['nom'].get(Bn, 0); O1 = sum(v for n, v in c1['nom'].items() if n not in (A, Bn))
        L2, F2 = c2['nom'].get(A, 0), c2['nom'].get(Bn, 0); V1, V2 = L1 + F1 + O1, L2 + F2
        for g in (acc[UF_REG[uf]], acc['BR']):
            g['n'] += 1; g['apt1'] += c1['aptos']; g['cmp1'] += c1['compar']; g['apt2'] += c2['aptos']; g['cmp2'] += c2['compar']; g['V2'] += V2
            if O1 and V2:
                p = max(0.0, min(1.0, (L2 / V2 * V1 - L1) / O1)); g['O1'] += O1; g['pO'] += p * O1
    def coef(g):
        if not g['n'] or not g['cmp2'] or not g['O1']: return None
        return {'secoes': g['n'], 'dComp': g['cmp2'] / g['apt2'] - g['cmp1'] / g['apt1'], 'val2': g['V2'] / g['cmp2'], 'p': g['pO'] / g['O1'], 'outros1': g['O1']}
    br = coef(acc['BR'])
    out = {'gerado': time.strftime('%Y-%m-%dT%H:%M:%S'), 'recebidas': {r: len(l) for r, l in recebidas.items()}, 'brasil': br, 'regiao': {}}
    for r in REG:
        c = coef(acc[r])
        # região com menos de 20 seções na amostra usa os números do país (amostra pequena demais)
        out['regiao'][r] = c if c and c['secoes'] >= 20 else dict(br or {}, secoes=c['secoes'] if c else 0, usaBrasil=True)
    os.makedirs(os.path.join(RAIZ, 'mapa'), exist_ok=True)
    json.dump(out, open(os.path.join(RAIZ, 'mapa', 'projecao-t2.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'{len(res)} seções comparadas ({sum(out["recebidas"].values())} recebidas) em {time.time() - t0:.0f}s')
    for r, c in out['regiao'].items(): print(r, c)

if __name__ == '__main__':
    main()
