import type { HouseView, Request, Response, Session } from '../api/_lib/house';

export type { HouseView, Session };
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
