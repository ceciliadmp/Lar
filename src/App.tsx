import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  api,
  avatarFor,
  isTabScreen,
  clearLegacy,
  loadLegacy,
  loadToken,
  saveLastEmail,
  saveToken,
  type Account,
  type GamePeriod,
  type Period,
  type StatsView,
  type HouseView,
  type Screen,
} from './state';
import { Forgot, Home, Login, ResetPassword, Signup } from './screens/Auth';
import { CreateHouse, JoinHouse, Welcome } from './screens/Onboarding';
import { Tasks } from './screens/Tasks';
import { Score } from './screens/Score';
import { Metrics } from './screens/Metrics';
import { Button, Icon } from './components/ui';
import { clearPhotos } from './photos';
import { Settings } from './screens/Settings';
import { TabBar } from './components/TabBar';
import { NewTask } from './screens/NewTask';
import { Profile } from './screens/Profile';

const POLL_MS = 4000;

type ApiResult = Awaited<ReturnType<typeof api>>;

export interface Actions {
  go(screen: Screen): void;
  setPeriod(p: Period): void;
  /** Os formulários recebem uma mensagem de erro, ou null se deu certo. */
  signup(name: string, email: string, password: string): Promise<string | null>;
  login(email: string, password: string): Promise<string | null>;
  requestReset(email: string): Promise<string | null>;
  resetPassword(password: string): Promise<string | null>;
  logout(): void;
  create(houseName: string): Promise<string | null>;
  join(code: string): Promise<string | null>;
  /** `day` é a chave do dia marcado (para recorrentes, cada dia conta separado). */
  toggleTask(id: number, day: string): void;
  addTask(title: string, assignee: string | null, date: string | null, repeat: number[] | null, points: number): void;
  /** Abre a tela de editar uma tarefa. */
  /** `day`: tarefa que se repete, editar só esse dia. */
  openEdit(id: number, day?: string): void;
  /** Muda só um dia de uma tarefa que se repete. */
  saveOccurrence(id: number, day: string, title: string, assignee: string | null, points: number): void;
  saveTask(
    id: number,
    title: string,
    assignee: string | null,
    date: string | null,
    repeat: number[] | null,
    points: number,
  ): void;
  deleteTask(id: number): void;
  /** Tarefa que se repete: exclui só o dia `day`. */
  skipOccurrence(id: number, day: string): void;
  removeMember(id: string): void;
  newCode(): void;
  /** Só o admin: muda o nome da casa. */
  renameHouse(name: string): Promise<string | null>;
  /** Métricas da casa (tarefas feitas por dia); null se falhar. */
  getStats(): Promise<StatsView | null>;
  /** Foto como data URL JPEG, ou null para remover. */
  setPhoto(photo: string | null): Promise<string | null>;
  setGame(period: GamePeriod, closingDay: number, reward: string): Promise<string | null>;
  /** Tira 1 ponto de outra pessoa; retorna a mensagem de erro, ou null. */
  takePoint(memberId: string, reason: string): Promise<string | null>;
  /** Fecha o aviso de ponto perdido na home. */
  dismissPenalty(id: string): void;
  stopGame(): void;
  leave(): void;
}

/** Link do e-mail de recuperação: ?reset=… */
function readResetToken(): string | null {
  const t = new URLSearchParams(window.location.search).get('reset');
  if (t) window.history.replaceState(null, '', window.location.pathname); // tira o código da barra de endereço
  return t;
}

export default function App() {
  const [resetToken] = useState(readResetToken);
  const [token, setToken] = useState<string | null>(loadToken);
  const [account, setAccount] = useState<Account | null>(null);
  const [view, setView] = useState<HouseView | null>(null);
  const [booting, setBooting] = useState(!!token && !resetToken);
  const [screen, setScreen] = useState<Screen>(resetToken ? 'reset' : 'welcome');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [period, setPeriodState] = useState<Period>(() => {
    try {
      const p = localStorage.getItem('lar:period');
      if (p === 'all') return 'all';
      return p === 'week' ? 'week' : 'today'; // "amanhã" (aba antiga) vira hoje
    } catch {
      return 'today';
    }
  });
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
      setScreen((s) => (s === 'tasks' || s === 'newTask' || s === 'editTask' || s === 'settings' || s === 'score' || s === 'metrics' ? 'home' : s));
      if (hadHouse.current) setNotice('Você não faz mais parte desta casa.');
    }
    hadHouse.current = !!res.view;
  }, []);

  const signOut = useCallback((message?: string) => {
    saveToken(null);
    clearPhotos();
    setToken(null);
    setAccount(null);
    setView(null);
    hadHouse.current = false;
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
    if (res.account) saveLastEmail(res.account.email);
    clearLegacy();
    apply(res);
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
    setFresh(isNew);
    setScreen('tasks');
  };

  const actions: Actions = {
    go: (s) => setScreen(s),
    setPeriod: (p) => {
      setPeriodState(p);
      try {
        localStorage.setItem('lar:period', p); // lembra a escolha neste aparelho
      } catch {
        /* ignora */
      }
    },
    signup: (name, email, password) =>
      attempt(async () => signedIn(await api({ action: 'signup', name, email, password, legacy: loadLegacy() }))),
    login: (email, password) =>
      attempt(async () => signedIn(await api({ action: 'login', email, password, legacy: loadLegacy() }))),
    requestReset: (email) => attempt(async () => void (await api({ action: 'requestReset', email }))),
    resetPassword: (password) =>
      attempt(async () => signedIn(await api({ action: 'resetPassword', resetToken: resetToken ?? '', password }))),
    logout: () => {
      if (token) void api({ action: 'logout', token }).catch(() => undefined);
      signOut();
    },
    create: (houseName) =>
      attempt(async () => enterHouse(await api({
            action: 'createHouse',
            token: token!,
            houseName,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }), true)),
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
          // Com responsável, conta como feita por ele; sem, por quem marcou.
          else {
            const assigned = t.assignee && view.members.some((m) => m.id === t.assignee);
            completions[day] = assigned ? t.assignee! : view.meId;
          }
          return { ...t, completions };
        }),
      });
      void send({ action: 'toggleTask', token, taskId: id, date: day });
    },
    addTask: (title, assignee, date, repeat, points) => {
      if (!token || !view) return;
      // Volta para a home na hora, já mostrando a tarefa; a resposta do servidor confirma.
      setView({
        ...view,
        tasks: [
          { id: -Date.now(), title, assignee, createdBy: view.meId, date, repeat, completions: {}, points },
          ...view.tasks,
        ],
      });
      setScreen('tasks');
      void send({ action: 'addTask', token, title, assignee, date, repeat, points });
    },
    openEdit: (id, day) => {
      setEditingId(id);
      setEditingDay(day ?? null);
      setScreen('editTask');
    },
    saveTask: (id, title, assignee, date, repeat, points) => {
      if (!token || !view) return;
      // Volta para a home na hora, já com a tarefa mudada; a resposta do servidor confirma.
      setView({
        ...view,
        tasks: view.tasks.map((t) => (t.id === id ? { ...t, title, assignee, date, repeat, points } : t)),
      });
      setScreen('tasks');
      void send({ action: 'editTask', token, taskId: id, title, assignee, date, repeat, points });
    },
    saveOccurrence: (id, day, title, assignee, points) => {
      if (!token || !view) return;
      // Na hora: o dia sai da repetição e aparece a versão avulsa; o servidor confirma.
      const old = view.tasks.find((t) => t.id === id);
      const done = old?.completions[day];
      setView({
        ...view,
        tasks: [
          {
            id: -Date.now(),
            title,
            assignee,
            createdBy: old?.createdBy ?? view.meId,
            date: day,
            repeat: null,
            completions: done ? { [day]: done } : {},
            points,
          },
          ...view.tasks.map((t) => (t.id === id ? { ...t, skips: [...(t.skips ?? []), day] } : t)),
        ],
      });
      setScreen('tasks');
      void send({ action: 'editOccurrence', token, taskId: id, date: day, title, assignee, points });
    },
    deleteTask: (id) => {
      if (!token || !view) return;
      setView({ ...view, tasks: view.tasks.filter((t) => t.id !== id) });
      void send({ action: 'deleteTask', token, taskId: id });
    },
    skipOccurrence: (id, day) => {
      if (!token || !view) return;
      setView({
        ...view,
        tasks: view.tasks.map((t) => (t.id === id ? { ...t, skips: [...(t.skips ?? []), day] } : t)),
      });
      void send({ action: 'skipOccurrence', token, taskId: id, date: day });
    },
    removeMember: (id) => token && void send({ action: 'removeMember', token, memberId: id }),
    newCode: () => token && void send({ action: 'newCode', token }),
    getStats: async () => {
      if (!token) return null;
      const res = await send({ action: 'getStats', token });
      return res?.stats ?? null;
    },
    renameHouse: (name) =>
      attempt(async () => {
        const res = await api({ action: 'renameHouse', token: token!, name });
        apply(res);
      }),
    setPhoto: (photo) =>
      attempt(async () => {
        const res = await api({ action: 'setPhoto', token: token!, photo });
        apply(res);
      }),
    setGame: (period, closingDay, reward) =>
      attempt(async () => {
        const res = await api({ action: 'setGame', token: token!, period, closingDay, reward });
        apply(res);
      }),
    takePoint: (memberId, reason) =>
      attempt(async () => {
        const res = await api({ action: 'takePoint', token: token!, memberId, reason });
        apply(res);
      }),
    dismissPenalty: (id) => {
      if (!token || !view) return;
      setView({ ...view, penalties: view.penalties.map((x) => (x.id === id ? { ...x, dismissed: true } : x)) });
      void send({ action: 'dismissPenalty', token, penaltyId: id });
    },
    stopGame: () => {
      if (!token) return;
      if (!window.confirm('Tirar o prêmio do mês? Os pontos continuam valendo e aparecendo para todos.')) return;
      void send({ action: 'stopGame', token });
    },
    leave: () => {
      if (!token) return;
      if (!window.confirm('Sair desta casa? Para voltar, você vai precisar do código.')) return;
      hadHouse.current = false;
      void send({ action: 'leave', token });
      setScreen('home');
    },
  };

  const inHouse = ['tasks', 'newTask', 'editTask', 'settings', 'score', 'metrics'].includes(screen);
  const tab = view && isTabScreen(screen) ? screen : null;
  const editing = view?.tasks.find((t) => t.id === editingId) ?? null;

  return (
    <main className="app">
      {booting ? (
        <div className="screen loading" aria-live="polite">Carregando…</div>
      ) : (
        <>
          {screen === 'welcome' && <Welcome actions={actions} />}
          {screen === 'signup' && <Signup actions={actions} />}
          {screen === 'login' && <Login actions={actions} />}
          {screen === 'forgot' && <Forgot actions={actions} />}
          {screen === 'reset' && <ResetPassword actions={actions} />}
          {screen === 'home' && account && <Home account={account} actions={actions} />}
          {screen === 'create' && <CreateHouse actions={actions} />}
          {screen === 'join' && <JoinHouse actions={actions} />}
          {inHouse && !view && <div className="screen loading" aria-live="polite">Carregando a casa…</div>}
          {tab && view && (
            <div className="tab-layout">
              <div className="tab-layout__content">
                {tab === 'tasks' && <Tasks view={view} period={period} fresh={fresh} actions={actions} />}
                {tab === 'score' && <Score view={view} actions={actions} />}
                {tab === 'metrics' && <Metrics view={view} actions={actions} />}
                {tab === 'settings' && account && <Settings view={view} account={account} actions={actions} />}
              </div>
              <TabBar current={tab} onGo={(s) => actions.go(s)} />
            </div>
          )}
          {screen === 'newTask' && view && <NewTask view={view} actions={actions} />}
          {screen === 'editTask' && view && editing && (
            <NewTask
              key={`${editing.id}-${editingDay ?? 'todas'}`}
              view={view}
              task={editing}
              onlyDay={editing.repeat ? (editingDay ?? undefined) : undefined}
              actions={actions}
            />
          )}
          {screen === 'editTask' && view && !editing && (
            <div className="screen loading">
              Essa tarefa foi apagada.
              <Button variant="secondary" style={{ marginTop: 16, padding: '0 20px' }} onClick={() => actions.go('tasks')}>
                Voltar para tarefas
              </Button>
            </div>
          )}
          {screen === 'profile' && account && (
            <Profile
              account={account}
              avatar={view ? avatarFor(view, view.meId) : { bg: '#DDE3F0', fg: '#2C3F6B', initial: account.name.charAt(0).toUpperCase() }}
              actions={actions}
            />
          )}
        </>
      )}
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button type="button" className="notice__close" aria-label="Fechar aviso" onClick={() => setNotice(null)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
    </main>
  );
}
