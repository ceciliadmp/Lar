import type { Actions } from '../App';
import { BackButton, Button } from '../components/ui';
import { PhotoEditor } from '../components/PhotoEditor';
import type { Account, AvatarInfo } from '../state';

/** Perfil para quem ainda não está numa casa (dentro da casa, fica em Configurações). */
export function Profile({ account, avatar, actions }: { account: Account; avatar: AvatarInfo; actions: Actions }) {
  return (
    <div className="screen members">
      <BackButton label="Voltar" onClick={() => actions.go('home')} />
      <h1 className="title-m" style={{ marginTop: 16 }}>Seu perfil</h1>
      <PhotoEditor account={account} avatar={avatar} actions={actions} />
      <div className="spacer" style={{ minHeight: 24 }} />
      <Button variant="ghost" style={{ height: 48, fontSize: 14 }} onClick={() => actions.logout()}>
        Sair da conta
      </Button>
    </div>
  );
}
