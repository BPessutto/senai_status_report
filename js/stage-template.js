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
export function applyPorteHours(data, porte) {
  const horas = PORTE_HOURS[porte] || PORTE_HOURS.DEMAIS;
  const etapas = (data.etapas || []).map(e => ({
    ...e,
    prev: horas[e.id] != null ? horas[e.id] : e.prev
  }));
  return {
    ...data,
    etapas,
    totalPrevisto: etapas.reduce((sum, e) => sum + Number(e.prev || 0), 0)
  };
}

export function defaultState(porte = 'DEMAIS') {
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
