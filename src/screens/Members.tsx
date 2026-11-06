import { useState } from 'react';
import { Avatar, BackButton, Button, Icon } from '../components/ui';
import type { Actions } from '../App';
import { avatarFor, dayKey, isAdmin, occurrencesOn, type Account, type HouseView } from '../state';

export function Members({ view: s, account, actions }: { view: HouseView; account: Account; actions: Actions }) {
  const [copied, setCopied] = useState(false);
  const admin = isAdmin(s);
  const now = new Date();
  const today = occurrencesOn(s.tasks, now, dayKey(now)).filter((o) => !o.doneBy);

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
      <BackButton label="Voltar para tarefas" onClick={() => actions.go('tasks')} />
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
                actions.newCode();
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
          const pending = today.filter((o) => o.task.assignee === m.id).length;
          const role = m.role === 'admin' ? 'Administrador' : 'Membro';
          return (
            <li key={m.id} className="member">
              <Avatar info={avatarFor(s, m.id)} size="lg" />
              <div className="member__text">
                <span className="member__name">{m.id === s.meId ? `${m.name} (você)` : m.name}</span>
                <span className="caption">
                  {role} · {pending === 0 ? 'nada para hoje' : pending === 1 ? '1 tarefa hoje' : `${pending} tarefas hoje`}
                </span>
              </div>
              {admin && m.id !== s.meId && (
                <Button
                  variant="danger-text"
                  size="sm"
                  style={{ padding: '0 12px', borderRadius: 10 }}
                  aria-label={`Remover ${m.name} da casa`}
                  onClick={() => actions.removeMember(m.id)}
                >
                  Remover
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="spacer" style={{ minHeight: 24 }} />
      <div className="account">
        <span className="caption">Conta: {account.email}</span>
        <div className="account__actions">
          <Button variant="ghost" style={{ height: 48, fontSize: 14 }} onClick={() => actions.leave()}>
            Sair da casa
          </Button>
          <Button variant="ghost" style={{ height: 48, fontSize: 14 }} onClick={() => actions.logout()}>
            Sair da conta
          </Button>
        </div>
      </div>
    </div>
  );
}
