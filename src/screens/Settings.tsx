import { useState } from 'react';
import { Avatar, Button, Icon, TextField } from '../components/ui';
import { PhotoEditor } from '../components/PhotoEditor';
import type { Actions } from '../App';
import { useSubmit } from '../useSubmit';
import { avatarFor, dayKey, isAdmin, occurrencesOn, type Account, type HouseView } from '../state';

/** Aba Configurações: seu perfil e foto, a casa (nome e convite) e os membros. */
export function Settings({ view: s, account, actions }: { view: HouseView; account: Account; actions: Actions }) {
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
    <div className="screen tab-screen">
      <h1 className="title-l">Configurações</h1>

      <h2 className="section-title">Seu perfil</h2>
      <div className="card">
        <PhotoEditor account={account} avatar={avatarFor(s, s.meId)} actions={actions} compact />
      </div>

      <h2 className="section-title">Casa</h2>
      {admin ? (
        <HouseName name={s.house.name} actions={actions} />
      ) : (
        <div className="card">
          <span className="caption">Nome da casa</span>
          <span style={{ fontSize: 17, fontWeight: 600 }}>{s.house.name}</span>
          <span className="caption">Só quem administra a casa pode mudar o nome.</span>
        </div>
      )}

      <div className="card card--invite" style={{ marginTop: 12 }}>
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

      <h2 className="section-title" id="membros">
        Membros <span className="section-title__count">· {s.members.length}</span>
      </h2>
      <ul className="list">
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

/** Só o admin: muda o nome da casa. */
function HouseName({ name, actions }: { name: string; actions: Actions }) {
  const [value, setValue] = useState(name);
  const [saved, setSaved] = useState(false);
  const { busy, error, onSubmit } = useSubmit(async () => {
    setSaved(false);
    const err = await actions.renameHouse(value.trim());
    if (!err) setSaved(true);
    return err;
  });
  return (
    <form className="card settings" style={{ marginTop: 0 }} onSubmit={onSubmit}>
      <TextField
        id="f-house-name"
        label="Nome da casa"
        maxLength={60}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      {saved && !error && (
        <p className="form-ok" role="status">
          Nome salvo.
        </p>
      )}
      <Button type="submit" variant="secondary" disabled={!value.trim() || value.trim() === name || busy}>
        {busy ? 'Salvando…' : 'Salvar nome'}
      </Button>
    </form>
  );
}
