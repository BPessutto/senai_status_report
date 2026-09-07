// Controle de lançamentos SGSET sobre visitas realizadas. Não envia e-mail:
// gera texto padronizado pra copiar/baixar e, só depois de confirmação
// explícita, marca as visitas como encaminhadas. Compartilhado entre
// dashboard.html (ação individual por visita) e painel.html (lote semanal).
import { fmtDateBR } from './calendar-utils.js';
import { showActionPanel } from './action-panel.js';

// Visita antiga sem `sgset` (ou sem status 'enviado') conta como pendente —
// sem migração em massa, é só ausência de campo.
export function visitaSgsetPendente(v){
  return !v.sgset || v.sgset.status !== 'enviado';
}

function round2(n){ return Math.round(Number(n||0) * 100) / 100; }

// `participantes[]` já guarda um snapshot de nome (ver CLAUDE.md) — usamos
// direto, sem re-resolver. Só a visita antiga sem participantes precisa do
// fallback "owner_id = único participante", resolvido via nomeDoConsultorFn
// que cada página já tem pronta.
export function participantesDaVisitaParaTexto(v, ownerId, nomeDoConsultorFn){
  if (Array.isArray(v.participantes) && v.participantes.length) {
    return v.participantes.map(p => ({ nome: p.nome, horas: round2(p.horas) }));
  }
  return [{ nome: nomeDoConsultorFn(ownerId), horas: round2(v.horasNoDia) }];
}

function blocoVisitaTexto(visita){
  const linhasParticipantes = visita.participantes
    .map(p => `${p.nome} — ${p.horas}h`)
    .join('\n');
  const totalVisita = round2(visita.participantes.reduce((s,p) => s + p.horas, 0));
  const descritivo = Array.isArray(visita.resumo) ? visita.resumo.join('\n\n') : (visita.resumo || '');
  return [
    `VISITA — ${fmtDateBR(visita.dataISO)}`,
    '',
    'Descritivo:',
    descritivo,
    '',
    'HORAS PARA LANÇAMENTO',
    linhasParticipantes,
    '',
    `Total da visita: ${totalVisita}h`
  ].join('\n');
}

function blocoAssessoriaTexto(bloco){
  const cabecalho = [
    '='.repeat(60),
    `EMPRESA: ${bloco.clienteNome || '—'}`,
    `PROPOSTA: ${bloco.proposta || '—'}`,
    `PROJETO: ${bloco.projetoNome || '—'}${bloco.programa ? ' — ' + bloco.programa : ''}`,
    '='.repeat(60)
  ].join('\n');

  const visitasTexto = bloco.visitas.map(blocoVisitaTexto).join('\n\n\n');

  const horasSelecionadas = round2(bloco.visitas.reduce(
    (s, visita) => s + visita.participantes.reduce((s2,p) => s2 + p.horas, 0), 0
  ));
  const horasJaEncaminhadas = round2(bloco.horasJaEncaminhadas);
  const acumulado = round2(horasJaEncaminhadas + horasSelecionadas);
  const saldo = round2(bloco.totalPrevisto - acumulado);

  const resumo = [
    'RESUMO DA ASSESSORIA',
    '',
    `Horas já encaminhadas anteriormente: ${horasJaEncaminhadas}h`,
    `Horas para lançamento neste envio: ${horasSelecionadas}h`,
    `Acumulado após este envio: ${acumulado}h`,
    `Carga total da assessoria: ${round2(bloco.totalPrevisto)}h`,
    `Saldo após este envio: ${saldo}h`
  ].join('\n');

  return [cabecalho, '', visitasTexto, '', '', resumo].join('\n');
}

// blocos: [{ clienteNome, projetoNome, proposta, programa?, totalPrevisto,
//            horasJaEncaminhadas, visitas: [{ dataISO, resumo, participantes:[{nome,horas}] }] }]
// `programa` é opcional e nunca inferido — hoje nenhum chamador o passa;
// quando existir um campo semântico de programa (BP/MOVER), ele entra aqui
// sem mudar o resto do gerador.
export function buildSgsetTexto({ consultorNome, dataGeracao, blocos }){
  const assunto = `LANÇAMENTOS SGSET SEMANAL - ${consultorNome}${dataGeracao ? ' - ' + fmtDateBR(dataGeracao) : ''}`;
  const corpo = [
    'Olá,',
    '',
    'Segue abaixo o consolidado para lançamento no SGSET.',
    '',
    blocos.map(blocoAssessoriaTexto).join('\n\n\n')
  ].join('\n');
  return { assunto, corpo };
}

// ============================================================
// Painel de resultado: assunto + corpo pra copiar/baixar, e só depois de
// confirmação explícita, marcar como encaminhado. Não manda nada
// automaticamente — cópia/download nunca alteram status.
// Reaproveita a mesma linguagem visual do painel lateral (js/action-panel.js)
// sem depender dos internos dele (que só suporta formulário de campo único).
// ============================================================
let sgpInjected = false;
function ensureSgpStyles(){
  if (sgpInjected) return;
  sgpInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .sgp-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.28);z-index:100;opacity:0;transition:opacity .15s ease}
    .sgp-backdrop.open{opacity:1}
    .sgp-panel{position:fixed;top:0;right:0;height:100%;width:460px;max-width:94vw;background:var(--card,#fff);box-shadow:-10px 0 28px rgba(15,23,42,.2);z-index:101;transform:translateX(100%);transition:transform .18s ease;display:flex;flex-direction:column;font-family:"Segoe UI",Arial,sans-serif}
    .sgp-panel.open{transform:translateX(0)}
    .sgp-header{padding:18px 20px;border-bottom:1px solid var(--border,#e2e8f0);display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
    .sgp-title{font-size:14px;font-weight:800;color:var(--navy,#17365d);margin:0}
    .sgp-subtitle{font-size:12px;color:var(--muted,#64748b);margin-top:6px;white-space:pre-line;line-height:1.5}
    .sgp-close{border:0;background:none;font-size:20px;cursor:pointer;color:#94a3b8;line-height:1;padding:2px 4px;border-radius:6px}
    .sgp-close:hover{background:#f1f5f9;color:#475569}
    .sgp-body{padding:16px 20px;overflow-y:auto;flex:1}
    .sgp-field{display:flex;flex-direction:column;margin-bottom:14px}
    .sgp-field label{font-size:10px;color:var(--muted,#64748b);font-weight:800;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px}
    .sgp-field textarea, .sgp-field input{border:1px solid var(--border,#d9e2ec);border-radius:8px;padding:9px 10px;font-size:12.5px;font-family:inherit;box-sizing:border-box;width:100%;color:var(--text,#1f2937);background:#fbfcfe}
    .sgp-field textarea{resize:vertical;min-height:260px;white-space:pre-wrap;line-height:1.5}
    .sgp-copybar{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
    .sgp-actions{padding:16px 20px;border-top:1px solid var(--border,#e2e8f0);display:flex;flex-direction:column;gap:8px}
    .sgp-btn{border:0;border-radius:8px;padding:10px 14px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;text-align:center;transition:filter .12s ease}
    .sgp-btn:hover{filter:brightness(.96)}
    .sgp-btn-primary{background:var(--blue,#2f75b5);color:#fff}
    .sgp-btn-ghost{background:#eef1f5;color:var(--navy,#17365d)}
    .sgp-btn-sm{padding:7px 10px;font-size:11.5px}
    .sgp-done{padding:10px 12px;border-radius:8px;background:var(--greenbg,#e8f5e9);color:var(--green,#2e7d32);font-size:12.5px;font-weight:700;text-align:center}
    .sgp-grupo{margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--border,#e2e8f0)}
    .sgp-grupo:last-child{border-bottom:none;margin-bottom:0}
    .sgp-grupo-titulo{font-size:12.5px;font-weight:800;color:var(--navy,#17365d);margin-bottom:8px}
    .sgp-visita-linha{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 0;font-size:12.5px;color:var(--text,#1f2937)}
    .sgp-visita-linha label{display:flex;align-items:center;gap:8px;cursor:pointer}
    .sgp-visita-linha input[type="checkbox"]{width:15px;height:15px}
    .sgp-grupo-subtotal{margin-top:6px;font-size:11.5px;font-weight:700;color:var(--muted,#64748b)}
    .sgp-total-lote{font-size:12.5px;font-weight:800;color:var(--navy,#17365d);padding:10px 20px;border-top:1px solid var(--border,#e2e8f0)}
    .sgp-empty{font-size:12.5px;color:var(--muted,#64748b);text-align:center;padding:20px 0}
  `;
  document.head.appendChild(style);
}

// assunto/corpo carregam texto livre (descritivo da visita, nomes) — nunca
// confiar neles direto em innerHTML (textarea inclusive: é RCDATA, mas ainda
// precisa de escape pra "&"/"<" não quebrarem o parsing nem fechar a tag
// prematuramente se o texto contiver "</textarea>").
function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = String(str == null ? '' : str);
  return div.innerHTML;
}

async function copiarTexto(texto){
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch (e) {
    return false;
  }
}

function baixarTxt(nomeArquivo, conteudo){
  const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// { assunto, corpo, totalVisitas, totalHoras, onConfirmarEnvio }
// onConfirmarEnvio() é chamado (e aguardado) só depois da confirmação
// explícita do usuário — é ele quem efetivamente grava sgset:{status:'enviado',...}
// e recarrega a tela de quem chamou. Resolve quando o painel fecha.
export function showSgsetResultado({ assunto, corpo, totalVisitas, totalHoras, onConfirmarEnvio }){
  ensureSgpStyles();
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'sgp-backdrop';
    const panel = document.createElement('div');
    panel.className = 'sgp-panel';
    panel.innerHTML = `
      <div class="sgp-header">
        <div>
          <p class="sgp-title">Texto gerado para o SGSET</p>
          <div class="sgp-subtitle">${totalVisitas} visita(s) · ${totalHoras}h · nada é enviado automaticamente</div>
        </div>
        <button type="button" class="sgp-close" aria-label="Fechar">×</button>
      </div>
      <div class="sgp-body">
        <div class="sgp-field">
          <label>Assunto</label>
          <textarea readonly rows="2" data-sgp="assunto">${escapeHtml(assunto)}</textarea>
          <div class="sgp-copybar">
            <button type="button" class="sgp-btn sgp-btn-ghost sgp-btn-sm" data-sgp-copiar="assunto">Copiar assunto</button>
          </div>
        </div>
        <div class="sgp-field">
          <label>Corpo do e-mail</label>
          <textarea readonly data-sgp="corpo">${escapeHtml(corpo)}</textarea>
          <div class="sgp-copybar">
            <button type="button" class="sgp-btn sgp-btn-ghost sgp-btn-sm" data-sgp-copiar="corpo">Copiar texto completo</button>
            <button type="button" class="sgp-btn sgp-btn-ghost sgp-btn-sm" data-sgp-baixar>Baixar .TXT</button>
          </div>
        </div>
        <div id="sgp-resultado-copia" class="sgp-subtitle" style="min-height:16px"></div>
      </div>
      <div class="sgp-actions">
        <button type="button" class="sgp-btn sgp-btn-primary" data-sgp-marcar>Marcar visitas selecionadas como encaminhadas ao SGSET</button>
        <button type="button" class="sgp-btn sgp-btn-ghost" data-sgp-fechar>Fechar</button>
      </div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
    requestAnimationFrame(() => { backdrop.classList.add('open'); panel.classList.add('open'); });

    let done = false;
    function close(){
      if (done) return;
      done = true;
      document.removeEventListener('keydown', escHandler);
      backdrop.classList.remove('open');
      panel.classList.remove('open');
      setTimeout(() => { backdrop.remove(); panel.remove(); }, 180);
      resolve();
    }
    function escHandler(e){ if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', escHandler);
    backdrop.addEventListener('click', close);
    panel.querySelector('.sgp-close').addEventListener('click', close);
    panel.querySelector('[data-sgp-fechar]').addEventListener('click', close);

    const avisoCopia = panel.querySelector('#sgp-resultado-copia');
    panel.querySelectorAll('[data-sgp-copiar]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const campo = btn.dataset.sgpCopiar;
        const texto = campo === 'assunto' ? assunto : corpo;
        const ok = await copiarTexto(texto);
        avisoCopia.textContent = ok ? 'Copiado.' : 'Não foi possível copiar automaticamente — selecione o texto e copie manualmente.';
      });
    });
    panel.querySelector('[data-sgp-baixar]').addEventListener('click', () => {
      baixarTxt(`sgset-${new Date().toISOString().slice(0,10)}.txt`, `${assunto}\n\n${corpo}`);
    });

    panel.querySelector('[data-sgp-marcar]').addEventListener('click', async () => {
      const confirmado = await showActionPanel({
        title: 'Confirmar envio ao SGSET',
        subtitle: `Confirmar que estas ${totalVisitas} visita(s), totalizando ${totalHoras}h, foram encaminhadas para lançamento no SGSET?`,
        actions: [
          { label:'Confirmar', style:'primary', value:'sim' },
          { label:'Cancelar', style:'ghost', value:'nao' }
        ]
      });
      if (!confirmado || confirmado.action !== 'sim') return;
      await onConfirmarEnvio();
      panel.querySelector('.sgp-actions').innerHTML = '<div class="sgp-done">✓ Marcado como encaminhado ao SGSET.</div>';
      setTimeout(close, 900);
    });
  });
}

// ============================================================
// Painel de seleção do lote semanal: lista, por grupo (normalmente uma
// assessoria), as visitas pendentes com checkbox + subtotal ao vivo. Todas
// vêm pré-marcadas. "Gerar texto" devolve só o que ficou marcado — grupo sem
// nenhuma visita marcada é tratado como excluído do lote.
// grupos: [{ id, titulo, visitas: [{ id, dataISO, horas, resumo }] }]
// onGerar({ totalVisitas, totalHoras, porGrupo: [{ grupoId, visitaIds }] })
// ============================================================
export function showSgsetSelecao({ titulo, subtitulo, grupos, onGerar }){
  ensureSgpStyles();
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'sgp-backdrop';
    const panel = document.createElement('div');
    panel.className = 'sgp-panel';

    const gruposHtml = grupos.length ? grupos.map(g => `
      <div class="sgp-grupo" data-sgp-grupo="${g.id}">
        <div class="sgp-grupo-titulo">${g.titulo}</div>
        ${g.visitas.map(v => `
          <div class="sgp-visita-linha">
            <label>
              <input type="checkbox" checked data-sgp-visita data-grupo="${g.id}" data-visita="${v.id}" data-horas="${v.horas}">
              ${fmtDateBR(v.dataISO)} · ${v.horas}h
            </label>
          </div>
        `).join('')}
        <div class="sgp-grupo-subtotal" data-sgp-subtotal="${g.id}"></div>
      </div>
    `).join('') : `<div class="sgp-empty">Nenhuma visita realizada pendente de SGSET no momento.</div>`;

    panel.innerHTML = `
      <div class="sgp-header">
        <div>
          <p class="sgp-title">${titulo || 'Lançamentos SGSET'}</p>
          ${subtitulo ? `<div class="sgp-subtitle">${subtitulo}</div>` : ''}
        </div>
        <button type="button" class="sgp-close" aria-label="Fechar">×</button>
      </div>
      <div class="sgp-body">${gruposHtml}</div>
      <div class="sgp-total-lote" data-sgp-total-lote></div>
      <div class="sgp-actions">
        <button type="button" class="sgp-btn sgp-btn-primary" data-sgp-gerar ${grupos.length ? '' : 'disabled'}>Gerar texto</button>
        <button type="button" class="sgp-btn sgp-btn-ghost" data-sgp-fechar>Fechar</button>
      </div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
    requestAnimationFrame(() => { backdrop.classList.add('open'); panel.classList.add('open'); });

    function atualizarTotais(){
      let totalGeral = 0;
      grupos.forEach(g => {
        let subtotal = 0;
        panel.querySelectorAll(`[data-sgp-visita][data-grupo="${g.id}"]`).forEach(chk => {
          if (chk.checked) subtotal += Number(chk.dataset.horas || 0);
        });
        const subtotalEl = panel.querySelector(`[data-sgp-subtotal="${g.id}"]`);
        if (subtotalEl) subtotalEl.textContent = `${subtotal}h selecionadas`;
        totalGeral += subtotal;
      });
      const totalCheckboxes = panel.querySelectorAll('[data-sgp-visita]:checked').length;
      const totalLoteEl = panel.querySelector('[data-sgp-total-lote]');
      if (totalLoteEl) totalLoteEl.textContent = `Total do lote: ${totalCheckboxes} visita(s) · ${totalGeral}h`;
    }
    atualizarTotais();
    panel.querySelectorAll('[data-sgp-visita]').forEach(chk => chk.addEventListener('change', atualizarTotais));

    let done = false;
    function close(){
      if (done) return;
      done = true;
      document.removeEventListener('keydown', escHandler);
      backdrop.classList.remove('open');
      panel.classList.remove('open');
      setTimeout(() => { backdrop.remove(); panel.remove(); }, 180);
      resolve();
    }
    function escHandler(e){ if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', escHandler);
    backdrop.addEventListener('click', close);
    panel.querySelector('.sgp-close').addEventListener('click', close);
    panel.querySelector('[data-sgp-fechar]').addEventListener('click', close);

    const btnGerar = panel.querySelector('[data-sgp-gerar]');
    if (btnGerar) btnGerar.addEventListener('click', async () => {
      const porGrupo = grupos.map(g => ({
        grupoId: g.id,
        visitaIds: Array.from(panel.querySelectorAll(`[data-sgp-visita][data-grupo="${g.id}"]:checked`)).map(chk => chk.dataset.visita)
      })).filter(g => g.visitaIds.length);
      if (!porGrupo.length) { return; }
      const totalVisitas = porGrupo.reduce((s,g) => s + g.visitaIds.length, 0);
      const totalHoras = Array.from(panel.querySelectorAll('[data-sgp-visita]:checked')).reduce((s,chk) => s + Number(chk.dataset.horas||0), 0);
      close();
      await onGerar({ totalVisitas, totalHoras, porGrupo });
    });
  });
}
