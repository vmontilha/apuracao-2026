# Apuração 2026 · do Brasil à urna

Site estático com os resultados das Eleições 2026 (TSE), do país até a seção eleitoral.

- **Mapa** (`index.html`): região → estado → cidade → zona → seção, para presidente, governador, senador e deputados.
  Escolha um candidato e veja os votos por cidade, zona e seção, com comparação com 2022, 2018 ou 2014.
- **Congresso**: Câmara, Senado e Assembleias em hemiciclo (esquerda, centro e direita).
- **Partidos**: votos e eleitos por partido e por campo político de 2014 a 2026.
- **Histórico**: resultados de 2014 a 2026 por estado e a trajetória de cada político.
- **Painel** (`painel.html`): acompanhamento da apuração com cálculo próprio das cadeiras.

## Dados
- Ao vivo: `resultados.tse.jus.br` (lido direto pelo navegador).
- Boletins de urna: `resultados.tse.jus.br/oficial/ele2026/arquivo-urna/...` (decodificados no navegador).
- Histórico e zonas: Dados Abertos do TSE (`votacao_candidato_munzona_<ano>.zip`), convertidos em `hist/`, `zona/` e `resumo/`.
- Mapas: malhas do IBGE, já projetadas em `geo/`.

A classificação dos partidos em esquerda, centro e direita fica em `js/espectro.js` e é editorial.
