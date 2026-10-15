"""Avisa o Bing (e Copilot, Yandex, Seznam, Naver) pelo IndexNow que as páginas do sitemap mudaram.
O Google não usa IndexNow: ele lê o sitemap.xml cadastrado no Search Console.
Rodar da raiz do site depois de publicar:  python ferramentas/avisar_buscadores.py
"""
import json, re, urllib.request
CHAVE = 'decc92846c9ebec108298d3d7b579e63'   # o arquivo /decc92846c9ebec108298d3d7b579e63.txt no site comprova que o site é nosso
SITE = 'radardaeleicao.com.br'
import glob
urls = [u for f in sorted(glob.glob('sitemap-*.xml')) for u in re.findall(r'<loc>(.*?)</loc>', open(f, encoding='utf-8').read())]
for i in range(0, len(urls), 10000):
    corpo = json.dumps({'host': SITE, 'key': CHAVE, 'keyLocation': f'https://{SITE}/{CHAVE}.txt', 'urlList': urls[i:i + 10000]}).encode()
    req = urllib.request.Request('https://api.indexnow.org/indexnow', data=corpo, headers={'Content-Type': 'application/json; charset=utf-8'})
    try:
        r = urllib.request.urlopen(req, timeout=60); print(len(urls[i:i + 10000]), 'endereços enviados:', r.status)
    except urllib.error.HTTPError as x:
        print('IndexNow respondeu', x.code, x.read()[:200])
