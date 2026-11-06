export type Role = 'admin' | 'membro';
export interface Member { id: string; name: string; role: Role }
export interface Task {
  id: number;
  title: string;
  assignee: string | null;
  createdBy: string;
  done: boolean;
  doneBy: string | null;
}
export type Screen = 'welcome' | 'create' | 'join' | 'tasks' | 'members';
export type Filter = 'all' | 'mine' | 'done';

export interface State {
  screen: Screen;
  sheetOpen: boolean;
  meId: string;
  house: { name: string; code: string };
  members: Member[];
  tasks: Task[];
  filter: Filter;
  fresh: boolean;
  nextId: number;
}

export function seedMembers(): Member[] {
  return [
    { id: 'ana', name: 'Ana', role: 'admin' },
    { id: 'bruno', name: 'Bruno', role: 'membro' },
    { id: 'carla', name: 'Carla', role: 'membro' },
  ];
}

export function seedTasks(): Task[] {
  return [
    { id: 1, title: 'Lavar a louça do jantar', assignee: 'bruno', createdBy: 'ana', done: false, doneBy: null },
    { id: 2, title: 'Tirar o lixo reciclável', assignee: 'ana', createdBy: 'carla', done: false, doneBy: null },
    { id: 3, title: 'Comprar papel higiênico', assignee: null, createdBy: 'bruno', done: false, doneBy: null },
    { id: 4, title: 'Regar as plantas da varanda', assignee: 'carla', createdBy: 'carla', done: true, doneBy: 'carla' },
    { id: 5, title: 'Limpar o banheiro', assignee: 'ana', createdBy: 'ana', done: true, doneBy: 'ana' },
  ];
}

export const initialState: State = {
  screen: 'welcome',
  sheetOpen: false,
  meId: 'ana',
  house: { name: 'Apartamento 302', code: 'K7P-4QX' },
  members: seedMembers(),
  tasks: seedTasks(),
  filter: 'all',
  fresh: false,
  nextId: 100,
};

export function generateCode(): string {
  const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += a[Math.floor(Math.random() * a.length)];
    if (i === 2) out += '-';
  }
  return out;
}

export type Action =
  | { type: 'go'; screen: Screen }
  | { type: 'createHouse'; house: string; name: string }
  | { type: 'joinHouse'; code: string; name: string }
  | { type: 'setFilter'; filter: Filter }
  | { type: 'toggleTask'; id: number }
  | { type: 'openSheet' }
  | { type: 'closeSheet' }
  | { type: 'addTask'; title: string; assignee: string | null }
  | { type: 'newCode' }
  | { type: 'removeMember'; id: string }
  | { type: 'leave' };

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'go':
      return { ...s, screen: a.screen, sheetOpen: false };
    case 'createHouse':
      return {
        ...s,
        screen: 'tasks', fresh: true, filter: 'all', meId: 'me',
        house: { name: a.house, code: generateCode() },
        members: [{ id: 'me', name: a.name, role: 'admin' }],
        tasks: [],
      };
    case 'joinHouse':
      // Protótipo: sem backend, entrar com qualquer código abre a casa de exemplo.
      return {
        ...s,
        screen: 'tasks', fresh: false, filter: 'all', meId: 'me',
        house: { name: 'Apartamento 302', code: a.code },
        members: [...seedMembers(), { id: 'me', name: a.name, role: 'membro' }],
        tasks: seedTasks(),
      };
    case 'setFilter':
      return { ...s, filter: a.filter };
    case 'toggleTask':
      return {
        ...s,
        tasks: s.tasks.map((t) =>
          t.id === a.id ? { ...t, done: !t.done, doneBy: t.done ? null : s.meId } : t,
        ),
      };
    case 'openSheet':
      return { ...s, sheetOpen: true };
    case 'closeSheet':
      return { ...s, sheetOpen: false };
    case 'addTask':
      return {
        ...s,
        sheetOpen: false,
        nextId: s.nextId + 1,
        tasks: [
          { id: s.nextId, title: a.title, assignee: a.assignee, createdBy: s.meId, done: false, doneBy: null },
          ...s.tasks,
        ],
      };
    case 'newCode':
      return { ...s, house: { ...s.house, code: generateCode() } };
    case 'removeMember':
      return {
        ...s,
        members: s.members.filter((m) => m.id !== a.id),
        tasks: s.tasks.map((t) => (t.assignee === a.id ? { ...t, assignee: null } : t)),
      };
    case 'leave':
      return initialState;
  }
}

/* ---------- derived helpers ---------- */

const PALETTE = [
  { bg: '#DCE8E0', fg: '#24513C' },
  { bg: '#F3E3CF', fg: '#7A4A12' },
  { bg: '#DDE3F0', fg: '#2C3F6B' },
  { bg: '#EEDDE6', fg: '#6B2C4C' },
  { bg: '#E6E4DC', fg: '#4A4943' },
];

export interface AvatarInfo { bg: string; fg: string; initial: string }

export function avatarFor(s: State, id: string | null): AvatarInfo {
  const i = id ? s.members.findIndex((m) => m.id === id) : -1;
  if (i < 0) return { bg: '#E6E4DC', fg: '#4A4943', initial: '·' };
  return { ...PALETTE[i % PALETTE.length], initial: s.members[i].name.charAt(0).toUpperCase() };
}

export function nameOf(s: State, id: string | null): string {
  if (!id) return 'Qualquer um';
  if (id === s.meId) return 'Você';
  return s.members.find((m) => m.id === id)?.name ?? 'Ex-membro';
}

export function isAdmin(s: State): boolean {
  return s.members.find((m) => m.id === s.meId)?.role === 'admin';
}
