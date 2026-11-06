import { useEffect, useRef, useState } from 'react';
import { Button, Chip, Icon, IconButton, TextField } from '../components/ui';
import type { Action, State } from '../state';

export function NewTaskSheet({ state: s, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const close = () => dispatch({ type: 'closeSheet' });
  const disabled = !title.trim();

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options = [
    { id: null as string | null, label: 'Qualquer um' },
    ...s.members.map((m) => ({ id: m.id as string | null, label: m.id === s.meId ? 'Eu' : m.name })),
  ];

  return (
    <div className="sheet">
      <button type="button" className="sheet__scrim" aria-label="Fechar" onClick={close} />
      <form
        className="sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled) dispatch({ type: 'addTask', title: title.trim(), assignee });
        }}
      >
        <div className="sheet__grabber" aria-hidden="true" />
        <div className="sheet__head">
          <h2 id="sheet-title" className="title-s">Nova tarefa</h2>
          <IconButton label="Fechar" style={{ marginRight: -10 }} onClick={close}>
            <Icon name="close" size={22} />
          </IconButton>
        </div>
        <TextField
          ref={inputRef}
          id="f-task"
          label="O que precisa ser feito?"
          placeholder="Ex.: Lavar a louça"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="field" style={{ gap: 10 }}>
          <span className="field-label" id="assignee-label">Para quem?</span>
          <div className="chips" role="group" aria-labelledby="assignee-label">
            {options.map((o) => (
              <Chip key={o.id ?? 'any'} pressed={assignee === o.id} onClick={() => setAssignee(o.id)}>
                {o.label}
              </Chip>
            ))}
          </div>
        </div>
        <Button type="submit" disabled={disabled} style={{ marginTop: 6 }}>Adicionar tarefa</Button>
      </form>
    </div>
  );
}
