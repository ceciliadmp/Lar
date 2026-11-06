// Regras da casa, independentes de onde os dados ficam guardados.
// Usado pela função da Vercel (api/lar.ts) e pelo servidor de desenvolvimento (vite.config.ts).

export interface Store {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  /** Grava só se a chave ainda não existir. Retorna true se gravou. */
  setIfAbsent(key: string, value: string): Promise<boolean>;
  del(key: string): Promise<void>;
}

export type Role = 'admin' | 'membro';

interface StoredMember { id: string; name: string; role: Role; token: string }
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

export interface Session { houseId: string; memberId: string; token: string }

/** O que o app recebe: nunca inclui os tokens dos outros membros. */
export interface HouseView {
  house: { name: string; code: string };
  meId: string;
  members: { id: string; name: string; role: Role }[];
  tasks: Task[];
}

export type Request =
  | { action: 'create'; houseName: string; name: string }
  | { action: 'join'; code: string; name: string }
  | { action: 'get'; session: Session }
  | {
      action: 'addTask';
      session: Session;
      title: string;
      assignee: string | null;
      date: string | null;
      repeat: number[] | null;
    }
  | { action: 'toggleTask'; session: Session; taskId: number; date: string }
  | { action: 'deleteTask'; session: Session; taskId: number }
  | { action: 'removeMember'; session: Session; memberId: string }
  | { action: 'newCode'; session: Session }
  | { action: 'leave'; session: Session };

export type Response =
  | { ok: true; session?: Session; view: HouseView | null }
  | { ok: false; status: number; error: string };

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const houseKey = (id: string) => `lar:house:${id}`;
const codeKey = (code: string) => `lar:code:${normalizeCode(code)}`;

function normalizeCode(code: string): string {
  const c = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === 6 ? `${c.slice(0, 3)}-${c.slice(3)}` : c;
}

function randomId(bytes = 16): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
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

async function load(store: Store, id: string): Promise<StoredHouse | null> {
  const raw = await store.get(houseKey(id));
  if (!raw) return null;
  const h = JSON.parse(raw) as StoredHouse;
  h.tasks = (h.tasks as (Task | LegacyTask)[]).map(migrateTask);
  return h;
}

async function save(store: Store, h: StoredHouse): Promise<void> {
  prune(h);
  await store.set(houseKey(h.id), JSON.stringify(h));
}

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

function newMember(name: string, role: Role): StoredMember {
  return { id: randomId(8), name, role, token: randomId() };
}

/** Confere se a sessão ainda pertence a um membro da casa. */
async function authorize(store: Store, s: Session | undefined) {
  if (!s || typeof s.houseId !== 'string' || typeof s.token !== 'string') {
    throw new HttpError(401, 'Sessão inválida.');
  }
  const h = await load(store, s.houseId);
  const me = h?.members.find((m) => m.id === s.memberId && m.token === s.token);
  if (!h || !me) throw new HttpError(401, 'Você não faz mais parte desta casa.');
  return { h, me };
}

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
    case 'create': {
      const houseName = cleanText(req.houseName, 'o nome da casa', 60);
      const me = newMember(cleanText(req.name, 'seu nome', 40), 'admin');
      const id = randomId();
      const code = await claimCode(store, id);
      const h: StoredHouse = { id, name: houseName, code, members: [me], tasks: [], nextTaskId: 1 };
      await save(store, h);
      return { ok: true, session: { houseId: id, memberId: me.id, token: me.token }, view: view(h, me.id) };
    }

    case 'join': {
      const name = cleanText(req.name, 'seu nome', 40);
      const code = cleanText(req.code, 'o código', 20);
      const houseId = await store.get(codeKey(code));
      const h = houseId ? await load(store, houseId) : null;
      if (!h || normalizeCode(h.code) !== normalizeCode(code)) {
        throw new HttpError(404, 'Código não encontrado. Confira com quem administra a casa.');
      }
      if (h.members.length >= 30) throw new HttpError(409, 'Esta casa já está cheia.');
      const me = newMember(name, 'membro');
      h.members.push(me);
      await save(store, h);
      return { ok: true, session: { houseId: h.id, memberId: me.id, token: me.token }, view: view(h, me.id) };
    }

    case 'get': {
      const { h, me } = await authorize(store, req.session);
      return { ok: true, view: view(h, me.id) };
    }

    case 'addTask': {
      const { h, me } = await authorize(store, req.session);
      const title = cleanText(req.title, 'a tarefa', 120);
      const assignee = h.members.some((m) => m.id === req.assignee) ? req.assignee : null;
      const repeat = req.repeat != null ? cleanRepeat(req.repeat) : null;
      const date = repeat ? null : cleanDate(req.date);
      if (h.tasks.length >= 500) throw new HttpError(409, 'A casa já tem tarefas demais. Apague algumas.');
      h.tasks.unshift({ id: h.nextTaskId++, title, assignee, createdBy: me.id, date, repeat, completions: {} });
      await save(store, h);
      return { ok: true, view: view(h, me.id) };
    }

    case 'toggleTask': {
      const { h, me } = await authorize(store, req.session);
      const t = h.tasks.find((x) => x.id === req.taskId);
      if (!t) throw new HttpError(404, 'Essa tarefa foi apagada.');
      // Avulsa: uma única conclusão. Recorrente: uma por dia.
      const day = t.date ?? cleanDate(req.date);
      if (t.completions[day]) delete t.completions[day];
      else t.completions[day] = me.id;
      await save(store, h);
      return { ok: true, view: view(h, me.id) };
    }

    case 'deleteTask': {
      const { h, me } = await authorize(store, req.session);
      h.tasks = h.tasks.filter((x) => x.id !== req.taskId);
      await save(store, h);
      return { ok: true, view: view(h, me.id) };
    }

    case 'removeMember': {
      const { h, me } = await authorize(store, req.session);
      if (me.role !== 'admin') throw new HttpError(403, 'Só o administrador pode remover pessoas.');
      if (req.memberId === me.id) throw new HttpError(400, 'Use “Sair da casa” para sair.');
      h.members = h.members.filter((m) => m.id !== req.memberId);
      h.tasks = h.tasks.map((t) => (t.assignee === req.memberId ? { ...t, assignee: null } : t));
      await save(store, h);
      return { ok: true, view: view(h, me.id) };
    }

    case 'newCode': {
      const { h, me } = await authorize(store, req.session);
      if (me.role !== 'admin') throw new HttpError(403, 'Só o administrador pode trocar o código.');
      const old = h.code;
      h.code = await claimCode(store, h.id);
      await save(store, h);
      await store.del(codeKey(old)); // o código antigo deixa de funcionar
      return { ok: true, view: view(h, me.id) };
    }

    case 'leave': {
      const { h, me } = await authorize(store, req.session);
      h.members = h.members.filter((m) => m.id !== me.id);
      if (h.members.length === 0) {
        await store.del(codeKey(h.code));
        await store.del(houseKey(h.id));
        return { ok: true, view: null };
      }
      // Se o administrador sai, quem entrou primeiro assume.
      if (me.role === 'admin' && !h.members.some((m) => m.role === 'admin')) h.members[0].role = 'admin';
      h.tasks = h.tasks.map((t) => (t.assignee === me.id ? { ...t, assignee: null } : t));
      await save(store, h);
      return { ok: true, view: null };
    }

    default:
      throw new HttpError(400, 'Ação desconhecida.');
  }
}

/** Guarda em memória: só para desenvolvimento local. */
export function memoryStore(): Store {
  const m = new Map<string, string>();
  return {
    get: async (k) => m.get(k) ?? null,
    set: async (k, v) => void m.set(k, v),
    setIfAbsent: async (k, v) => (m.has(k) ? false : (m.set(k, v), true)),
    del: async (k) => void m.delete(k),
  };
}
