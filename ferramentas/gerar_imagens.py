"""Gera as imagens de prévia (1200x630) que aparecem ao compartilhar no WhatsApp, X, Facebook etc.

  img/og/br.png              Brasil
  img/og/<uf>.png            estado em destaque no mapa do Brasil
  img/og/<uf>/<cidade>.png   cidade em destaque no mapa do estado

Não mostram números (continuam valendo no 2º turno): só o lugar, o mapa e a marca.
Precisa do Pillow e da fonte Arial (Windows). Rodar da raiz do site:
  python ferramentas/gerar_imagens.py            (tudo)
  python ferramentas/gerar_imagens.py rj sp      (só alguns estados)
"""
import json, os, re, sys, unicodedata
from concurrent.futures import ProcessPoolExecutor
from PIL import Image, ImageDraw, ImageFont

RAIZ = '.'
W, H, S = 1200, 630, 2           # S = superamostragem (contornos suaves)
NAVY, NAVY2, LINHA = (18, 36, 58), (32, 58, 86), (52, 82, 112)
TEAL, BRANCO, CINZA = (0, 168, 150), (255, 255, 255), (170, 186, 204)
FONTE = 'C:/Windows/Fonts/arialbd.ttf'
FONTE_R = 'C:/Windows/Fonts/arial.ttf'
UF_NM = {'ac': 'Acre', 'al': 'Alagoas', 'ap': 'Amapá', 'am': 'Amazonas', 'ba': 'Bahia', 'ce': 'Ceará', 'df': 'Distrito Federal',
         'es': 'Espírito Santo', 'go': 'Goiás', 'ma': 'Maranhão', 'mt': 'Mato Grosso', 'ms': 'Mato Grosso do Sul', 'mg': 'Minas Gerais',
         'pa': 'Pará', 'pb': 'Paraíba', 'pr': 'Paraná', 'pe': 'Pernambuco', 'pi': 'Piauí', 'rj': 'Rio de Janeiro', 'rn': 'Rio Grande do Norte',
         'rs': 'Rio Grande do Sul', 'ro': 'Rondônia', 'rr': 'Roraima', 'sc': 'Santa Catarina', 'sp': 'São Paulo', 'se': 'Sergipe', 'to': 'Tocantins'}
MINUSC = {'da', 'de', 'do', 'das', 'dos', 'e', 'di', 'du'}
cap = lambda s: ' '.join(w if (i and w in MINUSC) else '-'.join(p[:1].upper() + p[1:] for p in w.split('-')) for i, w in enumerate(s.lower().split()))
def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')

def poligonos(d):
    """Caminhos do geo/ (só M, l e z) -> listas de pontos."""
    out, pts, x, y = [], [], 0.0, 0.0
    for cmd, nums in re.findall(r'([MlLz])([^MlLz]*)', d):
        v = [float(n) for n in re.findall(r'-?\d+(?:\.\d+)?', nums)]
        if cmd == 'M':
            if pts: out.append(pts)
            x, y = v[0], v[1]; pts = [(x, y)]
            v = v[2:]
            for i in range(0, len(v) - 1, 2): x, y = v[i], v[i + 1]; pts.append((x, y))
        elif cmd == 'l':
            for i in range(0, len(v) - 1, 2): x += v[i]; y += v[i + 1]; pts.append((x, y))
        elif cmd == 'L':
            for i in range(0, len(v) - 1, 2): x, y = v[i], v[i + 1]; pts.append((x, y))
        elif cmd == 'z':
            if pts: out.append(pts); pts = []
    if pts: out.append(pts)
    return out

def fonte(tam, negrito=True):
    return ImageFont.truetype(FONTE if negrito else FONTE_R, tam * S)

def quebra(dr, texto, f, larg):
    linhas, atual = [], ''
    for w in texto.split():
        t = (atual + ' ' + w).strip()
        if dr.textlength(t, font=f) <= larg or not atual: atual = t
        else: linhas.append(atual); atual = w
    return linhas + [atual]

def cartao(formas, destaque, titulo, sub, linha3):
    """formas: [(polígonos, destacado?)] no sistema do geo; desenha mapa à direita e textos à esquerda."""
    im = Image.new('RGB', (W * S, H * S), NAVY)
    dr = ImageDraw.Draw(im)
    # mapa: caixa à direita
    xs = [p[0] for pol, _ in formas for poly in pol for p in poly]; ys = [p[1] for pol, _ in formas for poly in pol for p in poly]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    bx, by, bw, bh = 640, 40, 520, 550
    k = min(bw / max(x1 - x0, 1), bh / max(y1 - y0, 1))
    ox, oy = bx + (bw - (x1 - x0) * k) / 2, by + (bh - (y1 - y0) * k) / 2
    tr = lambda p: ((ox + (p[0] - x0) * k) * S, (oy + (p[1] - y0) * k) * S)
    for pol, dest in sorted(formas, key=lambda f: f[1]):
        for poly in pol:
            if len(poly) > 2:
                dr.polygon([tr(p) for p in poly], fill=TEAL if dest else NAVY2, outline=NAVY if not dest else TEAL)
    # textos
    dr.text((64 * S, 64 * S), 'RADAR DA ELEIÇÃO', font=fonte(24), fill=TEAL)
    f = fonte(64 if len(titulo) < 16 else 54 if len(titulo) < 24 else 46)
    y = 150 * S
    for ln in quebra(dr, titulo, f, 540 * S)[:3]:
        dr.text((64 * S, y), ln, font=f, fill=BRANCO); y += int(f.size * 1.15)
    y += 16 * S
    for ln in quebra(dr, sub, fonte(30, False), 540 * S)[:2]:
        dr.text((64 * S, y), ln, font=fonte(30, False), fill=BRANCO); y += 40 * S
    y += 8 * S
    for ln in quebra(dr, linha3, fonte(22, False), 540 * S)[:3]:
        dr.text((64 * S, y), ln, font=fonte(22, False), fill=CINZA); y += 32 * S
    dr.rectangle((64 * S, (H - 92) * S, 112 * S, (H - 88) * S), fill=TEAL)
    dr.text((64 * S, (H - 72) * S), 'radardaeleicao.com.br', font=fonte(26), fill=BRANCO)
    im = im.resize((W, H), Image.LANCZOS).quantize(colors=32, method=Image.Quantize.MEDIANCUT)
    return im

def salva(im, rel):
    p = os.path.join(RAIZ, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, optimize=True)

def um_estado(uf):
    g = json.load(open(os.path.join(RAIZ, 'geo', f'{uf}.json'), encoding='utf-8'))
    polys = [(m, poligonos(m['d'])) for m in g['mu']]
    n = 0
    for m, pol in polys:
        nm = cap(m['n'])
        formas = [(p, mm['t'] == m['t']) for mm, p in polys]
        salva(cartao(formas, True, nm, f'Resultado da eleição 2026 em {nm} ({uf.upper()})',
                     'Presidente, governador, senador e deputados · mapa por zona e seção eleitoral'),
              f'img/og/{uf}/{slug(m["n"])}.png'); n += 1
    return f'{uf}: {n} cidades'

def main():
    alvo = [a.lower() for a in sys.argv[1:]] or sorted(UF_NM)
    br = json.load(open(os.path.join(RAIZ, 'geo', 'br.json'), encoding='utf-8'))
    est = [(e['uf'], poligonos(e['d'])) for e in br['estados']]
    salva(cartao([(p, True) for _, p in est], True, 'Eleição 2026, em dados', 'Resultado da eleição por estado, cidade, zona e seção eleitoral',
                 'Presidente, governador, senador e deputados · comparação com 2022, 2018 e 2014'), 'img/og/br.png')
    for uf in alvo:
        salva(cartao([(p, u == uf) for u, p in est], True, UF_NM[uf], f'Resultado da eleição 2026 {"no" if uf in ("ac","ap","am","ce","df","es","ma","pa","pr","pi","rj","rn","rs","to") else "na" if uf in ("ba","pb") else "em"} {UF_NM[uf]}',
                     'Governador, senadores, deputados eleitos e a votação em cada cidade'), f'img/og/{uf}.png')
    with ProcessPoolExecutor() as ex:
        for r in ex.map(um_estado, alvo): print(r, flush=True)

if __name__ == '__main__':
    main()
