import { useState } from 'react';
import type { Actions } from '../App';
import type { Account } from '../state';
import { BackButton, Button, TextField } from '../components/ui';
import { useSubmit } from '../useSubmit';

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="password__toggle" aria-pressed={show} onClick={() => setShow((s) => !s)}>
          {show ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      {hint && (
        <span id={`${id}-hint`} className="caption">
          {hint}
        </span>
      )}
    </div>
  );
}

export function Signup({ actions }: { actions: Actions }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, onSubmit } = useSubmit(() => actions.signup(name.trim(), email.trim(), password));
  const disabled = !name.trim() || !email.trim() || password.length < 8;

  return (
    <form className="screen" onSubmit={onSubmit}>
      <BackButton onClick={() => actions.go('welcome')} />
      <h1 className="title-m" style={{ marginTop: 16 }}>Criar conta</h1>
      <p className="lead" style={{ margin: '8px 0 28px' }}>
        Com a conta, sua casa e suas tarefas ficam salvas em qualquer aparelho.
      </p>
      <div className="fields">
        <TextField id="f-name" label="Seu nome" placeholder="Como os outros vão te ver" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField id="f-email" label="E-mail" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="voce@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordField id="f-pass" label="Senha" autoComplete="new-password" value={password} onChange={setPassword} hint="Pelo menos 8 caracteres." />
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <div className="spacer" style={{ minHeight: 24 }} />
      <Button type="submit" disabled={disabled || busy}>{busy ? 'Criando…' : 'Criar conta'}</Button>
      <Button variant="ghost" style={{ marginTop: 8, height: 48, fontSize: 14 }} onClick={() => actions.go('login')}>
        Já tenho conta
      </Button>
    </form>
  );
}

export function Login({ actions }: { actions: Actions }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, onSubmit } = useSubmit(() => actions.login(email.trim(), password));

  return (
    <form className="screen" onSubmit={onSubmit}>
      <BackButton onClick={() => actions.go('welcome')} />
      <h1 className="title-m" style={{ marginTop: 16 }}>Entrar</h1>
      <p className="lead" style={{ margin: '8px 0 28px' }}>Use o e-mail e a senha da sua conta.</p>
      <div className="fields">
        <TextField id="f-email-l" label="E-mail" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="voce@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordField id="f-pass-l" label="Senha" autoComplete="current-password" value={password} onChange={setPassword} />
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <div className="spacer" style={{ minHeight: 24 }} />
      <Button type="submit" disabled={!email.trim() || !password || busy}>{busy ? 'Entrando…' : 'Entrar'}</Button>
      <Button variant="ghost" style={{ marginTop: 8, height: 48, fontSize: 14 }} onClick={() => actions.go('signup')}>
        Criar uma conta
      </Button>
    </form>
  );
}

/** Logado, mas ainda sem casa: criar uma ou entrar com código. */
export function Home({ account, actions }: { account: Account; actions: Actions }) {
  return (
    <div className="screen">
      <span className="eyebrow" style={{ marginTop: 40 }}>{account.email}</span>
      <h1 className="title-m" style={{ marginTop: 4 }}>Olá, {account.name}</h1>
      <p className="lead" style={{ marginTop: 8 }}>
        Você ainda não está numa casa. Crie a sua ou entre na de alguém com o código de convite.
      </p>
      <div className="spacer" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Button onClick={() => actions.go('create')}>Criar uma casa</Button>
        <Button variant="secondary" onClick={() => actions.go('join')}>
          Entrar com um código
        </Button>
        <Button variant="ghost" style={{ height: 48, fontSize: 14 }} onClick={() => actions.logout()}>
          Sair da conta
        </Button>
      </div>
    </div>
  );
}
