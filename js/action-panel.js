// Painel lateral leve para substituir confirm()/prompt() do navegador nas ações
// de clique no calendário. Sem dependências — injeta seu próprio CSS uma vez.
let injected = false;

function ensureStyles(){
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.textContent = `
    .ap-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.28);z-index:100;opacity:0;transition:opacity .15s ease}
    .ap-backdrop.open{opacity:1}
    .ap-panel{position:fixed;top:0;right:0;height:100%;width:340px;max-width:92vw;background:#fff;box-shadow:-10px 0 28px rgba(15,23,42,.2);z-index:101;transform:translateX(100%);transition:transform .18s ease;display:flex;flex-direction:column;font-family:"Segoe UI",Arial,sans-serif}
    .ap-panel.open{transform:translateX(0)}
    .ap-header{padding:18px 20px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
    .ap-title{font-size:14px;font-weight:800;color:#17365d;margin:0}
    .ap-subtitle{font-size:12px;color:#64748b;margin-top:6px;white-space:pre-line;line-height:1.5}
    .ap-close{border:0;background:none;font-size:20px;cursor:pointer;color:#94a3b8;line-height:1;padding:2px 4px;border-radius:6px}
    .ap-close:hover{background:#f1f5f9;color:#475569}
    .ap-body{padding:16px 20px;overflow-y:auto;flex:1}
    .ap-field{display:flex;flex-direction:column;margin-bottom:14px}
    .ap-field label{font-size:10px;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px}
    .ap-field input{border:1px solid #d9e2ec;border-radius:8px;padding:9px 10px;font-size:13px;font-family:inherit;box-sizing:border-box;width:100%}
    .ap-field input:focus{outline:none;border-color:#2f75b5;box-shadow:0 0 0 3px rgba(47,117,181,.12)}
    .ap-actions{padding:16px 20px;border-top:1px solid #e2e8f0;display:flex;flex-direction:column;gap:8px}
    .ap-note{padding:16px 20px;border-top:1px solid #e2e8f0}
    .ap-btn{border:0;border-radius:8px;padding:11px 14px;font-weight:700;font-size:12.5px;cursor:pointer;font-family:inherit;text-align:center;transition:filter .12s ease}
    .ap-btn:hover{filter:brightness(.96)}
    .ap-btn-primary{background:#2f75b5;color:#fff}
    .ap-btn-danger{background:#b42318;color:#fff}
    .ap-btn-ghost{background:#eef1f5;color:#17365d}
  `;
  document.head.appendChild(style);
}

// options: { title, subtitle, fields:[{id,label,type,value,placeholder}], actions:[{label,style,value}], note }
// "note" é um bloco de HTML livre, mostrado depois dos botões de ação (ex.: um resumo informativo).
// Resolve com { action, values } quando um botão é clicado, ou null se fechado sem escolher.
export function showActionPanel({ title, subtitle, fields = [], actions = [], note = '' }){
  ensureStyles();
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'ap-backdrop';
    const panel = document.createElement('div');
    panel.className = 'ap-panel';

    const fieldsHtml = fields.map(f => `
      <div class="ap-field">
        <label for="ap-${f.id}">${f.label}</label>
        <input id="ap-${f.id}" type="${f.type || 'text'}" value="${f.value != null ? String(f.value).replace(/"/g,'&quot;') : ''}" placeholder="${f.placeholder || ''}">
      </div>
    `).join('');

    panel.innerHTML = `
      <div class="ap-header">
        <div>
          <p class="ap-title">${title}</p>
          ${subtitle ? `<div class="ap-subtitle">${subtitle}</div>` : ''}
        </div>
        <button type="button" class="ap-close" aria-label="Fechar">×</button>
      </div>
      ${fields.length ? `<div class="ap-body">${fieldsHtml}</div>` : ''}
      <div class="ap-actions">${actions.map((a,i) => `<button type="button" class="ap-btn ap-btn-${a.style||'ghost'}" data-action-idx="${i}">${a.label}</button>`).join('')}</div>
      ${note ? `<div class="ap-note">${note}</div>` : ''}
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
    requestAnimationFrame(() => { backdrop.classList.add('open'); panel.classList.add('open'); });

    let done = false;
    function close(result){
      if (done) return;
      done = true;
      document.removeEventListener('keydown', escHandler);
      backdrop.classList.remove('open');
      panel.classList.remove('open');
      setTimeout(() => { backdrop.remove(); panel.remove(); }, 180);
      resolve(result);
    }

    function escHandler(e){ if (e.key === 'Escape') close(null); }
    document.addEventListener('keydown', escHandler);

    backdrop.addEventListener('click', () => close(null));
    panel.querySelector('.ap-close').addEventListener('click', () => close(null));

    panel.querySelectorAll('[data-action-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const values = {};
        fields.forEach(f => { values[f.id] = document.getElementById(`ap-${f.id}`).value; });
        const action = actions[Number(btn.dataset.actionIdx)];
        close({ action: action.value != null ? action.value : action.label, values });
      });
    });

    const firstInput = panel.querySelector('input');
    if (firstInput) { firstInput.focus(); firstInput.select(); }
  });
}
