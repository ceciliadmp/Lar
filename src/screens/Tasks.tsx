import { useCallback, useState } from 'react';
import { Avatar, Button, Icon, IconButton } from '../components/ui';
import { RowMenu } from '../components/Menu';
import { ConfirmDialog } from '../components/Dialog';
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
  shortDayLabel,
  shortDate,
  weekdayLong,
  type HouseView,
  type Occurrence,
  type Period,
  type Task,
} from '../state';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'week', label: 'Semana' },
  { id: 'all', label: 'Todas' },
];

/** Quantas pessoas aparecem no placar do topo antes de "+N". */
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

  // Hoje, ou os próximos 7 dias a partir de hoje (amanhã aparece na semana).
  const offsets = period === 'today' ? [0] : [0, 1, 2, 3, 4, 5, 6];
  const days = offsets.map((i) => {
    const date = addDays(now, i);
    const name = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : weekdayLong(date.getDay());
    const sub = i <= 1 ? longDate(date) : shortDate(date);
    return { key: dayKey(date), name, sub, items: occurrencesOn(s.tasks, date, todayKey) };
  });

  // Pendentes primeiro; atrasadas no topo.
  const sorted = (items: Occurrence[]) =>
    [...items].sort((a, b) => Number(!!a.doneBy) - Number(!!b.doneBy) || Number(!a.lateFrom) - Number(!b.lateFrom));

  const showInvite = fresh && s.members.length === 1;
  const goMembers = () => actions.go('members');

  const table = s.game.standings;
  const scoreLabel =
    'Placar: ' +
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
          <Button
            variant="secondary"
            className="square-btn"
            aria-label={`Membros e convite de ${s.house.name}`}
            onClick={goMembers}
          >
            <Icon name="users" size={18} />
          </Button>
          {/* Pontos do mês de cada pessoa, à esquerda da foto; toque para ver o placar. */}
          <button type="button" className="score-mini" aria-label={scoreLabel} onClick={() => actions.go('score')}>
            {table.slice(0, STRIP_MAX).map((row) => (
              <span key={row.memberId} className="score-mini__person" aria-hidden="true">
                <strong>{row.points}</strong>
                <Avatar info={avatarFor(s, row.memberId)} size="md" />
              </span>
            ))}
            {table.length > STRIP_MAX && (
              <span className="score-mini__more" aria-hidden="true">
                +{table.length - STRIP_MAX}
              </span>
            )}
          </button>
        </div>
        <div className="tasks__title">
          <div className="tasks__heading">
            <h1 className="title-l">Tarefas</h1>
            <p className="tasks__subtitle">{s.house.name}</p>
          </div>
          <Button className="new-task-btn square-btn" aria-label="Nova tarefa" onClick={() => actions.go('newTask')}>
            <Icon name="plus" size={16} strokeWidth={2.4} />
          </Button>
        </div>

        <div className="segmented segmented--3 tasks__tabs" role="group" aria-label="Período">
          {PERIODS.map((p) => (
            <button key={p.id} type="button" aria-pressed={period === p.id} onClick={() => actions.setPeriod(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tasks__body">
        {/* Avisos de ponto perdido: ficam até a pessoa fechar. */}
        {s.penalties
          .filter((p) => p.to === s.meId && !p.dismissed)
          .map((p) => (
            <div key={p.id} className="penalty" role="status">
              <div className="penalty__text">
                <strong>Você perdeu 1 ponto</strong>
                <span>
                  {nameOf(s, p.from)} tirou 1 ponto seu: “{p.reason}”
                </span>
              </div>
              <IconButton label="Fechar aviso" className="penalty__close" onClick={() => actions.dismissPenalty(p.id)}>
                <Icon name="close" size={16} />
              </IconButton>
            </div>
          ))}
        {showInvite && (
          <div className="card" style={{ marginBottom: 12 }}>
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
        ) : period === 'all' ? (
          <AllTasks view={s} actions={actions} />
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
    </div>
  );
}

/** "hoje", "amanhã" ou "seg 9" */
function dayLabel(key: string): string {
  const today = dayKey(new Date());
  if (key === today) return 'hoje';
  if (key === dayKey(addDays(new Date(), 1))) return 'amanhã';
  return shortDayLabel(key);
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

  const [confirming, setConfirming] = useState(false);
  const close = useCallback(() => setConfirming(false), []);

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
      <TaskText task={t} meta={meta} late={!!o.lateFrom} />
      <Avatar info={avatarFor(s, done ? o.doneBy : t.assignee)} />
      <RowMenu
        label={`Opções: ${t.title}`}
        items={[
          { label: 'Editar', onSelect: () => actions.openEdit(t.id) },
          { label: 'Excluir', danger: true, onSelect: () => setConfirming(true) },
        ]}
      />
      {confirming && <DeleteDialog task={t} day={o.key} onClose={close} actions={actions} />}
    </li>
  );
}

/** Título e detalhes de uma tarefa. */
function TaskText({ task: t, meta, late }: { task: Task; meta: string; late?: boolean }) {
  return (
    <div className="task__text">
      <span className="task__title">
        {t.title}
        <span className="pts-tag" title={`Vale ${pts(t.points ?? 1)}`}>
          <span aria-hidden="true">+{t.points ?? 1}</span>
          <span className="sr-only">, vale {pts(t.points ?? 1)}</span>
        </span>
      </span>
      <span className={late ? 'caption caption--late' : 'caption'}>{meta}</span>
    </div>
  );
}

/**
 * Confirmação de exclusão. Recorrente vista num dia: só esta, todas ou cancelar.
 * Recorrente na lista "Todas" (sem dia): excluir todas ou cancelar.
 */
function DeleteDialog({
  task: t,
  day,
  onClose,
  actions,
}: {
  task: Task;
  day: string | null;
  onClose: () => void;
  actions: Actions;
}) {
  const removeAll = {
    label: t.repeat ? 'Excluir todas' : 'Excluir',
    variant: 'danger' as const,
    onClick: () => {
      onClose();
      actions.deleteTask(t.id);
    },
  };
  if (t.repeat && day) {
    return (
      <ConfirmDialog
        title="Excluir tarefa que se repete?"
        onCancel={onClose}
        actions={[
          {
            label: `Excluir só esta (${dayLabel(day)})`,
            variant: 'secondary',
            onClick: () => {
              onClose();
              actions.skipOccurrence(t.id, day);
            },
          },
          removeAll,
        ]}
      >
        “{t.title}” se repete ({describeRepeat(t.repeat)}). Você pode excluir só a de {dayLabel(day)} ou todas as
        repetições, para todo mundo da casa.
      </ConfirmDialog>
    );
  }
  return (
    <ConfirmDialog
      title={t.repeat ? 'Excluir tarefa que se repete?' : 'Excluir tarefa?'}
      onCancel={onClose}
      actions={[removeAll]}
    >
      {t.repeat
        ? `“${t.title}” se repete (${describeRepeat(t.repeat)}) e vai sumir de todos os dias, para todo mundo da casa.`
        : `“${t.title}” vai sumir para todo mundo da casa.`}
    </ConfirmDialog>
  );
}

/** Aba "Todas": cada tarefa atual uma vez só, sem caixa de marcar. */
function AllTasks({ view: s, actions }: { view: HouseView; actions: Actions }) {
  const todayKey = dayKey(new Date());
  const byTitle = (a: Task, b: Task) => a.title.localeCompare(b.title, 'pt-BR');
  const repeating = s.tasks.filter((t) => t.repeat).sort(byTitle);
  // Avulsas atuais: de hoje em diante, ou atrasadas que ninguém fez.
  const once = s.tasks
    .filter((t) => !t.repeat && t.date && (t.date >= todayKey || !t.completions[t.date]))
    .sort((a, b) => a.date!.localeCompare(b.date!) || byTitle(a, b));

  const groups = [
    { id: 'repeat', title: 'Toda semana', items: repeating },
    { id: 'once', title: 'Avulsas', items: once },
  ];

  return (
    <>
      {groups.map((g) => (
        <section key={g.id} className="day" aria-labelledby={`all-${g.id}`}>
          <h2 id={`all-${g.id}`} className="day__title">
            {g.title} <span>· {g.items.length}</span>
          </h2>
          {g.items.length === 0 ? (
            <p className="day__empty">
              {g.id === 'repeat' ? 'Nenhuma tarefa se repete.' : 'Nenhuma tarefa avulsa pendente.'}
            </p>
          ) : (
            <ul className="list">
              {g.items.map((t) => (
                <AllRow key={t.id} task={t} view={s} todayKey={todayKey} actions={actions} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}

function AllRow({
  task: t,
  view: s,
  todayKey,
  actions,
}: {
  task: Task;
  view: HouseView;
  todayKey: string;
  actions: Actions;
}) {
  const [confirming, setConfirming] = useState(false);
  const close = useCallback(() => setConfirming(false), []);
  const late = !t.repeat && !!t.date && t.date < todayKey;
  const when = t.repeat
    ? capitalize(describeRepeat(t.repeat))
    : late
      ? capitalize(lateLabel(t.date!))
      : capitalize(dayLabel(t.date!));
  const meta = [
    when,
    `para ${t.assignee ? nameOf(s, t.assignee) : 'qualquer um'}`,
    `criada por ${nameOf(s, t.createdBy)}`,
  ].join(' · ');
  return (
    <li className="task task--all">
      <TaskText task={t} meta={meta} late={late} />
      <Avatar info={avatarFor(s, t.assignee)} />
      <RowMenu
        label={`Opções: ${t.title}`}
        items={[
          { label: 'Editar', onSelect: () => actions.openEdit(t.id) },
          { label: 'Excluir', danger: true, onSelect: () => setConfirming(true) },
        ]}
      />
      {confirming && <DeleteDialog task={t} day={null} onClose={close} actions={actions} />}
    </li>
  );
}

const capitalize = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
