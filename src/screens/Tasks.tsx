import { Avatar, Button, Chip, Icon, IconButton } from '../components/ui';
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
  type Filter,
  type HouseView,
  type Occurrence,
} from '../state';

export function Tasks({
  view: s,
  filter,
  fresh,
  actions,
}: {
  view: HouseView;
  filter: Filter;
  fresh: boolean;
  actions: Actions;
}) {
  const me = s.meId;
  const now = new Date();
  const todayKey = dayKey(now);
  const days = [
    { label: 'Hoje', date: now },
    { label: 'Amanhã', date: addDays(now, 1) },
  ].map((d) => ({ ...d, items: occurrencesOn(s.tasks, d.date, todayKey) }));

  const today = days[0].items;
  const doneToday = today.filter((o) => o.doneBy).length;
  const mineCount = days.reduce((n, d) => n + d.items.filter((o) => o.task.assignee === me && !o.doneBy).length, 0);

  const applyFilter = (items: Occurrence[]) => {
    let list = items;
    if (filter === 'mine') list = list.filter((o) => o.task.assignee === me && !o.doneBy);
    if (filter === 'done') list = list.filter((o) => o.doneBy);
    // Pendentes primeiro; atrasadas no topo.
    return [...list].sort(
      (a, b) => Number(!!a.doneBy) - Number(!!b.doneBy) || Number(!a.lateFrom) - Number(!b.lateFrom),
    );
  };

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Todas' },
    { id: 'mine', label: mineCount ? `Minhas · ${mineCount}` : 'Minhas' },
    { id: 'done', label: 'Feitas' },
  ];

  const emptyText =
    filter === 'mine' ? 'Nada com você.' : filter === 'done' ? 'Nada feito ainda.' : 'Nada marcado para este dia.';

  const pct = today.length ? Math.round((doneToday / today.length) * 100) : 0;
  const showInvite = fresh && s.members.length === 1;
  const goMembers = () => actions.go('members');

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
        <div className="progress">
          <span>{today.length ? `${doneToday} de ${today.length} feitas hoje` : 'Nada para hoje'}</span>
          <div className="progress__track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso de hoje">
            <div className="progress__bar" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="chips" style={{ marginTop: 22, flexWrap: 'nowrap' }}>
          {filters.map((f) => (
            <Chip key={f.id} filter pressed={filter === f.id} onClick={() => actions.setFilter(f.id)}>
              {f.label}
            </Chip>
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
            const list = applyFilter(d.items);
            return (
              <section key={d.label} className="day" aria-labelledby={`day-${d.label}`}>
                <h2 id={`day-${d.label}`} className="day__title">
                  {d.label} <span>· {longDate(d.date)}</span>
                </h2>
                {list.length === 0 ? (
                  <p className="day__empty">{emptyText}</p>
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

      <button type="button" className="fab" aria-label="Nova tarefa" onClick={() => actions.openSheet()}>
        <Icon name="plus" size={26} strokeWidth={2.2} />
      </button>
    </div>
  );
}

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
        <span className="task__box">{done && <Icon name="check" size={14} strokeWidth={3} />}</span>
      </button>
      <div className="task__text">
        <span className="task__title">
          {t.repeat && (
            <span className="task__repeat" title={describeRepeat(t.repeat)}>
              <Icon name="repeat" size={14} />
            </span>
          )}
          {t.title}
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
