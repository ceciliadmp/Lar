import type { TabScreen } from '../state';
import { Icon } from './ui';

const TABS: {
  screen: TabScreen;
  label: string;
  /** Rótulo para telas estreitas (menos de 380px), quando o completo não cabe. */
  short?: string;
  icon: 'tasks' | 'receipt' | 'podium' | 'trend' | 'sliders';
}[] = [
  { screen: 'tasks', label: 'Tarefas', icon: 'tasks' },
  { screen: 'bills', label: 'Contas', icon: 'receipt' },
  { screen: 'score', label: 'Placar', icon: 'podium' },
  { screen: 'metrics', label: 'Histórico', icon: 'trend' },
  { screen: 'settings', label: 'Configurações', short: 'Ajustes', icon: 'sliders' },
];

/** Barra de abas no pé da tela, dentro da casa. */
export function TabBar({ current, onGo }: { current: TabScreen; onGo: (s: TabScreen) => void }) {
  return (
    <nav className="tabbar" aria-label="Principal">
      {TABS.map((t) => {
        const active = t.screen === current;
        return (
          <button
            key={t.screen}
            type="button"
            className="tabbar__item"
            aria-current={active ? 'page' : undefined}
            aria-label={t.short ? t.label : undefined}
            onClick={() => onGo(t.screen)}
          >
            <Icon name={t.icon} size={20} strokeWidth={active ? 2.2 : 1.8} />
            {t.short ? (
              <>
                <span className="tabbar__long">{t.label}</span>
                <span className="tabbar__short">{t.short}</span>
              </>
            ) : (
              <span>{t.label}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
