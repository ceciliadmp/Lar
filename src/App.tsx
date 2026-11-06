import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api, loadSession, saveSession, type Filter, type HouseView, type Screen, type Session } from './state';
import { CreateHouse, JoinHouse, Welcome } from './screens/Onboarding';
import { Tasks } from './screens/Tasks';
import { Members } from './screens/Members';
import { NewTaskSheet } from './screens/NewTaskSheet';

const POLL_MS = 4000;

export interface Actions {
  go(screen: Screen): void;
  setFilter(f: Filter): void;
  openSheet(): void;
  closeSheet(): void;
  /** Retorna uma mensagem de erro, ou null se deu certo. */
  create(houseName: string, name: string): Promise<string | null>;
  join(code: string, name: string): Promise<string | null>;
  /** `day` é a chave do dia marcado (para recorrentes, cada dia conta separado). */
  toggleTask(id: number, day: string): void;
  addTask(title: string, assignee: string | null, date: string | null, repeat: number[] | null): void;
  deleteTask(id: number): void;
  removeMember(id: string): void;
  newCode(): void;
  leave(): void;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(loadSession);
  const [view, setView] = useState<HouseView | null>(null);
  const [screen, setScreen] = useState<Screen>(session ? 'tasks' : 'welcome');
  const [filter, setFilter] = useState<Filter>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const signOut = useCallback((message?: string) => {
    saveSession(null);
    setSession(null);
    setView(null);
    setSheetOpen(false);
    setScreen('welcome');
    setNotice(message ?? null);
  }, []);

  /** Envia uma ação da casa e atualiza a tela com a resposta. */
  const send = useCallback(
    async (req: Parameters<typeof api>[0]) => {
      try {
        const res = await api(req);
        if (res.view) setView(res.view);
        setNotice(null);
        return res;
      } catch (e) {
        const err = e as ApiError;
        if (err.status === 401) signOut(err.message);
        else setNotice(err.message);
        return null;
      }
    },
    [signOut],
  );

  // Busca a casa ao abrir e de tempos em tempos, para ver o que os outros fizeram.
  useEffect(() => {
    if (!session) return;
    const refresh = () => {
      if (document.visibilityState === 'visible' && sessionRef.current) {
        void send({ action: 'get', session: sessionRef.current });
      }
    };
    refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [session, send]);

  const enter = (s: Session, v: HouseView, isNew: boolean) => {
    saveSession(s);
    setSession(s);
    setView(v);
    setFilter('all');
    setFresh(isNew);
    setNotice(null);
    setScreen('tasks');
  };

  const actions: Actions = {
    go: (s) => {
      setSheetOpen(false);
      setScreen(s);
    },
    setFilter,
    openSheet: () => setSheetOpen(true),
    closeSheet: () => setSheetOpen(false),
    create: async (houseName, name) => {
      try {
        const res = await api({ action: 'create', houseName, name });
        enter(res.session!, res.view!, true);
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    },
    join: async (code, name) => {
      try {
        const res = await api({ action: 'join', code, name });
        enter(res.session!, res.view!, false);
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    },
    toggleTask: (id, day) => {
      if (!session || !view) return;
      // Marca na hora; a resposta do servidor confirma.
      setView({
        ...view,
        tasks: view.tasks.map((t) => {
          if (t.id !== id) return t;
          const completions = { ...t.completions };
          if (completions[day]) delete completions[day];
          else completions[day] = view.meId;
          return { ...t, completions };
        }),
      });
      void send({ action: 'toggleTask', session, taskId: id, date: day });
    },
    addTask: (title, assignee, date, repeat) => {
      if (!session) return;
      setSheetOpen(false);
      void send({ action: 'addTask', session, title, assignee, date, repeat });
    },
    deleteTask: (id) => {
      if (!session || !view) return;
      setView({ ...view, tasks: view.tasks.filter((t) => t.id !== id) });
      void send({ action: 'deleteTask', session, taskId: id });
    },
    removeMember: (id) => session && void send({ action: 'removeMember', session, memberId: id }),
    newCode: () => session && void send({ action: 'newCode', session }),
    leave: () => {
      if (!session) return;
      if (!window.confirm('Sair desta casa? Para voltar, você vai precisar do código.')) return;
      void api({ action: 'leave', session }).catch(() => undefined);
      signOut();
    },
  };

  const inHouse = screen === 'tasks' || screen === 'members';

  return (
    <main className="app">
      {screen === 'welcome' && <Welcome actions={actions} />}
      {screen === 'create' && <CreateHouse actions={actions} />}
      {screen === 'join' && <JoinHouse actions={actions} />}
      {inHouse && !view && (
        <div className="screen loading" aria-live="polite">Carregando a casa…</div>
      )}
      {screen === 'tasks' && view && <Tasks view={view} filter={filter} fresh={fresh} actions={actions} />}
      {screen === 'members' && view && <Members view={view} actions={actions} />}
      {screen === 'tasks' && view && sheetOpen && <NewTaskSheet view={view} actions={actions} />}
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button type="button" className="notice__close" aria-label="Fechar aviso" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      )}
    </main>
  );
}
