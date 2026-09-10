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
// Para uma fase já concluída (horas reais >= previstas), acha a data da visita
// que fechou a conta - assim a fase concluída continua mostrando "quando",
// em vez de simplesmente não ter mais data nenhuma pra exibir.
function dataConclusaoRealizada(visitas, etapa){
  let acumulado = 0;
  for (const v of visitas) {
    const snap = v.etapaSnapshots && v.etapaSnapshots[etapa.id];
    const horas = snap ? Number(snap.horas || 0) : 0;
    if (horas > 0) {
      acumulado = Math.round((acumulado + horas) * 100) / 100;
      if (acumulado >= etapa.prev) return v.dataISO;
    }
  }
  return null;
}

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
      porFase.push({ etapaId: etapa.id, status: 'concluida', dataPrevista: dataConclusaoRealizada(state.visitas, etapa) });
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

// ============================================================
// Programa MOVER Hands-On — ETAPA 1 (fundação estrutural).
// ============================================================
// Config central por programa/modalidade, pra não espalhar as horas de cada
// fase e as cargas contratadas em vários arquivos. BP aqui só referencia as
// constantes que já existem acima (não duplica STAGE_DEFINITIONS/PORTE_HOURS)
// — serve como um único ponto de consulta "programa -> config" pro gestor e
// relatórios filtrarem/agruparem por programa no futuro.
export const PROGRAM_CONFIG = {
  BP: {
    prazoDias: { apontamento: PRAZO_APONTAMENTO_DIAS, encerramento: PRAZO_ENCERRAMENTO_DIAS }
  },
  MOVER: {
    modalidades: {
      200: {
        totalPrevisto: 200,
        etapas: [
          { id: 'F01', curto: 'Fase 01', nome: 'Fase 01 — Diagnóstico', prev: 35 },
          { id: 'F02', curto: 'Fase 02', nome: 'Fase 02 — Implementação', prev: 120 },
          { id: 'F03', curto: 'Fase 03', nome: 'Fase 03 — Resultados', prev: 30 },
          { id: 'F04', curto: 'Fase 04', nome: 'Fase 04 — Encerramento', prev: 15 }
        ]
      },
      400: {
        totalPrevisto: 400,
        etapas: [
          { id: 'F01', curto: 'Fase 01', nome: 'Fase 01 — Diagnóstico', prev: 70 },
          { id: 'F02', curto: 'Fase 02', nome: 'Fase 02 — Implementação', prev: 240 },
          { id: 'F03', curto: 'Fase 03', nome: 'Fase 03 — Resultados', prev: 60 },
          { id: 'F04', curto: 'Fase 04', nome: 'Fase 04 — Encerramento', prev: 30 }
        ]
      },
      600: {
        totalPrevisto: 600,
        etapas: [
          { id: 'F01', curto: 'Fase 01', nome: 'Fase 01 — Diagnóstico', prev: 105 },
          { id: 'F02', curto: 'Fase 02', nome: 'Fase 02 — Implementação', prev: 360 },
          { id: 'F03', curto: 'Fase 03', nome: 'Fase 03 — Resultados', prev: 90 },
          { id: 'F04', curto: 'Fase 04', nome: 'Fase 04 — Encerramento', prev: 45 }
        ]
      }
    }
  }
};

// IDs próprios (F01-F04, não T1-T4) de propósito: garante que nenhuma regra
// específica do B+P amarrada aos IDs T1-T4 (ex.: a interação especial da
// Fase 02 em dashboard.html) dispare sem querer numa assessoria MOVER.
// Sem entregáveis nesta etapa (ver CLAUDE.md/plano da ETAPA 1) — conclusão
// automática de fase (aplicarConclusaoAutomatica/etapaConcluidaEfetiva) já
// trata lista vazia como "obrigatórios cumpridos" e passa a depender só de
// horas, sem precisar de nenhum ajuste nessas funções.
//
// carga_contratada inválida nunca deve cair de volta no B+P silenciosamente
// (regra explícita da ETAPA 1) — por isso essa função lança erro em vez de
// devolver algo parecido com STAGE_DEFINITIONS. null/undefined é o único
// valor não-numérico aceito: representa "MOVER ainda não configurado"
// (ETAPA 2 — a carga é escolhida depois, dentro da própria assessoria), e
// não passa pelo throw abaixo.
export function defaultStateMover(cargaContratada) {
  const naoConfigurado = cargaContratada === null || cargaContratada === undefined;
  const modalidade = naoConfigurado ? null : PROGRAM_CONFIG.MOVER.modalidades[cargaContratada];
  if (!naoConfigurado && !modalidade) {
    throw new Error(`Modalidade MOVER inválida: ${cargaContratada}. Valores aceitos: 200, 400, 600.`);
  }
  // Ids/nomes/curto de fase são idênticos nas três modalidades — pra "ainda
  // não configurado" usamos a 200 só como fonte desses campos, nunca das
  // horas (prev sai 0 em todas as fases quando naoConfigurado).
  const etapasBase = (modalidade || PROGRAM_CONFIG.MOVER.modalidades[200]).etapas;
  const etapas = etapasBase.map(def => ({
    id: def.id,
    curto: def.curto,
    nome: def.nome,
    prev: naoConfigurado ? 0 : def.prev,
    real: 0,
    status: 'Não iniciado',
    entregaveis: []
  }));
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    totalPrevisto: naoConfigurado ? 0 : modalidade.totalPrevisto,
    etapas,
    visitas: [],
    visitasPlanejadas: [],
    printSettings: { includeDeliverables: false }
  };
}
