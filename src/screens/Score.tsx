import { useCallback, useState } from 'react';
import type { Actions } from '../App';
import { Avatar, BackButton, Button, TextField } from '../components/ui';
import { ConfirmDialog } from '../components/Dialog';
import { useSubmit } from '../useSubmit';
import {
  avatarFor,
  daysUntil,
  isAdmin,
  nameOf,
  shortDateKey,
  shortDayLabel,
  type GamePeriod,
  type GameView,
  type HouseView,
  type RoundResult,
} from '../state';

const CLOSING_OPTIONS = [
  ...Array.from({ length: 28 }, (_, i) => ({ value: i + 1, label: `Dia ${i + 1}` })),
  { value: 0, label: 'Último dia do mês' },
];

const closingLabel = (d: number) => (d === 0 ? 'no último dia do mês' : `todo dia ${d}`);
const pts = (n: number) => (Math.abs(n) === 1 ? `${n} ponto` : `${n} pontos`);
/** "mês" ou "quinzena", para os textos da tela. */
const roundName = (g: GameView) => (g.enabled && g.period === 'biweekly' ? 'quinzena' : 'mês');

export function Score({ view: s, actions }: { view: HouseView; actions: Actions }) {
  const admin = isAdmin(s);
  const g = s.game;
  const others = s.members.filter((m) => m.id !== s.meId);
  const taken = s.penalties.slice(0, 10);

  return (
    <div className="screen members">
      <BackButton label="Voltar para tarefas" onClick={() => actions.go('tasks')} />
      <span className="eyebrow" style={{ marginTop: 16 }}>{s.house.name}</span>
      <h1 className="title-m" style={{ marginTop: 4 }}>Placar</h1>

      {g.enabled ? (
        <RewardCard game={g} />
      ) : (
        <div className="card" style={{ marginTop: 24 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Ainda sem prêmio</span>
          <span className="lead" style={{ fontSize: 14 }}>
            {admin
              ? 'Os pontos já estão valendo. Escolha abaixo a frequência e uma recompensa para quem fizer mais pontos.'
              : 'Os pontos já estão valendo. Quem administra a casa pode escolher uma recompensa para quem fizer mais pontos.'}
          </span>
        </div>
      )}

      <h2 className="section-title">Ranking {roundName(g) === 'quinzena' ? 'da quinzena' : 'do mês'}</h2>
      <p className="caption">
        Cada tarefa vale de 1 a 3 pontos para quem a concluir. Rodada de {shortDateKey(g.start)} a{' '}
        {shortDateKey(g.end)}.
      </p>
      <ol className="list ranking">
        {g.standings.map((row, i) => {
          const m = s.members.find((x) => x.id === row.memberId)!;
          const leading = row.points > 0 && row.points === g.standings[0].points;
          return (
            <li key={row.memberId} className={leading ? 'rank rank--lead' : 'rank'}>
              <span className="rank__pos">{i + 1}º</span>
              <Avatar info={avatarFor(s, m.id)} size="lg" />
              <span className="rank__name">
                {m.id === s.meId ? `${m.name} (você)` : m.name}
                {leading && <span className="rank__badge">na frente</span>}
              </span>
              <span className="rank__pts">{row.points}</span>
            </li>
          );
        })}
      </ol>

      {g.history.length > 0 && <History rounds={g.history} />}

      {admin && <GameSettings game={g.enabled ? g : null} actions={actions} />}

      {/* Tirar pontos fica abaixo do cartão do prêmio, com o histórico logo depois. */}
      {others.length > 0 && <TakePoint view={s} actions={actions} />}

      {taken.length > 0 && (
        <>
          <h2 className="section-title">Pontos tirados</h2>
          <ul className="list">
            {taken.map((p) => (
              <li key={p.id} className="past">
                <span className="caption">{shortDayLabel(p.d)}</span>
                <span className="past__winner">
                  {nameOf(s, p.from)} tirou 1 ponto de {p.to === s.meId ? 'você' : nameOf(s, p.to)}
                </span>
                <span className="caption">“{p.reason}”</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Tirar 1 ponto de outra pessoa da casa, com justificativa curta. */
function TakePoint({ view: s, actions }: { view: HouseView; actions: Actions }) {
  const others = s.members.filter((m) => m.id !== s.meId);
  const pointsOf = (id: string) => s.game.standings.find((x) => x.memberId === id)?.points ?? 0;
  const [who, setWho] = useState('');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const close = useCallback(() => setConfirming(false), []);
  const target = others.find((m) => m.id === who);

  const { busy, error, onSubmit } = useSubmit(async () => {
    const err = await actions.takePoint(who, reason.trim());
    if (!err) {
      setDone(`Você tirou 1 ponto de ${target?.name}.`);
      setWho('');
      setReason('');
    }
    return err;
  });

  return (
    <form
      className="card settings"
      onSubmit={(e) => {
        e.preventDefault();
        setDone(null);
        setConfirming(true);
      }}
    >
      <span style={{ fontSize: 15, fontWeight: 600 }}>Tirar 1 ponto</span>
      <span className="caption" style={{ marginTop: -8 }}>
        A pessoa recebe um aviso com o motivo, e todos veem em “Pontos tirados”.
      </span>
      <div className="field">
        <label htmlFor="f-who">De quem?</label>
        <select
          id="f-who"
          className="select"
          value={who}
          onChange={(e) => {
            setWho(e.target.value);
            setDone(null);
          }}
        >
          <option value="">Escolha uma pessoa</option>
          {others.map((m) => (
            <option key={m.id} value={m.id} disabled={pointsOf(m.id) < 1}>
              {m.name} ({pts(pointsOf(m.id))}){pointsOf(m.id) < 1 ? ' — sem pontos' : ''}
            </option>
          ))}
        </select>
      </div>
      <TextField
        id="f-reason"
        label="Motivo"
        placeholder="Ex.: deixou a louça na pia"
        maxLength={120}
        value={reason}
        onChange={(e) => {
          setReason(e.target.value);
          setDone(null);
        }}
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      {done && !error && (
        <p className="form-ok" role="status">
          {done}
        </p>
      )}
      <Button type="submit" variant="secondary" disabled={!who || !reason.trim() || busy}>
        {busy ? 'Tirando…' : 'Tirar 1 ponto'}
      </Button>
      {confirming && target && (
        <ConfirmDialog
          title={`Tirar 1 ponto de ${target.name}?`}
          onCancel={close}
          actions={[
            {
              label: 'Tirar 1 ponto',
              variant: 'danger',
              onClick: () => {
                close();
                void onSubmit({ preventDefault() {} } as React.FormEvent);
              },
            },
          ]}
        >
          Motivo: “{reason.trim()}”. {target.name} vai receber um aviso.
        </ConfirmDialog>
      )}
    </form>
  );
}

function RewardCard({ game: g }: { game: GameView }) {
  const left = daysUntil(g.today, g.end);
  const when =
    left <= 0
      ? 'Termina hoje! Quem estiver na frente no fim do dia ganha.'
      : left === 1
        ? 'Termina amanhã.'
        : `Faltam ${left} dias.`;
  return (
    <div className="reward">
      <span className="reward__label">{g.period === 'biweekly' ? 'Prêmio da quinzena' : 'Prêmio do mês'}</span>
      <span className="reward__text">{g.reward}</span>
      <span className="reward__when">
        Rodada de {shortDateKey(g.start)} a {shortDateKey(g.end)} · {when}
      </span>
    </div>
  );
}

function winnerText(r: RoundResult): string {
  if (r.winners.length === 0) return 'Ninguém pontuou.';
  if (r.winners.length === 1) return `${r.winners[0].name} venceu com ${pts(r.winners[0].points)}.`;
  const names = r.winners.map((w) => w.name);
  return `Empate: ${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}, com ${pts(r.winners[0].points)}.`;
}

function History({ rounds }: { rounds: RoundResult[] }) {
  return (
    <>
      <h2 className="section-title">Rodadas anteriores</h2>
      <ul className="list">
        {rounds.map((r) => (
          <li key={r.end} className="past">
            <span className="caption">
              {shortDateKey(r.start)} a {shortDateKey(r.end)}
            </span>
            <span className="past__winner">{winnerText(r)}</span>
            <span className="caption">Prêmio: {r.reward}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function GameSettings({ game: g, actions }: { game: GameView | null; actions: Actions }) {
  const [period, setPeriod] = useState<GamePeriod>(g?.period ?? 'monthly');
  const [closingDay, setClosingDay] = useState(g?.closingDay ?? 0);
  const [reward, setReward] = useState(g?.reward ?? '');
  const [saved, setSaved] = useState(false);
  const { busy, error, onSubmit } = useSubmit(async () => {
    setSaved(false);
    const err = await actions.setGame(period, closingDay, reward.trim());
    if (!err) setSaved(true);
    return err;
  });
  const unchanged =
    !!g &&
    g.period === period &&
    (period === 'biweekly' || g.closingDay === closingDay) &&
    g.reward === reward.trim();

  return (
    <form className="card settings" onSubmit={onSubmit}>
      <span style={{ fontSize: 15, fontWeight: 600 }}>{g ? 'Prêmio' : 'Criar um prêmio'}</span>
      <div className="field" style={{ gap: 10 }}>
        <span className="field-label" id="period-label">
          Frequência
        </span>
        <div className="segmented" role="radiogroup" aria-labelledby="period-label">
          {(
            [
              ['monthly', 'Mensal'],
              ['biweekly', 'Quinzenal'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={period === id}
              onClick={() => {
                setPeriod(id);
                setSaved(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {period === 'monthly' ? (
        <div className="field">
          <label htmlFor="f-closing">Dia da premiação</label>
          <select
            id="f-closing"
            className="select"
            value={closingDay}
            onChange={(e) => {
              setClosingDay(Number(e.target.value));
              setSaved(false);
            }}
          >
            {CLOSING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="caption">
            A rodada fecha {closingLabel(closingDay)}. Contam os pontos desde o fechamento anterior.
          </span>
        </div>
      ) : (
        <span className="caption" style={{ marginTop: -6 }}>
          Duas rodadas por mês: do dia 1 ao 15 e do dia 16 ao último dia. A premiação é no último dia de cada uma.
        </span>
      )}
      <TextField
        id="f-reward"
        label="Recompensa"
        placeholder="Ex.: escolhe o filme de sábado"
        maxLength={120}
        value={reward}
        onChange={(e) => {
          setReward(e.target.value);
          setSaved(false);
        }}
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      {saved && !error && (
        <p className="form-ok" role="status">
          Prêmio salvo.
        </p>
      )}
      <Button type="submit" disabled={!reward.trim() || busy || unchanged}>
        {busy ? 'Salvando…' : g ? 'Salvar' : 'Criar prêmio'}
      </Button>
      {g && (
        <Button variant="danger-text" style={{ height: 44, fontSize: 14 }} onClick={() => actions.stopGame()}>
          Tirar o prêmio
        </Button>
      )}
    </form>
  );
}
