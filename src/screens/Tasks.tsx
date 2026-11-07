import { Avatar, Button, Icon, IconButton } from '../components/ui';
import type { Actions } from '../App';
import {
  addDays,
  avatarFor,
  dayKey,
  describeRepeat,
  lateLabel,
  longDate,
  nameOf,
  occurrencesOn,
  shortDate,
  weekdayLong,
  type HouseView,
  type Occurrence,
  type Period,
} from '../state';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'tomorrow', label: 'Amanhã' },
  { id: 'week', label: 'Semana' },
];

/** Quantos aparecem na faixa de pontos antes de "+N". */
const STRIP_MAX = 4;

export function Tasks({
  view: s,
  period,
  fresh,
  actions,
}: {
  view: HouseView;
  period: Period;
  fresh: boolean;
  actions: Actions;
}) {
  const now = new Date();
  const todayKey = dayKey(now);

  // Hoje, amanhã, ou os próximos 7 dias a partir de hoje.
  const offsets = period === 'today' ? [0] : period === 'tomorrow' ? [1] : [0, 1, 2, 3, 4, 5, 6];
  const days = offsets.map((i) => {
    const date = addDays(now, i);
    const name = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : weekdayLong(date.getDay());
    const sub = i <= 1 ? longDate(date) : shortDate(date);
    return { key: dayKey(date), name, sub, items: occurrencesOn(s.tasks, date, todayKey) };
  });

  const today = occurrencesOn(s.tasks, now, todayKey);
  const doneToday = today.filter((o) => o.doneBy).length;

  // Pendentes primeiro; atrasadas no topo.
  const sorted = (items: Occurrence[]) =>
    [...items].sort((a, b) => Number(!!a.doneBy) - Number(!!b.doneBy) || Number(!a.lateFrom) - Number(!b.lateFrom));

  const pct = today.length ? Math.round((doneToday / today.length) * 100) : 0;
  const showInvite = fresh && s.members.length === 1;
  const goMembers = () => actions.go('members');

  const table = s.game.standings;
  const scoreLabel =
    'Placar do mês: ' +
    table
      .map((row) => {
        const name = row.memberId === s.meId ? 'você' : (s.members.find((m) => m.id === row.memberId)?.name ?? '');
        return `${name} ${row.points}`;
      })
      .join(', ');

  return (
    <div className="tasks">
      <div className="tasks__head">
        <div className="tasks__top">
          <span className="eyebrow">{s.house.name}</span>
          <button type="button" className="avatar-stack" aria-label="Membros da casa" onClick={goMembers}>
            {s.members.slice(0, 3).map((m) => (
              <Avatar key={m.id} info={avatarFor(s, m.id)} size="md" />
            ))}
          </button>
        </div>
        <h1 className="title-l" style={{ marginTop: 12 }}>Tarefas</h1>

        {/* Pontos de todo mundo, sempre à vista; toque para ver o placar completo. */}
        <button type="button" className="score-strip" aria-label={scoreLabel} onClick={() => actions.go('score')}>
          <span className="score-strip__icon" aria-hidden="true">
            <Icon name="trophy" size={18} />
          </span>
          <span className="score-strip__people" aria-hidden="true">
            {table.slice(0, STRIP_MAX).map((row) => (
              <span key={row.memberId} className="score-strip__person">
                <Avatar info={avatarFor(s, row.memberId)} />
                <strong>{row.points}</strong>
              </span>
            ))}
            {table.length > STRIP_MAX && <span className="score-strip__more">+{table.length - STRIP_MAX}</span>}
          </span>
          <span className="score-strip__chevron" aria-hidden="true">
            <Icon name="chevron" size={16} />
          </span>
        </button>

        <div className="progress">
          <span>{today.length ? `${doneToday} de ${today.length} feitas hoje` : 'Nada para hoje'}</span>
          <div className="progress__track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso de hoje">
            <div className="progress__bar" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="segmented segmented--3" role="group" aria-label="Período" style={{ marginTop: 18 }}>
          {PERIODS.map((p) => (
            <button key={p.id} type="button" aria-pressed={period === p.id} onClick={() => actions.setPeriod(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tasks__body">
        {showInvite && (
          <div className="card" style={{ margin: '8px 0 12px' }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Sua casa está pronta</span>
            <span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--ink-2)' }}>
              Convide quem mora com você usando o código{' '}
              <strong style={{ color: 'var(--ink)', letterSpacing: '0.08em' }}>{s.house.code}</strong>.
            </span>
            <Button variant="soft" size="sm" style={{ alignSelf: 'flex-start' }} onClick={goMembers}>
              Ver convite
            </Button>
          </div>
        )}

        {s.tasks.length === 0 ? (
          <div className="empty">
            <strong>Nenhuma tarefa ainda</strong>
            <span>Toque em + para criar a primeira.</span>
          </div>
        ) : (
          days.map((d) => {
            const list = sorted(d.items);
            return (
              <section key={d.key} className="day" aria-labelledby={`day-${d.key}`}>
                <h2 id={`day-${d.key}`} className="day__title">
                  {d.name} <span>· {d.sub}</span>
                </h2>
                {list.length === 0 ? (
                  <p className="day__empty">Nada marcado para este dia.</p>
                ) : (
                  <ul className="list">
                    {list.map((o) => (
                      <TaskRow key={`${o.task.id}-${o.key}`} o={o} view={s} actions={actions} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })
        )}
      </div>

      <button type="button" className="fab" aria-label="Nova tarefa" onClick={() => actions.go('newTask')}>
        <Icon name="plus" size={22} strokeWidth={2.2} />
      </button>
    </div>
  );
}

const pts = (n: number) => (n === 1 ? '1 ponto' : `${n} pontos`);

function TaskRow({ o, view: s, actions }: { o: Occurrence; view: HouseView; actions: Actions }) {
  const t = o.task;
  const done = !!o.doneBy;
  const when = t.repeat ? describeRepeat(t.repeat) : o.lateFrom ? lateLabel(o.lateFrom) : null;
  const meta = done
    ? `Feita por ${nameOf(s, o.doneBy)}`
    : [`Para ${t.assignee ? nameOf(s, t.assignee) : 'qualquer um'}`, when, `criada por ${nameOf(s, t.createdBy)}`]
        .filter(Boolean)
        .join(' · ');

  const remove = () => {
    const msg = t.repeat
      ? `Apagar “${t.title}”? Ela se repete (${describeRepeat(t.repeat)}) e vai sumir de todos os dias, para todo mundo.`
      : `Apagar “${t.title}” para todo mundo?`;
    if (window.confirm(msg)) actions.deleteTask(t.id);
  };

  return (
    <li className={done ? 'task task--done' : 'task'}>
      <button
        type="button"
        className="task__check"
        aria-label={(done ? 'Reabrir: ' : 'Concluir: ') + t.title}
        aria-pressed={done}
        onClick={() => actions.toggleTask(t.id, o.key)}
      >
        <span className="task__box">{done && <Icon name="check" size={16} strokeWidth={3} />}</span>
      </button>
      <div className="task__text">
        <span className="task__title">
          {t.repeat && (
            <span className="task__repeat" title={describeRepeat(t.repeat)}>
              <Icon name="repeat" size={16} />
            </span>
          )}
          {t.title}
          <span className="pts-tag" title={`Vale ${pts(t.points ?? 1)}`}>
            <span aria-hidden="true">+{t.points ?? 1}</span>
            <span className="sr-only">, vale {pts(t.points ?? 1)}</span>
          </span>
        </span>
        <span className={o.lateFrom ? 'caption caption--late' : 'caption'}>{meta}</span>
      </div>
      <Avatar info={avatarFor(s, done ? o.doneBy : t.assignee)} />
      <IconButton label={`Apagar: ${t.title}`} className="task__delete" onClick={remove}>
        <Icon name="trash" size={18} />
      </IconButton>
    </li>
  );
}
