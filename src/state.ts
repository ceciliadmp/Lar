import type { Account, GameView, HouseView, LegacySession, Request, Response, RoundResult, Task } from '../api/_lib/house';

export type { Account, GameView, HouseView, RoundResult, Task };
export type Screen = 'welcome' | 'signup' | 'login' | 'forgot' | 'reset' | 'home' | 'create' | 'join' | 'tasks' | 'newTask' | 'editTask' | 'members' | 'score' | 'profile';
/** O que a tela de tarefas mostra. */
export type Period = 'today' | 'week' | 'all';

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

/* ---------- login salvo neste aparelho ---------- */

const TOKEN_KEY = 'lar:auth:v1';
/** Sessão de antes das contas: usada uma vez para ligar o lugar antigo na casa à conta. */
const LEGACY_KEY = 'lar:session:v1';

export function loadToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* sem armazenamento: o login dura só enquanto a página estiver aberta */
  }
}

const EMAIL_KEY = 'lar:last-email';

/** Último e-mail usado neste aparelho, para já vir preenchido no login. */
export function loadLastEmail(): string {
  try {
    return localStorage.getItem(EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveLastEmail(email: string) {
  try {
    localStorage.setItem(EMAIL_KEY, email);
  } catch {
    /* ignora */
  }
}

export function loadLegacy(): LegacySession | undefined {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? (JSON.parse(raw) as LegacySession) : undefined;
  } catch {
    return undefined;
  }
}

export function clearLegacy() {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignora */
  }
}

/* ---------- derivados ---------- */

const PALETTE = [
  { bg: '#DCE8E0', fg: '#24513C' },
  { bg: '#F3E3CF', fg: '#7A4A12' },
  { bg: '#DDE3F0', fg: '#2C3F6B' },
  { bg: '#EEDDE6', fg: '#6B2C4C' },
  { bg: '#E8EBF0', fg: '#465062' },
];

export interface AvatarInfo { bg: string; fg: string; initial: string; photo?: string | null }

export function avatarFor(v: HouseView, id: string | null): AvatarInfo {
  const i = id ? v.members.findIndex((m) => m.id === id) : -1;
  if (i < 0) return { bg: '#E8EBF0', fg: '#465062', initial: '·' };
  const m = v.members[i];
  return { ...PALETTE[i % PALETTE.length], initial: m.name.charAt(0).toUpperCase(), photo: m.photo };
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

/** "9 nov" */
export function shortDate(d: Date): string {
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

/** "Segunda" */
export function weekdayLong(day: number): string {
  const w = WEEKDAY_LONG[day];
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/** "11 nov" a partir de 'AAAA-MM-DD' */
export function shortDateKey(key: string): string {
  return shortDate(parseDay(key));
}

/** Dias entre hoje e uma data 'AAAA-MM-DD' (0 = hoje). */
export function daysUntil(fromKey: string, toKey: string): number {
  return Math.round((parseDay(toKey).getTime() - parseDay(fromKey).getTime()) / 86_400_000);
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
      if (t.repeat.includes(day.getDay()) && !t.skips?.includes(key)) out.push({ task: t, key, doneBy: t.completions[key] ?? null, lateFrom: null });
    } else if (t.date === key) {
      out.push({ task: t, key, doneBy: t.completions[key] ?? null, lateFrom: null });
    } else if (key === today && t.date && t.date < today && !t.completions[t.date]) {
      out.push({ task: t, key: t.date, doneBy: null, lateFrom: t.date });
    }
  }
  return out;
}

/** "seg 9" a partir de 'AAAA-MM-DD' */
export function shortDayLabel(key: string): string {
  return chipDate(parseDay(key));
}

/** "atrasada desde seg 9" */
export function lateLabel(from: string): string {
  return `atrasada desde ${chipDate(parseDay(from))}`;
}

/* ---------- foto de perfil ---------- */

const PHOTO_PX = 256;

/** Lê a imagem escolhida, recorta no centro e reduz para 256×256 em JPEG (fica com uns 20 KB). */
export async function photoFromFile(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => {
      throw new Error('Não deu para abrir essa imagem. Tente uma foto em JPG ou PNG.');
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = PHOTO_PX;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF'; // PNG transparente vira fundo branco
    ctx.fillRect(0, 0, PHOTO_PX, PHOTO_PX);
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      PHOTO_PX,
      PHOTO_PX,
    );
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
