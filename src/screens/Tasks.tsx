import { Avatar, Button, Chip, Icon } from '../components/ui';
import type { Actions } from '../App';
import { avatarFor, nameOf, type Filter, type HouseView } from '../state';

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
  const total = s.tasks.length;
  const doneCount = s.tasks.filter((t) => t.done).length;
  const mineCount = s.tasks.filter((t) => t.assignee === me && !t.done).length;

  let list = s.tasks.slice();
  if (filter === 'mine') list = list.filter((t) => t.assignee === me && !t.done);
  if (filter === 'done') list = list.filter((t) => t.done);
  if (filter === 'all') list.sort((a, b) => Number(a.done) - Number(b.done));

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Todas' },
    { id: 'mine', label: mineCount ? `Minhas · ${mineCount}` : 'Minhas' },
    { id: 'done', label: 'Feitas' },
  ];

  let empty = { title: 'Nenhuma tarefa ainda', text: 'Toque em + para criar a primeira.' };
  if (total > 0 && filter === 'mine') empty = { title: 'Nada com você agora', text: 'Aproveite o descanso.' };
  if (total > 0 && filter === 'done') empty = { title: 'Nada concluído ainda', text: 'As tarefas feitas aparecem aqui.' };

  const pct = total ? Math.round((doneCount / total) * 100) : 0;
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
          <span>{total ? `${doneCount} de ${total} concluídas` : 'Sem tarefas por enquanto'}</span>
          <div className="progress__track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso">
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

        {list.length === 0 && (
          <div className="empty">
            <strong>{empty.title}</strong>
            <span>{empty.text}</span>
          </div>
        )}

        <ul className="list">
          {list.map((t) => {
            const meta = t.done
              ? `Feita por ${nameOf(s, t.doneBy)}`
              : `Para ${t.assignee ? nameOf(s, t.assignee) : 'qualquer um'} · criada por ${nameOf(s, t.createdBy)}`;
            return (
              <li key={t.id} className={t.done ? 'task task--done' : 'task'}>
                <button
                  type="button"
                  className="task__check"
                  aria-label={(t.done ? 'Reabrir: ' : 'Concluir: ') + t.title}
                  aria-pressed={t.done}
                  onClick={() => actions.toggleTask(t.id)}
                >
                  <span className="task__circle" style={{ color: '#fff' }}>
                    {t.done && <Icon name="check" size={14} strokeWidth={3} />}
                  </span>
                </button>
                <div className="task__text">
                  <span className="task__title">{t.title}</span>
                  <span className="caption">{meta}</span>
                </div>
                <Avatar info={avatarFor(s, t.done ? t.doneBy : t.assignee)} />
              </li>
            );
          })}
        </ul>
      </div>

      <button type="button" className="fab" aria-label="Nova tarefa" onClick={() => actions.openSheet()}>
        <Icon name="plus" size={26} strokeWidth={2.2} />
      </button>
    </div>
  );
}
