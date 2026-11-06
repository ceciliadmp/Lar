import { useState, type FormEvent } from 'react';
import type { Actions } from '../App';
import { BackButton, Button, Icon, TextField } from '../components/ui';

export function Welcome({ actions }: { actions: Actions }) {
  return (
    <div className="screen welcome">
      <div className="logo" style={{ color: '#fff' }}>
        <Icon name="home" size={28} />
      </div>
      <h1 className="title-xl" style={{ marginTop: 28 }}>Lar</h1>
      <p style={{ marginTop: 12, fontSize: 18, lineHeight: 1.45, color: 'var(--ink-2)', maxWidth: 290 }}>
        As tarefas da casa num só lugar, divididas entre todo mundo que mora nela.
      </p>
      <div className="spacer" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Button onClick={() => actions.go('create')}>Criar uma casa</Button>
        <Button variant="secondary" onClick={() => actions.go('join')}>
          Entrar com um código
        </Button>
        <p className="caption" style={{ marginTop: 8, textAlign: 'center' }}>
          Quem cria a casa vira o administrador e convida os outros.
        </p>
      </div>
    </div>
  );
}

/** Estado comum dos dois formulários: enviando e mensagem de erro. */
function useSubmit(run: () => Promise<string | null>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const err = await run();
    setBusy(false);
    setError(err);
  };
  return { busy, error, onSubmit };
}

export function CreateHouse({ actions }: { actions: Actions }) {
  const [house, setHouse] = useState('');
  const [name, setName] = useState('');
  const disabled = !(house.trim() && name.trim());
  const { busy, error, onSubmit } = useSubmit(() => actions.create(house.trim(), name.trim()));

  return (
    <form className="screen" onSubmit={onSubmit}>
      <BackButton onClick={() => actions.go('welcome')} />
      <h1 className="title-m" style={{ marginTop: 16 }}>Criar casa</h1>
      <p className="lead" style={{ margin: '8px 0 28px' }}>
        Você será o administrador e receberá um código para convidar as pessoas.
      </p>
      <div className="fields">
        <TextField id="f-house" label="Nome da casa" placeholder="Ex.: Apartamento 302" value={house} onChange={(e) => setHouse(e.target.value)} />
        <TextField id="f-name-c" label="Seu nome" placeholder="Como os outros vão te ver" value={name} onChange={(e) => setName(e.target.value)} />
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <div className="spacer" />
      <Button type="submit" disabled={disabled || busy}>{busy ? 'Criando…' : 'Criar casa'}</Button>
    </form>
  );
}

export function JoinHouse({ actions }: { actions: Actions }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const disabled = !(code.trim() && name.trim());
  const { busy, error, onSubmit } = useSubmit(() => actions.join(code.trim(), name.trim()));

  return (
    <form className="screen" onSubmit={onSubmit}>
      <BackButton onClick={() => actions.go('welcome')} />
      <h1 className="title-m" style={{ marginTop: 16 }}>Entrar numa casa</h1>
      <p className="lead" style={{ margin: '8px 0 28px' }}>Peça o código para quem administra a casa.</p>
      <div className="fields">
        <TextField
          id="f-code"
          label="Código da casa"
          placeholder="ABC-123"
          className="code-input"
          autoCapitalize="characters"
          autoComplete="off"
          value={code}
          aria-invalid={!!error}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <TextField id="f-name-j" label="Seu nome" placeholder="Como os outros vão te ver" value={name} onChange={(e) => setName(e.target.value)} />
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <div className="spacer" />
      <Button type="submit" disabled={disabled || busy}>{busy ? 'Entrando…' : 'Entrar'}</Button>
    </form>
  );
}
