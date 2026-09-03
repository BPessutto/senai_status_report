export const WEEKDAY_LABELS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
export const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export function todayISO(){ return new Date().toISOString().slice(0,10); }

export function fmtDateBR(iso){
  if(!iso) return '—';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function buildMonthGrid(year, month){
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const cells = [];
  for(let i=0;i<startWeekday;i++) cells.push(null);
  for(let d=1; d<=daysInMonth; d++) cells.push(d);
  while(cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// Converte "DD/MM/AAAA" em "AAAA-MM-DD", validando se a data existe de fato.
export function parseBRDateToISO(str){
  const m = String(str || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(!m) return null;
  const [, d, mo, y] = m;
  const dd = d.padStart(2,'0'), mm = mo.padStart(2,'0');
  const iso = `${y}-${mm}-${dd}`;
  const dt = new Date(iso + 'T00:00:00');
  if(dt.getFullYear() !== Number(y) || (dt.getMonth()+1) !== Number(mm) || dt.getDate() !== Number(dd)) return null;
  return iso;
}

// Paleta estável por índice, usada para colorir cada assessoria no calendário consolidado.
export const ASSESSORIA_PALETTE = ['#2f75b5','#c2410c','#15803d','#7c3aed','#be185d','#0891b2','#a16207','#4338ca'];
export function colorForIndex(i){ return ASSESSORIA_PALETTE[i % ASSESSORIA_PALETTE.length]; }
