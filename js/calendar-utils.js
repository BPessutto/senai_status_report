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

// Soma (ou subtrai) dias a uma data ISO ("AAAA-MM-DD"), em UTC pra nunca sofrer
// deslocamento de um dia por causa de fuso horário.
export function addDaysISO(iso, days){
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

// Diferença em dias entre duas datas ISO (toIso - fromIso).
export function diffDaysISO(fromIso, toIso){
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000);
}

// Paleta estável por índice, usada para colorir cada assessoria no calendário consolidado.
export const ASSESSORIA_PALETTE = ['#2f75b5','#c2410c','#15803d','#7c3aed','#be185d','#0891b2','#a16207','#4338ca'];
export function colorForIndex(i){ return ASSESSORIA_PALETTE[i % ASSESSORIA_PALETTE.length]; }

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), em UTC pra nunca sofrer
// deslocamento de um dia por causa de fuso horário.
function easterSundayUTC(year){
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19*a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2*e + 2*i - h - k) % 7;
  const m = Math.floor((a + 11*h + 22*l) / 451);
  const month = Math.floor((h + l - 7*m + 114) / 31);
  const day = ((h + l - 7*m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}
function addDaysUTC(date, days){
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
function isoUTC(date){ return date.toISOString().slice(0,10); }

const nationalHolidaysCache = new Map();

// Feriados nacionais fixos + móveis (baseados na Páscoa) para um ano. Calculado, não
// depende de internet nem de nenhuma lista mantida à mão.
export function nationalHolidays(year){
  if (nationalHolidaysCache.has(year)) return nationalHolidaysCache.get(year);
  const easter = easterSundayUTC(year);
  const fixos = [
    [`${year}-01-01`, 'Confraternização Universal'],
    [`${year}-04-21`, 'Tiradentes'],
    [`${year}-05-01`, 'Dia do Trabalho'],
    [`${year}-09-07`, 'Independência do Brasil'],
    [`${year}-10-12`, 'Nossa Senhora Aparecida'],
    [`${year}-11-02`, 'Finados'],
    [`${year}-11-15`, 'Proclamação da República'],
    [`${year}-11-20`, 'Consciência Negra'],
    [`${year}-12-25`, 'Natal'],
  ];
  const moveis = [
    [isoUTC(addDaysUTC(easter, -48)), 'Carnaval (segunda-feira)'],
    [isoUTC(addDaysUTC(easter, -47)), 'Carnaval (terça-feira)'],
    [isoUTC(addDaysUTC(easter, -2)), 'Sexta-feira Santa'],
    [isoUTC(addDaysUTC(easter, 60)), 'Corpus Christi'],
  ];
  const lista = [...fixos, ...moveis].map(([dataISO, nome]) => ({ dataISO, nome }));
  nationalHolidaysCache.set(year, lista);
  return lista;
}

// Mapa dataISO -> nome do feriado nacional, para os anos indicados.
export function nationalHolidayMap(years){
  const map = new Map();
  for (const year of years) {
    for (const { dataISO, nome } of nationalHolidays(year)) map.set(dataISO, nome);
  }
  return map;
}
