// Regras do app (contas, casa, tarefas), independentes de onde os dados ficam guardados.
// Usado pela função da Vercel (api/lar.ts) e pelo servidor de desenvolvimento (vite.config.ts).

export interface Store {
  get(key: string): Promise<string | null>;
  /** `ttlSeconds`: a chave some sozinha depois desse tempo. */
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  /** Grava só se a chave ainda não existir. Retorna true se gravou. */
  setIfAbsent(key: string, value: string): Promise<boolean>;
  del(key: string): Promise<void>;
}

export type Role = 'admin' | 'membro';

interface StoredMember {
  id: string;
  name: string;
  role: Role;
  /** Conta dona deste lugar na casa. */
  userId?: string;
  /** Só membros de antes das contas: o código secreto guardado no aparelho. */
  token?: string;
  /** Versão da foto de perfil da conta (muda a cada troca). */
  photo?: string;
}

/**
 * Uma tarefa é avulsa (tem `date`) ou se repete em dias da semana (tem `repeat`).
 * Datas são 'AAAA-MM-DD' no fuso de quem usa o app.
 */
export interface Task {
  id: number;
  title: string;
  assignee: string | null;
  createdBy: string;
  /** Avulsa: o dia em que deve ser feita. */
  date: string | null;
  /** Recorrente: dias da semana, 0 = domingo … 6 = sábado. */
  repeat: number[] | null;
  /** Dia → quem fez. Avulsa usa a chave `date`; recorrente, uma chave por dia. */
  completions: Record<string, string>;
  /** Quanto vale cada conclusão no placar: 1, 2 ou 3 (tarefas antigas: 1). */
  points?: number;
  /** Recorrente: dias ('AAAA-MM-DD') excluídos só naquela data. */
  skips?: string[];
}

/** Formato antigo (antes da agenda semanal), convertido ao carregar. */
interface LegacyTask {
  id: number;
  title: string;
  assignee: string | null;
  createdBy: string;
  done?: boolean;
  doneBy?: string | null;
}

interface StoredHouse {
  id: string;
  name: string;
  code: string;
  members: StoredMember[];
  tasks: Task[];
  nextTaskId: number;
  /** Fuso da casa (ex.: America/Sao_Paulo), para saber que dia é "hoje" no placar. */
  timezone?: string;
  /** Pontos: um registro por tarefa concluída (1 ponto cada). */
  score?: ScoreEntry[];
  /** Placar com prêmio; ausente = sem prêmio. */
  game?: StoredGame;
  /** Pontos tirados (guardados por 70 dias). */
  penalties?: Penalty[];
}

interface ScoreEntry {
  /** Quem fez. */
  m: string;
  /** Dia em que fez (fuso da casa): é o dia que conta para a rodada. */
  d: string;
  /** Tarefa e dia da tarefa que foi marcada (para desfazer). */
  t: number;
  k: string;
  /** Pontos ganhos (registros antigos: 1); -1 quando alguém tirou um ponto. */
  p?: number;
}

/** Alguém tirou 1 ponto de outra pessoa, com uma justificativa. */
export interface Penalty {
  id: string;
  /** Quem tirou e de quem tirou (ids de membro). */
  from: string;
  to: string;
  reason: string;
  /** Dia em que aconteceu (fuso da casa). */
  d: string;
  /** A pessoa que perdeu o ponto já fechou o aviso na home. */
  dismissed?: boolean;
}

export type GamePeriod = 'monthly' | 'biweekly';

interface StoredGame {
  /** Mensal (padrão) ou quinzenal: rodadas de 1 a 15 e de 16 ao fim do mês. */
  period?: GamePeriod;
  /** Mensal: dia do mês em que a rodada fecha (1–28), ou 0 = último dia do mês. */
  closingDay: number;
  reward: string;
  /** Fim da última rodada já apurada. */
  lastSettled: string;
  history: RoundResult[];
}

export interface RoundResult {
  start: string;
  end: string;
  reward: string;
  /** Mais de um em caso de empate; vazio se ninguém pontuou. */
  winners: { name: string; points: number }[];
}

/**
 * Pontos do mês, sempre visíveis para todos. `enabled` diz se há prêmio configurado pelo admin;
 * sem prêmio, o mês vai do dia 1 ao último dia.
 */
export interface GameView {
  enabled: boolean;
  period: GamePeriod;
  closingDay: number;
  reward: string;
  /** Rodada atual. */
  start: string;
  end: string;
  /** Hoje, no fuso da casa. */
  today: string;
  standings: { memberId: string; points: number }[];
  history: RoundResult[];
}

interface StoredUser {
  id: string;
  email: string;
  name: string;
  /** PBKDF2-SHA256, em hexadecimal. */
  passwordHash: string;
  salt: string;
  /** A casa em que a pessoa está, e o lugar dela lá. */
  house: { houseId: string; memberId: string } | null;
  createdAt: string;
  /** Logins feitos antes deste momento (ms) não valem mais (regra antiga, ainda respeitada). */
  sessionsValidAfter?: number;
  /** Sobe a cada troca de senha: logins de gerações anteriores deixam de valer. */
  sessionGen?: number;
  /** Versão da foto de perfil; a imagem fica em `lar:photo:<id>`. */
  photo?: string;
}

/** Sessão do formato antigo (antes das contas), guardada no aparelho. */
export interface LegacySession { houseId: string; memberId: string; token: string }

export interface Account { name: string; email: string; photo: string | null }

/** O que o app recebe da casa: nunca inclui dados de login de ninguém. */
export interface HouseView {
  house: { name: string; code: string };
  meId: string;
  members: { id: string; name: string; role: Role; photo: string | null }[];
  tasks: Task[];
  game: GameView;
  penalties: Penalty[];
}

type Authed<T> = T & { token: string };

export type Request =
  | { action: 'signup'; name: string; email: string; password: string; legacy?: LegacySession }
  | { action: 'login'; email: string; password: string; legacy?: LegacySession }
  | { action: 'requestReset'; email: string }
  | { action: 'resetPassword'; resetToken: string; password: string }
  | Authed<{ action: 'me' }>
  | Authed<{ action: 'logout' }>
  | Authed<{ action: 'createHouse'; houseName: string; timezone?: string }>
  | Authed<{ action: 'joinHouse'; code: string }>
  | Authed<{
      action: 'addTask';
      title: string;
      assignee: string | null;
      date: string | null;
      repeat: number[] | null;
      points: number;
    }>
  | Authed<{ action: 'toggleTask'; taskId: number; date: string }>
  /**
   * Tarefa que se repete: muda só o dia `date`. Esse dia sai da repetição e vira
   * uma tarefa avulsa com os dados novos (a conclusão e os pontos daquele dia vão junto).
   */
  | Authed<{
      action: 'editOccurrence';
      taskId: number;
      date: string;
      title: string;
      assignee: string | null;
      points: number;
    }>
  /** Muda texto, responsável, quando e pontos. Pontos já ganhos não mudam. */
  | Authed<{
      action: 'editTask';
      taskId: number;
      title: string;
      assignee: string | null;
      date: string | null;
      repeat: number[] | null;
      points: number;
    }>
  | Authed<{ action: 'deleteTask'; taskId: number }>
  /** Recorrente: some só no dia `date`; as outras repetições continuam. */
  | Authed<{ action: 'skipOccurrence'; taskId: number; date: string }>
  | Authed<{ action: 'removeMember'; memberId: string }>
  | Authed<{ action: 'newCode' }>
  /** Só o admin: muda o nome da casa. */
  | Authed<{ action: 'renameHouse'; name: string }>
  | Authed<{ action: 'setGame'; period?: GamePeriod; closingDay: number; reward: string }>
  /** Tira 1 ponto de outra pessoa da casa, com justificativa curta. */
  | Authed<{ action: 'takePoint'; memberId: string; reason: string }>
  /** A pessoa fecha o aviso de ponto perdido na home. */
  | Authed<{ action: 'dismissPenalty'; penaltyId: string }>
  | Authed<{ action: 'stopGame' }>
  /** `photo`: data URL JPEG, ou null para remover. */
  | Authed<{ action: 'setPhoto'; photo: string | null }>
  | Authed<{ action: 'leave' }>;

export type Response =
  | { ok: true; token?: string; account: Account | null; view: HouseView | null }
  | { ok: false; status: number; error: string };

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/* ---------- chaves no banco ---------- */

const houseKey = (id: string) => `lar:house:${id}`;
const codeKey = (code: string) => `lar:code:${normalizeCode(code)}`;
const userKey = (id: string) => `lar:user:${id}`;
const emailKey = (email: string) => `lar:email:${email}`;
const sessionKey = (token: string) => `lar:session:${token}`;
const attemptsKey = (email: string) => `lar:login-attempts:${email}`;
export const photoKey = (userId: string) => `lar:photo:${userId}`;
/** Fotos de perfil: JPEG quadrado, já reduzido no aparelho. */
const MAX_PHOTO_CHARS = 400_000;

/** Endereço da foto; a versão no endereço deixa o navegador guardar a imagem em cache para sempre. */
function photoUrl(userId: string | undefined, version: string | undefined): string | null {
  return userId && version ? `/api/photo?u=${userId}&v=${version}` : null;
}

const resetKey = (token: string) => `lar:reset:${token}`;
const resetCountKey = (email: string) => `lar:reset-count:${email}`;

const RESET_TTL_S = 60 * 60;
const MAX_RESETS_PER_HOUR = 3;

export interface Email { to: string; subject: string; text: string; html: string }

/** O que muda entre a Vercel e o computador de desenvolvimento. */
export interface Env {
  /** Endereço do app, usado nos links dos e-mails. Nunca vem do pedido (evita links falsos). */
  baseUrl: string;
  /** Manda um e-mail; null se o envio não estiver configurado. */
  sendEmail: ((email: Email) => Promise<void>) | null;
}

/** O login vence depois de 24h sem usar o app; cada uso renova o prazo. */
const SESSION_IDLE_S = 24 * 60 * 60;
/** Renova no máximo a cada 15 min (evita uma gravação no banco a cada atualização automática). */
const SESSION_REFRESH_MS = 15 * 60 * 1000;
/** O prazo guardado inclui essa folga, para valer sempre pelo menos 24h desde o último uso. */
const SESSION_TTL_S = SESSION_IDLE_S + SESSION_REFRESH_MS / 1000;
const MAX_LOGIN_ATTEMPTS = 10;
const ATTEMPT_WINDOW_S = 15 * 60;

/* ---------- utilidades ---------- */

function normalizeCode(code: string): string {
  const c = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === 6 ? `${c.slice(0, 3)}-${c.slice(3)}` : c;
}

const hex = (a: Uint8Array) => Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');

function randomId(bytes = 16): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return hex(a);
}

function randomCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  const s = Array.from(a, (b) => alphabet[b % alphabet.length]).join('');
  return `${s.slice(0, 3)}-${s.slice(3)}`;
}

function cleanText(v: unknown, field: string, max: number): string {
  if (typeof v !== 'string' || !v.trim()) throw new HttpError(400, `Preencha ${field}.`);
  return v.trim().slice(0, max);
}

function cleanEmail(v: unknown): string {
  const email = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    throw new HttpError(400, 'Digite um e-mail válido.');
  }
  return email;
}

function cleanPassword(v: unknown): string {
  if (typeof v !== 'string' || v.length < 8) throw new HttpError(400, 'A senha precisa ter pelo menos 8 caracteres.');
  if (v.length > 200) throw new HttpError(400, 'Senha longa demais.');
  return v;
}

async function hashPassword(password: string, saltHex: string): Promise<string> {
  const salt = new Uint8Array(saltHex.match(/../g)!.map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 210_000 }, key, 256);
  return hex(new Uint8Array(bits));
}

/** Compara sem revelar, pelo tempo, onde as senhas diferem. */
function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ---------- datas e tarefas ---------- */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Guarda conclusões e pontos por 70 dias: cobre a rodada mensal com folga. */
const KEEP_DAYS = 70;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function cleanDate(v: unknown): string {
  if (typeof v !== 'string' || !DATE_RE.test(v) || Number.isNaN(Date.parse(v))) {
    throw new HttpError(400, 'Data inválida.');
  }
  return v;
}

function cleanRepeat(v: unknown): number[] {
  if (!Array.isArray(v)) throw new HttpError(400, 'Escolha os dias da semana.');
  const days = [...new Set(v.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  if (!days.length) throw new HttpError(400, 'Escolha pelo menos um dia da semana.');
  return days;
}

/** Converte tarefas do formato antigo (concluída sim/não, sem data). */
function migrateTask(t: Task | LegacyTask): Task {
  if ('completions' in t) return t;
  const date = isoDate(new Date());
  return {
    id: t.id,
    title: t.title,
    assignee: t.assignee,
    createdBy: t.createdBy,
    date,
    repeat: null,
    completions: t.done && t.doneBy ? { [date]: t.doneBy } : {},
  };
}

/** Esquece o que é antigo: conclusões, avulsas feitas e pontos com mais de 70 dias. */
function prune(h: StoredHouse) {
  const cutoff = isoDate(new Date(Date.now() - KEEP_DAYS * 86_400_000));
  h.tasks = h.tasks.filter((t) => !(t.date && t.date < cutoff && t.completions[t.date]));
  for (const t of h.tasks) {
    if (!t.repeat) continue;
    for (const day of Object.keys(t.completions)) if (day < cutoff) delete t.completions[day];
    if (t.skips) t.skips = t.skips.filter((d) => d >= cutoff);
  }
  if (h.score) h.score = h.score.filter((e) => e.d >= cutoff);
  if (h.penalties) h.penalties = h.penalties.filter((x) => x.d >= cutoff);
}

/* ---------- placar mensal ---------- */

const DEFAULT_TZ = 'America/Sao_Paulo';

function validTimezone(tz: unknown): string | null {
  if (typeof tz !== 'string' || tz.length > 64) return null;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

/** Hoje ('AAAA-MM-DD') no fuso da casa. */
function todayIn(h: StoredHouse): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: h.timezone ?? DEFAULT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const ymd = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

function shiftDay(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + n));
  return ymd(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate());
}

/** Dia de fechamento num mês (m de 1 a 12, pode passar de 12 ou ser 0). */
function closingDate(y: number, m: number, closingDay: number): string {
  const first = new Date(Date.UTC(y, m - 1, 1));
  const yy = first.getUTCFullYear();
  const mm = first.getUTCMonth() + 1;
  const last = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  return ymd(yy, mm, closingDay === 0 ? last : Math.min(closingDay, last));
}

interface RoundRule {
  period?: GamePeriod;
  closingDay: number;
}

/**
 * A rodada que contém `day`.
 * Quinzenal: de 1 a 15, ou de 16 ao último dia do mês.
 * Mensal: do dia seguinte ao fechamento anterior até o próximo fechamento.
 */
function roundOf(day: string, rule: RoundRule): { start: string; end: string } {
  const [y, m, d] = day.split('-').map(Number);
  if (rule.period === 'biweekly') {
    return d <= 15
      ? { start: ymd(y, m, 1), end: ymd(y, m, 15) }
      : { start: ymd(y, m, 16), end: closingDate(y, m, 0) };
  }
  const closingDay = rule.closingDay;
  let end = closingDate(y, m, closingDay);
  let prev = closingDate(y, m - 1, closingDay);
  if (day > end) {
    prev = end;
    end = closingDate(y, m + 1, closingDay);
  }
  return { start: shiftDay(prev, 1), end };
}

function standings(h: StoredHouse, start: string, end: string) {
  const pts = new Map<string, number>();
  for (const e of h.score ?? []) if (e.d >= start && e.d <= end) pts.set(e.m, (pts.get(e.m) ?? 0) + (e.p ?? 1));
  return h.members
    .map((m) => ({ memberId: m.id, points: pts.get(m.id) ?? 0 }))
    .sort((a, b) => b.points - a.points);
}

/** Fecha as rodadas que já acabaram (todas, mesmo se ninguém abriu o app). Retorna true se mudou algo. */
function settleRound(h: StoredHouse): boolean {
  const g = h.game;
  if (!g) return false;
  const prevEnd = shiftDay(roundOf(todayIn(h), g).start, -1);
  let changed = false;
  for (let i = 0; i < 24 && g.lastSettled < prevEnd; i++) {
    const r = roundOf(shiftDay(g.lastSettled, 1), g);
    const table = standings(h, r.start, r.end);
    const top = table[0]?.points ?? 0;
    const winners = top
      ? table
          .filter((x) => x.points === top)
          .map((x) => ({ name: h.members.find((m) => m.id === x.memberId)!.name, points: x.points }))
      : [];
    g.history.unshift({ start: r.start, end: r.end, reward: g.reward, winners });
    g.lastSettled = r.end;
    changed = true;
  }
  if (g.lastSettled < prevEnd) g.lastSettled = prevEnd; // pausa muito longa: pula o resto
  g.history.length = Math.min(g.history.length, 12);
  return changed;
}

function gameView(h: StoredHouse): GameView {
  const g = h.game;
  const today = todayIn(h);
  const closingDay = g?.closingDay ?? 0;
  const period = g?.period ?? 'monthly';
  const r = roundOf(today, { period, closingDay });
  return {
    enabled: !!g,
    period,
    closingDay,
    reward: g?.reward ?? '',
    start: r.start,
    end: r.end,
    today,
    standings: standings(h, r.start, r.end),
    history: g?.history ?? [],
  };
}

/* ---------- leitura e gravação ---------- */

async function loadJson<T>(store: Store, key: string): Promise<T | null> {
  const raw = await store.get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

async function loadHouse(store: Store, id: string): Promise<StoredHouse | null> {
  const h = await loadJson<StoredHouse>(store, houseKey(id));
  if (h) h.tasks = (h.tasks as (Task | LegacyTask)[]).map(migrateTask);
  return h;
}

async function saveHouse(store: Store, h: StoredHouse): Promise<void> {
  prune(h);
  await store.set(houseKey(h.id), JSON.stringify(h));
}

const saveUser = (store: Store, u: StoredUser) => store.set(userKey(u.id), JSON.stringify(u));

/** Reserva um código novo e único para a casa. */
async function claimCode(store: Store, houseId: string): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = randomCode();
    if (await store.setIfAbsent(codeKey(code), houseId)) return code;
  }
  throw new HttpError(500, 'Não foi possível gerar um código. Tente de novo.');
}

function view(h: StoredHouse, meId: string): HouseView {
  return {
    house: { name: h.name, code: h.code },
    meId,
    members: h.members.map(({ id, name, role, userId, photo }) => ({ id, name, role, photo: photoUrl(userId, photo) })),
    tasks: h.tasks,
    game: gameView(h),
    penalties: h.penalties ?? [],
  };
}

const account = (u: StoredUser): Account => ({ name: u.name, email: u.email, photo: photoUrl(u.id, u.photo) });

/* ---------- contas ---------- */

async function newSession(store: Store, u: StoredUser): Promise<string> {
  const token = randomId(32);
  // Guarda quando o login foi feito (para invalidar logins antigos ao trocar a senha)
  // e quando foi renovado pela última vez.
  const now = Date.now();
  await store.set(sessionKey(token), `${u.id}|${now}|${now}|${u.sessionGen ?? 0}`, SESSION_TTL_S);
  return token;
}

async function userFromToken(store: Store, token: unknown): Promise<StoredUser> {
  if (typeof token !== 'string' || !token) throw new HttpError(401, 'Entre na sua conta.');
  const raw = await store.get(sessionKey(token));
  const [userId, issued, refreshed, gen] = (raw ?? '').split('|');
  const u = userId ? await loadJson<StoredUser>(store, userKey(userId)) : null;
  if (!u) throw new HttpError(401, 'Você ficou mais de 24 horas sem usar o app. Entre de novo.');
  if (
    Number(gen ?? 0) !== (u.sessionGen ?? 0) ||
    (u.sessionsValidAfter && Number(issued ?? 0) < u.sessionsValidAfter)
  ) {
    throw new HttpError(401, 'A senha da sua conta foi trocada. Entre de novo.');
  }
  // Usou o app: mais 24h a partir de agora.
  const now = Date.now();
  if (now - Number(refreshed ?? issued ?? 0) > SESSION_REFRESH_MS) {
    await store.set(sessionKey(token), `${userId}|${issued}|${now}|${gen ?? 0}`, SESSION_TTL_S);
  }
  return u;
}

/* ---------- recuperar senha ---------- */

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function resetEmail(u: StoredUser, link: string): Email {
  const name = escapeHtml(u.name);
  return {
    to: u.email,
    subject: 'Lar: crie uma senha nova',
    text:
      `Olá, ${u.name}.\n\nAlguém pediu para trocar a senha da sua conta no Lar. ` +
      `Para criar uma senha nova, abra este link (ele vale por 1 hora):\n\n${link}\n\n` +
      'Se não foi você, ignore este e-mail: sua senha continua a mesma.',
    html: `<div style="font-family:Inter,system-ui,sans-serif;color:#1C1C1A;max-width:480px;line-height:1.5">
<p style="font-size:16px">Olá, ${name}.</p>
<p style="font-size:16px">Alguém pediu para trocar a senha da sua conta no <strong>Lar</strong>. O link abaixo vale por 1 hora.</p>
<p style="margin:28px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#2B5BD7;color:#FFFFFF;text-decoration:none;font-weight:600;padding:14px 22px;border-radius:12px">Criar senha nova</a></p>
<p style="font-size:14px;color:#57564F">Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>
</div>`,
  };
}

/**
 * A casa da pessoa, conferindo que ela ainda é membro.
 * Se foi removida, a conta fica sem casa (e continua existindo).
 */
async function houseOf(store: Store, u: StoredUser) {
  if (!u.house) return null;
  const h = await loadHouse(store, u.house.houseId);
  const me = h?.members.find((m) => m.id === u.house!.memberId && m.userId === u.id);
  if (!h || !me) {
    u.house = null;
    await saveUser(store, u);
    return null;
  }
  if (settleRound(h)) await saveHouse(store, h);
  return { h, me };
}

/**
 * Foto de perfil, só para quem pode ver: a própria pessoa ou alguém logado na mesma casa.
 * Retorna o JPEG em base64, ou o status de erro.
 */
export async function readPhoto(
  store: Store,
  token: string | null,
  userId: string,
): Promise<{ ok: true; data: string } | { ok: false; status: number }> {
  if (!/^[0-9a-f]{32}$/.test(userId)) return { ok: false, status: 404 };
  let viewer: StoredUser;
  try {
    viewer = await userFromToken(store, token);
  } catch {
    return { ok: false, status: 401 };
  }
  if (viewer.id !== userId) {
    const r = await houseOf(store, viewer);
    if (!r || !r.h.members.some((m) => m.userId === userId)) return { ok: false, status: 403 };
  }
  const data = await store.get(photoKey(userId));
  return data ? { ok: true, data } : { ok: false, status: 404 };
}

async function requireHouse(store: Store, u: StoredUser) {
  const r = await houseOf(store, u);
  if (!r) throw new HttpError(409, 'Você não faz mais parte desta casa.');
  return r;
}

/**
 * Quem já usava o app antes das contas: liga o lugar antigo na casa à conta,
 * mantendo nome, tarefas e quem fez o quê.
 */
async function claimLegacy(store: Store, u: StoredUser, legacy: LegacySession | undefined) {
  if (u.house || !legacy || typeof legacy.token !== 'string' || typeof legacy.houseId !== 'string') return;
  const h = await loadHouse(store, legacy.houseId);
  const m = h?.members.find((x) => x.id === legacy.memberId && x.token && x.token === legacy.token);
  if (!h || !m || m.userId) return;
  m.userId = u.id;
  delete m.token;
  u.house = { houseId: h.id, memberId: m.id };
  await saveHouse(store, h);
  await saveUser(store, u);
}

async function reply(store: Store, u: StoredUser, token?: string): Promise<Response> {
  const r = await houseOf(store, u);
  return { ok: true, token, account: account(u), view: r ? view(r.h, r.me.id) : null };
}

/* ---------- ações ---------- */

export async function handle(store: Store, req: Request, env: Env): Promise<Response> {
  try {
    return await run(store, req, env);
  } catch (e) {
    if (e instanceof HttpError) return { ok: false, status: e.status, error: e.message };
    console.error(e);
    return { ok: false, status: 500, error: 'Algo deu errado no servidor.' };
  }
}

async function run(store: Store, req: Request, env: Env): Promise<Response> {
  switch (req?.action) {
    case 'signup': {
      const name = cleanText(req.name, 'seu nome', 40);
      const email = cleanEmail(req.email);
      const password = cleanPassword(req.password);
      const id = randomId();
      if (!(await store.setIfAbsent(emailKey(email), id))) {
        throw new HttpError(409, 'Já existe uma conta com este e-mail. Tente entrar.');
      }
      const salt = randomId(16);
      const u: StoredUser = {
        id,
        email,
        name,
        salt,
        passwordHash: await hashPassword(password, salt),
        house: null,
        createdAt: new Date().toISOString(),
      };
      await saveUser(store, u);
      await claimLegacy(store, u, req.legacy);
      return reply(store, u, await newSession(store, u));
    }

    case 'login': {
      const email = cleanEmail(req.email);
      const password = typeof req.password === 'string' ? req.password : '';
      const attempts = Number((await store.get(attemptsKey(email))) ?? 0);
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        throw new HttpError(429, 'Muitas tentativas. Espere 15 minutos e tente de novo.');
      }
      const id = await store.get(emailKey(email));
      const u = id ? await loadJson<StoredUser>(store, userKey(id)) : null;
      const ok = !!u && sameString(await hashPassword(password, u.salt), u.passwordHash);
      if (!u || !ok) {
        await store.set(attemptsKey(email), String(attempts + 1), ATTEMPT_WINDOW_S);
        throw new HttpError(401, 'E-mail ou senha incorretos.');
      }
      await store.del(attemptsKey(email));
      await claimLegacy(store, u, req.legacy);
      return reply(store, u, await newSession(store, u));
    }

    case 'requestReset': {
      const email = cleanEmail(req.email);
      if (!env.sendEmail) {
        throw new HttpError(503, 'A recuperação de senha ainda não foi configurada neste app.');
      }
      const sent = Number((await store.get(resetCountKey(email))) ?? 0);
      if (sent >= MAX_RESETS_PER_HOUR) {
        throw new HttpError(429, 'Já mandamos alguns e-mails. Confira sua caixa de entrada e o spam, ou espere 1 hora.');
      }
      await store.set(resetCountKey(email), String(sent + 1), RESET_TTL_S);
      const id = await store.get(emailKey(email));
      const u = id ? await loadJson<StoredUser>(store, userKey(id)) : null;
      // Responde igual exista ou não a conta, para não revelar quem usa o app.
      if (u) {
        const resetToken = randomId(32);
        await store.set(resetKey(resetToken), u.id, RESET_TTL_S);
        const link = `${env.baseUrl.replace(/\/$/, '')}/?reset=${resetToken}`;
        try {
          await env.sendEmail(resetEmail(u, link));
        } catch (e) {
          console.error(e);
          throw new HttpError(502, 'Não foi possível mandar o e-mail agora. Tente de novo em alguns minutos.');
        }
      }
      return { ok: true, account: null, view: null };
    }

    case 'resetPassword': {
      const password = cleanPassword(req.password);
      const resetToken = typeof req.resetToken === 'string' ? req.resetToken : '';
      const userId = resetToken ? await store.get(resetKey(resetToken)) : null;
      const u = userId ? await loadJson<StoredUser>(store, userKey(userId)) : null;
      if (!u) throw new HttpError(410, 'Este link expirou ou já foi usado. Peça um novo.');
      await store.del(resetKey(resetToken)); // o link só vale uma vez
      u.salt = randomId(16);
      u.passwordHash = await hashPassword(password, u.salt);
      u.sessionGen = (u.sessionGen ?? 0) + 1; // desconecta os outros aparelhos
      await saveUser(store, u);
      await store.del(attemptsKey(u.email));
      return reply(store, u, await newSession(store, u));
    }

    case 'logout': {
      if (typeof req.token === 'string') await store.del(sessionKey(req.token));
      return { ok: true, account: null, view: null };
    }

    case 'me': {
      const u = await userFromToken(store, req.token);
      return reply(store, u);
    }

    case 'createHouse': {
      const u = await userFromToken(store, req.token);
      if (await houseOf(store, u)) throw new HttpError(409, 'Você já está numa casa. Saia dela antes.');
      const houseName = cleanText(req.houseName, 'o nome da casa', 60);
      const me: StoredMember = { id: randomId(8), name: u.name, role: 'admin', userId: u.id, photo: u.photo };
      const id = randomId();
      const code = await claimCode(store, id);
      const h: StoredHouse = {
        id,
        name: houseName,
        code,
        members: [me],
        tasks: [],
        nextTaskId: 1,
        timezone: validTimezone(req.timezone) ?? DEFAULT_TZ,
      };
      await saveHouse(store, h);
      u.house = { houseId: id, memberId: me.id };
      await saveUser(store, u);
      return reply(store, u);
    }

    case 'joinHouse': {
      const u = await userFromToken(store, req.token);
      if (await houseOf(store, u)) throw new HttpError(409, 'Você já está numa casa. Saia dela antes.');
      const code = cleanText(req.code, 'o código', 20);
      const houseId = await store.get(codeKey(code));
      const h = houseId ? await loadHouse(store, houseId) : null;
      if (!h || normalizeCode(h.code) !== normalizeCode(code)) {
        throw new HttpError(404, 'Código não encontrado. Confira com quem administra a casa.');
      }
      if (h.members.length >= 30) throw new HttpError(409, 'Esta casa já está cheia.');
      const me: StoredMember = { id: randomId(8), name: u.name, role: 'membro', userId: u.id, photo: u.photo };
      h.members.push(me);
      await saveHouse(store, h);
      u.house = { houseId: h.id, memberId: me.id };
      await saveUser(store, u);
      return reply(store, u);
    }

    case 'addTask': {
      const u = await userFromToken(store, req.token);
      const { h, me } = await requireHouse(store, u);
      const title = cleanText(req.title, 'a tarefa', 120);
      const assignee = h.members.some((m) => m.id === req.assignee) ? req.assignee : null;
      const repeat = req.repeat != null ? cleanRepeat(req.repeat) : null;
      const date = repeat ? null : cleanDate(req.date);
      if (h.tasks.length >= 500) throw new HttpError(409, 'A casa já tem tarefas demais. Apague algumas.');
      const points = Number(req.points ?? 1);
      if (![1, 2, 3].includes(points)) throw new HttpError(400, 'A tarefa vale 1, 2 ou 3 pontos.');
      h.tasks.unshift({ id: h.nextTaskId++, title, assignee, createdBy: me.id, date, repeat, completions: {}, points });
      await saveHouse(store, h);
      return { ok: true, account: account(u), view: view(h, me.id) };
    }

    case 'editTask': {
      const u = await userFromToken(store, req.token);
      const { h, me } = await requireHouse(store, u);
      const t = h.tasks.find((x) => x.id === req.taskId);
      if (!t) throw new HttpError(404, 'Essa tarefa foi apagada.');
      const repeat = req.repeat != null ? cleanRepeat(req.repeat) : null;
      const date = repeat ? null : cleanDate(req.date);
      const points = Number(req.points ?? 1);
      if (![1, 2, 3].includes(points)) throw new HttpError(400, 'A tarefa vale 1, 2 ou 3 pontos.');
      t.title = cleanText(req.title, 'a tarefa', 120);
      t.assignee = h.members.some((m) => m.id === req.assignee) ? req.assignee : null;
      t.points = points;
      if (repeat) {
        t.repeat = repeat;
        t.date = null;
      } else {
        // Virou (ou continua) avulsa: só vale a conclusão do dia dela.
        const done = t.completions[date!];
        t.completions = done ? { [date!]: done } : {};
        t.repeat = null;
        t.date = date;
        delete t.skips;
      }
      await saveHouse(store, h);
      return { ok: true, account: account(u), view: view(h, me.id) };
    }

    case 'editOccurrence': {
      const u = await userFromToken(store, req.token);
      const { h, me } = await requireHouse(store, u);
      const t = h.tasks.find((x) => x.id === req.taskId);
      if (!t) throw new HttpError(404, 'Essa tarefa foi apagada.');
      if (!t.repeat) throw new HttpError(400, 'Essa tarefa não se repete.');
      const day = cleanDate(req.date);
      const points = Number(req.points ?? 1);
      if (![1, 2, 3].includes(points)) throw new HttpError(400, 'A tarefa vale 1, 2 ou 3 pontos.');
      if (h.tasks.length >= 500) throw new HttpError(409, 'A casa já tem tarefas demais. Apague algumas.');
      const id = h.nextTaskId++;
      const done = t.completions[day];
      h.tasks.unshift({
        id,
        title: cleanText(req.title, 'a tarefa', 120),
        assignee: h.members.some((m) => m.id === req.assignee) ? req.assignee : null,
        createdBy: t.createdBy,
        date: day,
        repeat: null,
        completions: done ? { [day]: done } : {},
        points,
      });
      // O dia sai da repetição; a conclusão e os pontos daquele dia passam para a tarefa nova.
      delete t.completions[day];
      t.skips = [...new Set([...(t.skips ?? []), day])].sort();
      for (const e of h.score ?? []) if (e.t === t.id && e.k === day) e.t = id;
      await saveHouse(store, h);
      return { ok: true, account: account(u), view: view(h, me.id) };
    }

    case 'toggleTask': {
      const u = await userFromToken(store, req.token);
      const { h, me } = await requireHouse(store, u);
      const t = h.tasks.find((x) => x.id === req.taskId);
      if (!t) throw new HttpError(404, 'Essa tarefa foi apagada.');
      // Avulsa: uma única conclusão. Recorrente: uma por dia.
      const day = t.date ?? cleanDate(req.date);
      h.score ??= [];
      if (t.completions[day]) {
        delete t.completions[day];
        h.score = h.score.filter((e) => !(e.t === t.id && e.k === day));
      } else {
        // Tarefa com responsável: dá para marcar por ela, e conta como feita por ela.
        // Sem responsável ("qualquer um"): quem marca é quem fez.
        const doer = t.assignee && h.members.some((m) => m.id === t.assignee) ? t.assignee : me.id;
        t.completions[day] = doer;
        // Os pontos da tarefa vão para quem fez, no dia em que foi marcada.
        h.score.push({ m: doer, d: todayIn(h), t: t.id, k: day, p: t.points ?? 1 });
      }
      await saveHouse(store, h);
      return { ok: true, account: account(u), view: view(h, me.id) };
    }

    case 'deleteTask': {
      const u = await userFromToken(store, req.token);
      const { h, me } = await requireHouse(store, u);
      h.tasks = h.tasks.filter((x) => x.id !== req.taskId);
      await saveHouse(store, h);
      return { ok: true, account: account(u), view: view(h, me.id) };
    }

    case 'skipOccurrence': {
      const u = await userFromToken(store, req.token);
      const { h, me } = await requireHouse(store, u);
      const t = h.tasks.find((x) => x.id === req.taskId);
      if (!t) throw new HttpError(404, 'Essa tarefa foi apagada.');
      if (!t.repeat) throw new HttpError(400, 'Essa tarefa não se repete.');
      const day = cleanDate(req.date);
      t.skips = [...new Set([...(t.skips ?? []), day])].sort();
      await saveHouse(store, h);
      return { ok: true, account: account(u), view: view(h, me.id) };
    }

    case 'removeMember': {
      const u = await userFromToken(store, req.token);
      const { h, me } = await requireHouse(store, u);
      if (me.role !== 'admin') throw new HttpError(403, 'Só o administrador pode remover pessoas.');
      if (req.memberId === me.id) throw new HttpError(400, 'Use “Sair da casa” para sair.');
      h.members = h.members.filter((m) => m.id !== req.memberId);
      h.tasks = h.tasks.map((t) => (t.assignee === req.memberId ? { ...t, assignee: null } : t));
      await saveHouse(store, h);
      return { ok: true, account: account(u), view: view(h, me.id) };
    }

    case 'renameHouse': {
      const u = await userFromToken(store, req.token);
      const { h, me } = await requireHouse(store, u);
      if (me.role !== 'admin') throw new HttpError(403, 'Só o administrador pode mudar o nome da casa.');
      h.name = cleanText(req.name, 'o nome da casa', 60);
      await saveHouse(store, h);
      return { ok: true, account: account(u), view: view(h, me.id) };
    }

    case 'newCode': {
      const u = await userFromToken(store, req.token);
      const { h, me } = await requireHouse(store, u);
      if (me.role !== 'admin') throw new HttpError(403, 'Só o administrador pode trocar o código.');
      const old = h.code;
      h.code = await claimCode(store, h.id);
      await saveHouse(store, h);
      await store.del(codeKey(old)); // o código antigo deixa de funcionar
      return { ok: true, account: account(u), view: view(h, me.id) };
    }

    case 'setGame': {
      const u = await userFromToken(store, req.token);
      const { h, me } = await requireHouse(store, u);
      if (me.role !== 'admin') throw new HttpError(403, 'Só o administrador pode mudar o placar.');
      const closingDay = Number(req.closingDay);
      if (!Number.isInteger(closingDay) || closingDay < 0 || closingDay > 28) {
        throw new HttpError(400, 'Escolha um dia de 1 a 28, ou o último dia do mês.');
      }
      const period: GamePeriod = req.period === 'biweekly' ? 'biweekly' : 'monthly';
      const reward = cleanText(req.reward, 'a recompensa', 120);
      const changed =
        !h.game || (h.game.period ?? 'monthly') !== period || (period === 'monthly' && h.game.closingDay !== closingDay);
      h.game = {
        period,
        closingDay,
        reward,
        // Ao ligar ou mudar as rodadas, nada de apurar rodadas passadas: começa a valer a rodada atual.
        lastSettled: changed ? shiftDay(roundOf(todayIn(h), { period, closingDay }).start, -1) : h.game!.lastSettled,
        history: h.game?.history ?? [],
      };
      await saveHouse(store, h);
      return { ok: true, account: account(u), view: view(h, me.id) };
    }

    case 'takePoint': {
      const u = await userFromToken(store, req.token);
      const { h, me } = await requireHouse(store, u);
      const target = h.members.find((m) => m.id === req.memberId);
      if (!target) throw new HttpError(404, 'Essa pessoa não está mais na casa.');
      if (target.id === me.id) throw new HttpError(400, 'Você não pode tirar ponto de si mesmo.');
      const reason = cleanText(req.reason, 'o motivo', 120);
      const g = gameView(h);
      const current = g.standings.find((x) => x.memberId === target.id)?.points ?? 0;
      if (current < 1) throw new HttpError(409, `${target.name} não tem pontos nesta rodada.`);
      const id = randomId(6);
      const d = todayIn(h);
      h.penalties = [{ id, from: me.id, to: target.id, reason, d }, ...(h.penalties ?? [])].slice(0, 200);
      h.score = [...(h.score ?? []), { m: target.id, d, t: 0, k: `pen:${id}`, p: -1 }];
      await saveHouse(store, h);
      return { ok: true, account: account(u), view: view(h, me.id) };
    }

    case 'dismissPenalty': {
      const u = await userFromToken(store, req.token);
      const { h, me } = await requireHouse(store, u);
      const pen = h.penalties?.find((x) => x.id === req.penaltyId && x.to === me.id);
      if (pen && !pen.dismissed) {
        pen.dismissed = true;
        await saveHouse(store, h);
      }
      return { ok: true, account: account(u), view: view(h, me.id) };
    }

    case 'stopGame': {
      const u = await userFromToken(store, req.token);
      const { h, me } = await requireHouse(store, u);
      if (me.role !== 'admin') throw new HttpError(403, 'Só o administrador pode mudar o placar.');
      delete h.game;
      await saveHouse(store, h);
      return { ok: true, account: account(u), view: view(h, me.id) };
    }

    case 'setPhoto': {
      const u = await userFromToken(store, req.token);
      if (req.photo === null) {
        await store.del(photoKey(u.id));
        delete u.photo;
      } else {
        const prefix = 'data:image/jpeg;base64,';
        const data = typeof req.photo === 'string' && req.photo.startsWith(prefix) ? req.photo.slice(prefix.length) : '';
        if (!data || !/^[A-Za-z0-9+/=]+$/.test(data)) throw new HttpError(400, 'Imagem inválida. Tente outra foto.');
        if (data.length > MAX_PHOTO_CHARS) throw new HttpError(413, 'Foto grande demais.');
        await store.set(photoKey(u.id), data);
        u.photo = randomId(4);
      }
      await saveUser(store, u);
      // A casa guarda a versão da foto de cada membro, para todo mundo ver.
      const r = await houseOf(store, u);
      if (r) {
        r.me.photo = u.photo;
        if (!u.photo) delete r.me.photo;
        await saveHouse(store, r.h);
      }
      return reply(store, u);
    }

    case 'leave': {
      const u = await userFromToken(store, req.token);
      const r = await houseOf(store, u);
      if (r) {
        const { h, me } = r;
        h.members = h.members.filter((m) => m.id !== me.id);
        if (h.members.length === 0) {
          await store.del(codeKey(h.code));
          await store.del(houseKey(h.id));
        } else {
          // Se o administrador sai, quem entrou primeiro assume.
          if (me.role === 'admin' && !h.members.some((m) => m.role === 'admin')) h.members[0].role = 'admin';
          h.tasks = h.tasks.map((t) => (t.assignee === me.id ? { ...t, assignee: null } : t));
          await saveHouse(store, h);
        }
      }
      u.house = null;
      await saveUser(store, u);
      return { ok: true, account: account(u), view: null };
    }

    default:
      throw new HttpError(400, 'Ação desconhecida.');
  }
}

/** Guarda em memória: só para desenvolvimento local. */
export function memoryStore(): Store {
  const m = new Map<string, { v: string; exp: number }>();
  const live = (k: string) => {
    const e = m.get(k);
    if (e && e.exp && e.exp < Date.now()) m.delete(k);
    return m.get(k);
  };
  return {
    get: async (k) => live(k)?.v ?? null,
    set: async (k, v, ttl) => void m.set(k, { v, exp: ttl ? Date.now() + ttl * 1000 : 0 }),
    setIfAbsent: async (k, v) => (live(k) ? false : (m.set(k, { v, exp: 0 }), true)),
    del: async (k) => void m.delete(k),
  };
}
