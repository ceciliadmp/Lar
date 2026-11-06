import { useState } from 'react';
import { Avatar, BackButton, Button, Icon } from '../components/ui';
import { avatarFor, isAdmin, type Action, type State } from '../state';

export function Members({ state: s, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  const [copied, setCopied] = useState(false);
  const admin = isAdmin(s);

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(s.house.code);
    } catch {
      /* clipboard indisponível: só mostra o feedback */
    }
    setCopied(true);
  };

  return (
    <div className="screen members">
      <BackButton label="Voltar para tarefas" onClick={() => dispatch({ type: 'go', screen: 'tasks' })} />
      <span className="eyebrow" style={{ marginTop: 16 }}>{s.house.name}</span>
      <h1 className="title-m" style={{ marginTop: 4 }}>Membros</h1>

      <div className="card card--invite">
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>Código de convite</span>
        <span className="invite-code">{s.house.code}</span>
        <span className="caption">Quem tiver o código entra em “Entrar com um código”.</span>
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button size="sm" onClick={copy}>
            <Icon name="copy" size={16} />
            {copied ? 'Copiado' : 'Copiar código'}
          </Button>
          {admin && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                dispatch({ type: 'newCode' });
                setCopied(false);
              }}
            >
              Gerar novo código
            </Button>
          )}
        </div>
      </div>

      <ul className="list" style={{ marginTop: 20 }}>
        {s.members.map((m) => {
          const pending = s.tasks.filter((t) => t.assignee === m.id && !t.done).length;
          const role = m.role === 'admin' ? 'Administrador' : 'Membro';
          return (
            <li key={m.id} className="member">
              <Avatar info={avatarFor(s, m.id)} size="lg" />
              <div className="member__text">
                <span className="member__name">{m.id === s.meId ? `${m.name} (você)` : m.name}</span>
                <span className="caption">
                  {role} · {pending === 1 ? '1 tarefa pendente' : `${pending} tarefas pendentes`}
                </span>
              </div>
              {admin && m.id !== s.meId && (
                <Button
                  variant="danger-text"
                  size="sm"
                  style={{ padding: '0 12px', borderRadius: 10 }}
                  aria-label={`Remover ${m.name} da casa`}
                  onClick={() => dispatch({ type: 'removeMember', id: m.id })}
                >
                  Remover
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="spacer" style={{ minHeight: 24 }} />
      <Button variant="ghost" style={{ height: 48, fontSize: 14 }} onClick={() => dispatch({ type: 'leave' })}>
        Sair da casa
      </Button>
    </div>
  );
}
