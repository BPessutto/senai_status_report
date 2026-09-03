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

export function defaultState() {
  const etapas = STAGE_DEFINITIONS.map(def => ({
    id: def.id,
    curto: def.curto,
    nome: def.nome,
    prev: def.prev,
    real: 0,
    status: 'Não iniciado',
    entregaveis: def.entregaveis.map(d => ({ ...d, locked: false, done: false }))
  }));
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    totalPrevisto: etapas.reduce((sum, e) => sum + Number(e.prev || 0), 0),
    etapas,
    visitas: [],
    printSettings: { includeDeliverables: false }
  };
}
