/* Classificação editorial dos partidos em esquerda / centro / direita e sucessão de siglas.
   Baseada no posicionamento usual em levantamentos acadêmicos e na imprensa; é uma simplificação
   e pode ser ajustada aqui sem mexer no resto do site. */
const ESPECTRO = {
  esquerda: ['PT', 'PSOL', 'PCDOB', 'PC DO B', 'PSB', 'PDT', 'REDE', 'PV', 'PSTU', 'PCO', 'PCB', 'UP', 'PPL'],
  centro: ['MDB', 'PMDB', 'PSD', 'PSDB', 'CIDADANIA', 'PPS', 'SOLIDARIEDADE', 'SD', 'AVANTE', 'PT DO B', 'PODE', 'PTN',
    'AGIR', 'PTC', 'MOBILIZA', 'PMN', 'PMB', 'PROS', 'PHS', 'PRP', 'PSDC'],
  direita: ['PL', 'PR', 'PP', 'PPB', 'REPUBLICANOS', 'PRB', 'UNIÃO', 'UNIAO', 'DEM', 'PFL', 'PSL', 'NOVO', 'PRD', 'PTB',
    'PATRIOTA', 'PATRI', 'PEN', 'DC', 'PRTB', 'PSC', 'MISSÃO', 'MISSAO', 'DEMOCRATA'],
};
const LADO_COR = { esquerda: '#e5383b', centro: '#3d7bf0', direita: '#22a85a' };
const LADO_NM = { esquerda: 'Esquerda', centro: 'Centro', direita: 'Direita' };
const ORDEM_LADO = ['esquerda', 'centro', 'direita'];
const _ladoDe = new Map();
for (const l of ORDEM_LADO) for (const p of ESPECTRO[l]) _ladoDe.set(p, l);
function lado(sg) { return _ladoDe.get(String(sg || '').toUpperCase().trim()) || 'centro'; }

// sigla antiga -> partido atual (fusões, incorporações e trocas de nome), para comparar entre eleições
const SUCESSOR = {
  PMDB: 'MDB', PR: 'PL', PRB: 'REPUBLICANOS', PPS: 'CIDADANIA', DEM: 'UNIÃO', PSL: 'UNIÃO', PTN: 'PODE', 'PT DO B': 'AVANTE',
  PEN: 'PRD', PATRI: 'PRD', PATRIOTA: 'PRD', PTB: 'PRD', PROS: 'SOLIDARIEDADE', SD: 'SOLIDARIEDADE', PHS: 'PODE', PSC: 'PODE',
  PRP: 'PRD', PPL: 'PCdoB', 'PC DO B': 'PCdoB', PCDOB: 'PCdoB', PSDC: 'DC', PTC: 'AGIR', PPB: 'PP', PFL: 'UNIÃO',
};
function atual(sg) { const s = String(sg || '').toUpperCase().trim(); return SUCESSOR[s] || sg; }
