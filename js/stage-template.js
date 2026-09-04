// Modelo padrão de fases e entregáveis usado em toda nova assessoria.
// Mantido igual ao Dashboard Projeto B+P — VR Painéis original.
export const PROJECT_SCHEMA_VERSION = 5;

export const STAGE_DEFINITIONS = [
  {
    id: 'T1', curto: 'Fase 01', nome: 'Fase 01 — Diagnóstico', prev: 20,
    entregaveis: [
      { id: 'T1-D1', item: '3.1', label: 'Descrição do Processo Produtivo', required: true, done: false },
      { id: 'T1-D2', item: '3.2', label: 'MFV — Estado Presente', required: true, done: false },
      { id: 'T1-D3', item: '3.3', label: 'Gerenciamento Diário', required: true, done: false },
      { id: 'T1-D4', item: '3.4', label: 'Medição Inicial — PHH', required: true, done: false },
      { id: 'T1-D5', item: '3.5', label: 'Fotos dos principais desperdícios', required: true, done: false }
    ]
  },
  {
    id: 'T2', curto: 'Fase 02', nome: 'Fase 02 — Implementação', prev: 70,
    entregaveis: [
      { id: 'T2-D1', item: '', label: 'MFV — Estado Futuro', required: true, note: 'Obrigatório para empresas DEMAIS; opcional para ME e EPP.', done: false },
      { id: 'T2-D2', item: '', label: 'Plano de Ação', required: true, done: false },
      { id: 'T2-F1', item: '3.8.1', label: 'MFV — Mapeamento do Fluxo de Valor', required: true, tool: true, locked: true, done: false },
      { id: 'T2-F2', item: '3.8.2', label: 'GD — Gerenciamento Diário', required: true, tool: true, locked: true, done: false }
    ]
  },
  {
    id: 'T3', curto: 'Fase 03', nome: 'Fase 03 — Resultados', prev: 18,
    entregaveis: [
      { id: 'T3-D1', item: '', label: 'Medição Final', required: true, done: false },
      { id: 'T3-D2', item: '', label: 'Cálculo do retorno financeiro', required: true, done: false },
      { id: 'T3-D3', item: '', label: 'Análise dos indicadores', required: true, done: false },
      { id: 'T3-D4', item: '', label: 'Análise do retorno do programa', required: true, done: false },
      { id: 'T3-D5', item: '', label: 'Conclusão', required: true, done: false }
    ]
  },
  {
    id: 'T4', curto: 'Fase 04', nome: 'Fase 04 — Encerramento', prev: 8,
    entregaveis: [
      { id: 'T4-D1', item: '', label: 'Coleta de assinaturas', required: true, done: false }
    ]
  }
];

// Carga horária de cada fase, conforme o porte da empresa (regra de negócio do B+P).
export const PORTE_HOURS = {
  ME:     { T1: 16, T2: 40, T3: 16, T4: 4 },
  EPP:    { T1: 16, T2: 64, T3: 18, T4: 8 },
  DEMAIS: { T1: 20, T2: 70, T3: 18, T4: 8 }
};

export const PORTE_LABELS = {
  ME: 'ME — Microempresa (76h)',
  EPP: 'EPP — Empresa de Pequeno Porte (106h)',
  DEMAIS: 'Demais portes (116h)'
};

// Reaplica a carga horária prevista de cada fase conforme o porte, sem tocar
// em entregáveis, visitas ou horas já realizadas. Usado na criação e também
// se o consultor corrigir o porte de uma assessoria já existente.
// Sem porte definido (null/vazio), zera a carga prevista em vez de "chutar"
// DEMAIS por baixo do pano — o consultor precisa escolher o porte de propósito.
export function applyPorteHours(data, porte) {
  const horas = PORTE_HOURS[porte] || null;
  const etapas = (data.etapas || []).map(e => ({
    ...e,
    prev: horas ? (horas[e.id] != null ? horas[e.id] : e.prev) : 0
  }));
  return {
    ...data,
    etapas,
    totalPrevisto: etapas.reduce((sum, e) => sum + Number(e.prev || 0), 0)
  };
}

// Prazos do B+P (regra de negócio), contados a partir do 1º apontamento de
// horas. Compartilhado entre o painel da assessoria e o painel gerencial.
export const PRAZO_APONTAMENTO_DIAS = 60;
export const PRAZO_ENCERRAMENTO_DIAS = 115; // 16 semanas (115 dias corridos)

// Percorre as visitas planejadas (ainda não realizadas) em ordem cronológica e vai
// "consumindo" as horas restantes de cada fase, na ordem das fases. Isso da, ao mesmo
// tempo: (a) uma previsão aproximada de quando cada fase deve terminar, e (b) qual fase
// cada visita planejada tende a avançar - sem precisar que o consultor marque a fase na
// hora de planejar.
export function computeFasePrevisoes(state){
  const realizadas = new Set(state.visitas.map(v => v.dataISO));
  const pendentes = state.visitasPlanejadas
    .filter(p => !realizadas.has(p.dataISO))
    .sort((a,b) => a.dataISO.localeCompare(b.dataISO));

  const porFase = [];
  const tagPorData = {};
  let idx = 0;
  let usadoNaEntradaAtual = 0;

  for (const etapa of state.etapas) {
    let faltam = Math.max(0, Math.round((etapa.prev - etapa.real) * 100) / 100);
    if (faltam <= 0) {
      porFase.push({ etapaId: etapa.id, status: 'concluida', dataPrevista: null });
      continue;
    }
    let dataPrevista = null;
    while (faltam > 0 && idx < pendentes.length) {
      const entrada = pendentes[idx];
      if (tagPorData[entrada.dataISO] === undefined) tagPorData[entrada.dataISO] = etapa.id;
      const disponivel = Number(entrada.horas) - usadoNaEntradaAtual;
      if (disponivel <= faltam + 0.001) {
        faltam = Math.round((faltam - disponivel) * 100) / 100;
        usadoNaEntradaAtual = 0;
        dataPrevista = entrada.dataISO;
        idx++;
      } else {
        usadoNaEntradaAtual += faltam;
        dataPrevista = entrada.dataISO;
        faltam = 0;
      }
    }
    porFase.push({ etapaId: etapa.id, status: faltam > 0 ? 'insuficiente' : 'estimada', dataPrevista });
  }
  return { porFase, tagPorData };
}

export function defaultState(porte = null) {
  const etapas = STAGE_DEFINITIONS.map(def => ({
    id: def.id,
    curto: def.curto,
    nome: def.nome,
    prev: def.prev,
    real: 0,
    status: 'Não iniciado',
    entregaveis: def.entregaveis.map(d => {
      const item = { ...d, locked: false, done: false };
      // MFV Estado Futuro é obrigatório só para "DEMAIS"; opcional para ME e EPP.
      if (d.id === 'T2-D1') item.required = (porte === 'DEMAIS');
      return item;
    })
  }));
  const base = {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    totalPrevisto: etapas.reduce((sum, e) => sum + Number(e.prev || 0), 0),
    etapas,
    visitas: [],
    visitasPlanejadas: [],
    printSettings: { includeDeliverables: false }
  };
  return applyPorteHours(base, porte);
}
