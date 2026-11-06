import type { HouseView, Request, Response, Session, Task } from '../api/_lib/house';

export type { HouseView, Session, Task };
export type Screen = 'welcome' | 'create' | 'join' | 'tasks' | 'members';
export type Filter = 'all' | 'mine' | 'done';

/* ---------- API ---------- */

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api(req: Request): Promise<Extract<Response, { ok: true }>> {
  let res: globalThis.Response;
  try {
    res = await fetch('/api/lar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
    });
  } catch {
    throw new ApiError(0, 'Sem conexão. Verifique a internet.');
  }
  const data = (await res.json().catch(() => null)) as Response | null;
  if (!data) throw new ApiError(res.status, 'Resposta inválida do servidor.');
  if (!data.ok) throw new ApiError(data.status ?? res.status, data.error);
  return data;
}

/* ---------- sessão salva neste aparelho ---------- */

const SESSION_KEY = 'lar:session:v1';

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* sem armazenamento: a sessão dura só enquanto a página estiver aberta */
  }
}

/* ---------- derivados ---------- */

const PALETTE = [
  { bg: '#DCE8E0', fg: '#24513C' },
  { bg: '#F3E3CF', fg: '#7A4A12' },
  { bg: '#DDE3F0', fg: '#2C3F6B' },
  { bg: '#EEDDE6', fg: '#6B2C4C' },
  { bg: '#E6E4DC', fg: '#4A4943' },
];

export interface AvatarInfo { bg: string; fg: string; initial: string }

export function avatarFor(v: HouseView, id: string | null): AvatarInfo {
  const i = id ? v.members.findIndex((m) => m.id === id) : -1;
  if (i < 0) return { bg: '#E6E4DC', fg: '#4A4943', initial: '·' };
  return { ...PALETTE[i % PALETTE.length], initial: v.members[i].name.charAt(0).toUpperCase() };
}

export function nameOf(v: HouseView, id: string | null): string {
  if (!id) return 'Qualquer um';
  if (id === v.meId) return 'Você';
  return v.members.find((m) => m.id === id)?.name ?? 'Ex-membro';
}

export function isAdmin(v: HouseView): boolean {
  return v.members.find((m) => m.id === v.meId)?.role === 'admin';
}

/* ---------- agenda ---------- */


const WEEKDAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const WEEKDAY_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Ordem dos dias para escolher repetição: segunda primeiro. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const weekdayShort = (d: number) => WEEKDAY_SHORT[d];

/** Data local como 'AAAA-MM-DD'. */
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "quarta, 11 nov" */
export function longDate(d: Date): string {
  return `${WEEKDAY_LONG[d.getDay()]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

/** "sex 13" */
export function chipDate(d: Date): string {
  return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()}`;
}

/** "toda quarta", "seg, qua e sex", "todo dia"… */
export function describeRepeat(days: number[]): string {
  const set = [...days].sort();
  const key = set.join(',');
  if (set.length === 7) return 'todo dia';
  if (key === '1,2,3,4,5') return 'dias úteis';
  if (key === '0,6') return 'fins de semana';
  if (set.length === 1) return (set[0] === 0 || set[0] === 6 ? 'todo ' : 'toda ') + WEEKDAY_LONG[set[0]];
  const names = WEEK_ORDER.filter((d) => set.includes(d)).map((d) => WEEKDAY_SHORT[d]);
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}

export interface Occurrence {
  task: Task;
  /** Chave usada para marcar como feita. */
  key: string;
  doneBy: string | null;
  /** Avulsa que ficou para trás: o dia em que era para ser feita. */
  lateFrom: string | null;
}

/** O que aparece num dia. Em "hoje", avulsas atrasadas e não feitas vêm junto. */
export function occurrencesOn(tasks: Task[], day: Date, today: string): Occurrence[] {
  const key = dayKey(day);
  const out: Occurrence[] = [];
  for (const t of tasks) {
    if (t.repeat) {
      if (t.repeat.includes(day.getDay())) out.push({ task: t, key, doneBy: t.completions[key] ?? null, lateFrom: null });
    } else if (t.date === key) {
      out.push({ task: t, key, doneBy: t.completions[key] ?? null, lateFrom: null });
    } else if (key === today && t.date && t.date < today && !t.completions[t.date]) {
      out.push({ task: t, key: t.date, doneBy: null, lateFrom: t.date });
    }
  }
  return out;
}

/** "atrasada desde seg 9" */
export function lateLabel(from: string): string {
  return `atrasada desde ${chipDate(parseDay(from))}`;
}
