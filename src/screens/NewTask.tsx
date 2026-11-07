import { useEffect, useRef, useState } from 'react';
import { BackButton, Button, Chip, TextField } from '../components/ui';
import type { Actions } from '../App';
import { dayKey, WEEK_ORDER, weekdayShort, type HouseView } from '../state';

type Mode = 'once' | 'repeat';

/** Tela cheia para criar uma tarefa; ao adicionar, volta sozinha para a home. */
export function NewTask({ view: s, actions }: { view: HouseView; actions: Actions }) {
  const today = new Date();
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('once');
  // Mínimo obrigatório: 1 ponto, já marcado.
  const [points, setPoints] = useState(1);
  const [repeat, setRepeat] = useState<number[]>([today.getDay()]);
  const inputRef = useRef<HTMLInputElement>(null);
  const disabled = !title.trim() || (mode === 'repeat' && repeat.length === 0);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const people = [
    { id: null as string | null, label: 'Qualquer um' },
    ...s.members.map((m) => ({ id: m.id as string | null, label: m.id === s.meId ? 'Eu' : m.name })),
  ];

  const toggleDay = (d: number) =>
    setRepeat((r) => (r.includes(d) ? r.filter((x) => x !== d) : [...r, d]));

  return (
    <form
      className="screen new-task"
      onSubmit={(e) => {
        e.preventDefault();
        if (disabled) return;
        // Avulsa é sempre para hoje.
        actions.addTask(
          title.trim(),
          assignee,
          mode === 'once' ? dayKey(today) : null,
          mode === 'repeat' ? repeat : null,
          points,
        );
      }}
    >
      <BackButton label="Cancelar e voltar para tarefas" onClick={() => actions.go('tasks')} />
      <h1 className="title-m" style={{ marginTop: 16 }}>Nova tarefa</h1>

      <div className="fields" style={{ marginTop: 24, gap: 24 }}>
        <TextField
          ref={inputRef}
          id="f-task"
          label="O que precisa ser feito?"
          placeholder="Ex.: Lavar a louça"
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="field" style={{ gap: 10 }}>
          <span className="field-label" id="when-label">Quando?</span>
          <div className="segmented" role="radiogroup" aria-labelledby="when-label">
            <button type="button" role="radio" aria-checked={mode === 'once'} onClick={() => setMode('once')}>
              Só hoje
            </button>
            <button type="button" role="radio" aria-checked={mode === 'repeat'} onClick={() => setMode('repeat')}>
              Toda semana
            </button>
          </div>
          {mode === 'repeat' && (
            <div className="weekdays" role="group" aria-label="Dias da semana">
              {WEEK_ORDER.map((d) => (
                <Chip key={d} pressed={repeat.includes(d)} onClick={() => toggleDay(d)}>
                  {weekdayShort(d)}
                </Chip>
              ))}
            </div>
          )}
        </div>

        <div className="field" style={{ gap: 10 }}>
          <span className="field-label" id="points-label">Quantos pontos vale?</span>
          <div className="segmented segmented--3" role="radiogroup" aria-labelledby="points-label">
            {[1, 2, 3].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={points === n} onClick={() => setPoints(n)}>
                {n} {n === 1 ? 'ponto' : 'pontos'}
              </button>
            ))}
          </div>
        </div>

        <div className="field" style={{ gap: 10 }}>
          <span className="field-label" id="assignee-label">Para quem?</span>
          <div className="chips" role="group" aria-labelledby="assignee-label">
            {people.map((o) => (
              <Chip key={o.id ?? 'any'} pressed={assignee === o.id} onClick={() => setAssignee(o.id)}>
                {o.label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="spacer" style={{ minHeight: 24 }} />
      <Button type="submit" disabled={disabled}>
        Adicionar tarefa
      </Button>
    </form>
  );
}
