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
}

/** Sessão do formato antigo (antes das contas), guardada no aparelho. */
export interface LegacySession { houseId: string; memberId: string; token: string }

export interface Account { name: string; email: string }

/** O que o app recebe da casa: nunca inclui dados de login de ninguém. */
export interface HouseView {
  house: { name: string; code: string };
  meId: string;
  members: { id: string; name: string; role: Role }[];
  tasks: Task[];
}

type Authed<T> = T & { token: string };

export type Request =
  | { action: 'signup'; name: string; email: string; password: string; legacy?: LegacySession }
  | { action: 'login'; email: string; password: string; legacy?: LegacySession }
  | Authed<{ action: 'me' }>
  | Authed<{ action: 'logout' }>
  | Authed<{ action: 'createHouse'; houseName: string }>
  | Authed<{ action: 'joinHouse'; code: string }>
  | Authed<{ action: 'addTask'; title: string; assignee: string | null; date: string | null; repeat: number[] | null }>
  | Authed<{ action: 'toggleTask'; taskId: number; date: string }>
  | Authed<{ action: 'deleteTask'; taskId: number }>
  | Authed<{ action: 'removeMember'; memberId: string }>
  | Authed<{ action: 'newCode' }>
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

const SESSION_DAYS = 90;
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
const KEEP_DAYS = 30;

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

/** Esquece o que é antigo: conclusões com mais de 30 dias e avulsas feitas há mais de 30 dias. */
function prune(h: StoredHouse) {
  const cutoff = isoDate(new Date(Date.now() - KEEP_DAYS * 86_400_000));
  h.tasks = h.tasks.filter((t) => !(t.date && t.date < cutoff && t.completions[t.date]));
  for (const t of h.tasks) {
    if (!t.repeat) continue;
    for (const day of Object.keys(t.completions)) if (day < cutoff) delete t.completions[day];
  }
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
    members: h.members.map(({ id, name, role }) => ({ id, name, role })),
    tasks: h.tasks,
  };
}

const account = (u: StoredUser): Account => ({ name: u.name, email: u.email });

/* ---------- contas ---------- */

async function newSession(store: Store, u: StoredUser): Promise<string> {
  const token = randomId(32);
  await store.set(sessionKey(token), u.id, SESSION_DAYS * 86_400);
  return token;
}

async function userFromToken(store: Store, token: unknown): Promise<StoredUser> {
  if (typeof token !== 'string' || !token) throw new HttpError(401, 'Entre na sua conta.');
  const userId = await store.get(sessionKey(token));
  const u = userId ? await loadJson<StoredUser>(store, userKey(userId)) : null;
  if (!u) throw new HttpError(401, 'Sua sessão expirou. Entre de novo.');
  return u;
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
  return { h, me };
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

export async function handle(store: Store, req: Request): Promise<Response> {
  try {
    return await run(store, req);
  } catch (e) {
    if (e instanceof HttpError) return { ok: false, status: e.status, error: e.message };
    console.error(e);
    return { ok: false, status: 500, error: 'Algo deu errado no servidor.' };
  }
}

async function run(store: Store, req: Request): Promise<Response> {
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
      const me: StoredMember = { id: randomId(8), name: u.name, role: 'admin', userId: u.id };
      const id = randomId();
      const code = await claimCode(store, id);
      const h: StoredHouse = { id, name: houseName, code, members: [me], tasks: [], nextTaskId: 1 };
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
      const me: StoredMember = { id: randomId(8), name: u.name, role: 'membro', userId: u.id };
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
      h.tasks.unshift({ id: h.nextTaskId++, title, assignee, createdBy: me.id, date, repeat, completions: {} });
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
      if (t.completions[day]) delete t.completions[day];
      else t.completions[day] = me.id;
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
