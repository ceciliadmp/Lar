import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  api,
  clearLegacy,
  loadLegacy,
  loadToken,
  saveToken,
  type Account,
  type Filter,
  type HouseView,
  type Screen,
} from './state';
import { Home, Login, Signup } from './screens/Auth';
import { CreateHouse, JoinHouse, Welcome } from './screens/Onboarding';
import { Tasks } from './screens/Tasks';
import { Members } from './screens/Members';
import { NewTaskSheet } from './screens/NewTaskSheet';

const POLL_MS = 4000;

type ApiResult = Awaited<ReturnType<typeof api>>;

export interface Actions {
  go(screen: Screen): void;
  setFilter(f: Filter): void;
  openSheet(): void;
  closeSheet(): void;
  /** Os formulários recebem uma mensagem de erro, ou null se deu certo. */
  signup(name: string, email: string, password: string): Promise<string | null>;
  login(email: string, password: string): Promise<string | null>;
  logout(): void;
  create(houseName: string): Promise<string | null>;
  join(code: string): Promise<string | null>;
  /** `day` é a chave do dia marcado (para recorrentes, cada dia conta separado). */
  toggleTask(id: number, day: string): void;
  addTask(title: string, assignee: string | null, date: string | null, repeat: number[] | null): void;
  deleteTask(id: number): void;
  removeMember(id: string): void;
  newCode(): void;
  leave(): void;
}

export default function App() {
  const [token, setToken] = useState<string | null>(loadToken);
  const [account, setAccount] = useState<Account | null>(null);
  const [view, setView] = useState<HouseView | null>(null);
  const [booting, setBooting] = useState(!!token);
  const [screen, setScreen] = useState<Screen>('welcome');
  const [filter, setFilter] = useState<Filter>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const hadHouse = useRef(false);

  /** Aplica a resposta do servidor: conta, casa e, se a casa sumiu, volta ao início. */
  const apply = useCallback((res: ApiResult) => {
    setAccount(res.account);
    setView(res.view);
    if (!res.view) {
      setSheetOpen(false);
      setScreen((s) => (s === 'tasks' || s === 'members' ? 'home' : s));
      if (hadHouse.current) setNotice('Você não faz mais parte desta casa.');
    }
    hadHouse.current = !!res.view;
  }, []);

  const signOut = useCallback((message?: string) => {
    saveToken(null);
    setToken(null);
    setAccount(null);
    setView(null);
    hadHouse.current = false;
    setSheetOpen(false);
    setBooting(false);
    setScreen('welcome');
    setNotice(message ?? null);
  }, []);

  const send = useCallback(
    async (req: Parameters<typeof api>[0]) => {
      try {
        const res = await api(req);
        setNotice(null);
        apply(res);
        return res;
      } catch (e) {
        const err = e as ApiError;
        if (err.status === 401) signOut(err.message);
        else setNotice(err.message);
        return null;
      }
    },
    [apply, signOut],
  );

  // Ao abrir: carrega o perfil salvo. Depois, atualiza de tempos em tempos para ver o que os outros fizeram.
  useEffect(() => {
    if (!token) return;
    let first = true;
    const refresh = async () => {
      if (document.visibilityState !== 'visible' || !tokenRef.current) return;
      const res = await send({ action: 'me', token: tokenRef.current });
      if (first && res) {
        first = false;
        setScreen((s) => (s === 'welcome' ? (res.view ? 'tasks' : 'home') : s));
        setBooting(false);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [token, send]);

  /** Entrou na conta: guarda o login e vai para a casa (ou para escolher uma). */
  const signedIn = (res: ApiResult) => {
    saveToken(res.token!);
    clearLegacy();
    apply(res);
    setFilter('all');
    setFresh(false);
    setNotice(null);
    setScreen(res.view ? 'tasks' : 'home');
    setToken(res.token!);
  };

  /** Para os formulários: roda a ação e devolve a mensagem de erro. */
  const attempt = async (run: () => Promise<void>) => {
    try {
      await run();
      return null;
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 401 && tokenRef.current) signOut(err.message);
      return err.message;
    }
  };

  const enterHouse = (res: ApiResult, isNew: boolean) => {
    apply(res);
    setFilter('all');
    setFresh(isNew);
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
    signup: (name, email, password) =>
      attempt(async () => signedIn(await api({ action: 'signup', name, email, password, legacy: loadLegacy() }))),
    login: (email, password) =>
      attempt(async () => signedIn(await api({ action: 'login', email, password, legacy: loadLegacy() }))),
    logout: () => {
      if (token) void api({ action: 'logout', token }).catch(() => undefined);
      signOut();
    },
    create: (houseName) =>
      attempt(async () => enterHouse(await api({ action: 'createHouse', token: token!, houseName }), true)),
    join: (code) => attempt(async () => enterHouse(await api({ action: 'joinHouse', token: token!, code }), false)),
    toggleTask: (id, day) => {
      if (!token || !view) return;
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
      void send({ action: 'toggleTask', token, taskId: id, date: day });
    },
    addTask: (title, assignee, date, repeat) => {
      if (!token) return;
      setSheetOpen(false);
      void send({ action: 'addTask', token, title, assignee, date, repeat });
    },
    deleteTask: (id) => {
      if (!token || !view) return;
      setView({ ...view, tasks: view.tasks.filter((t) => t.id !== id) });
      void send({ action: 'deleteTask', token, taskId: id });
    },
    removeMember: (id) => token && void send({ action: 'removeMember', token, memberId: id }),
    newCode: () => token && void send({ action: 'newCode', token }),
    leave: () => {
      if (!token) return;
      if (!window.confirm('Sair desta casa? Para voltar, você vai precisar do código.')) return;
      hadHouse.current = false;
      void send({ action: 'leave', token });
      setScreen('home');
    },
  };

  const inHouse = screen === 'tasks' || screen === 'members';

  return (
    <main className="app">
      {booting ? (
        <div className="screen loading" aria-live="polite">Carregando…</div>
      ) : (
        <>
          {screen === 'welcome' && <Welcome actions={actions} />}
          {screen === 'signup' && <Signup actions={actions} />}
          {screen === 'login' && <Login actions={actions} />}
          {screen === 'home' && account && <Home account={account} actions={actions} />}
          {screen === 'create' && <CreateHouse actions={actions} />}
          {screen === 'join' && <JoinHouse actions={actions} />}
          {inHouse && !view && <div className="screen loading" aria-live="polite">Carregando a casa…</div>}
          {screen === 'tasks' && view && <Tasks view={view} filter={filter} fresh={fresh} actions={actions} />}
          {screen === 'members' && view && account && <Members view={view} account={account} actions={actions} />}
          {screen === 'tasks' && view && sheetOpen && <NewTaskSheet view={view} actions={actions} />}
        </>
      )}
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
