import { useRef, useState } from 'react';
import type { Actions } from '../App';
import { Avatar, BackButton, Button } from '../components/ui';
import { photoFromFile, type Account, type AvatarInfo } from '../state';

export function Profile({
  account,
  avatar,
  inHouse,
  actions,
}: {
  account: Account;
  /** Cor e inicial iguais às da casa (quando há casa). */
  avatar: AvatarInfo;
  inHouse: boolean;
  actions: Actions;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const run = async (kind: 'upload' | 'remove', make: () => Promise<string | null>) => {
    setBusy(kind);
    setError(null);
    setSaved(null);
    try {
      const err = await actions.setPhoto(await make());
      if (err) setError(err);
      else setSaved(kind === 'upload' ? 'Foto atualizada.' : 'Foto removida.');
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(null);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite escolher o mesmo arquivo de novo
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Escolha um arquivo de imagem.');
      return;
    }
    void run('upload', () => photoFromFile(file));
  };

  return (
    <div className="screen members">
      <BackButton label="Voltar" onClick={() => actions.go(inHouse ? 'members' : 'home')} />
      <h1 className="title-m" style={{ marginTop: 16 }}>Seu perfil</h1>

      <div className="profile">
        <Avatar info={{ ...avatar, photo: account.photo }} size="xl" />
        <div className="profile__text">
          <span className="profile__name">{account.name}</span>
          <span className="caption">{account.email}</span>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      <div className="profile__actions">
        <Button onClick={() => fileRef.current?.click()} disabled={!!busy}>
          {busy === 'upload' ? 'Enviando…' : account.photo ? 'Trocar foto' : 'Escolher foto'}
        </Button>
        {account.photo && (
          <Button variant="secondary" onClick={() => void run('remove', async () => null)} disabled={!!busy}>
            {busy === 'remove' ? 'Removendo…' : 'Remover foto'}
          </Button>
        )}
      </div>
      <p className="caption" style={{ marginTop: 10 }}>
        A foto aparece para todo mundo da sua casa. Ela é recortada em quadrado.
      </p>
      {error && (
        <p className="form-error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="form-ok" role="status" style={{ marginTop: 12 }}>
          {saved}
        </p>
      )}

      <div className="spacer" style={{ minHeight: 24 }} />
      <Button variant="ghost" style={{ height: 48, fontSize: 14 }} onClick={() => actions.logout()}>
        Sair da conta
      </Button>
    </div>
  );
}
