import type { TabScreen } from '../state';
import { Icon } from './ui';

const TABS: { screen: TabScreen; label: string; icon: 'tasks' | 'podium' | 'trend' | 'sliders' }[] = [
  { screen: 'tasks', label: 'Tarefas', icon: 'tasks' },
  { screen: 'score', label: 'Placar', icon: 'podium' },
  { screen: 'metrics', label: 'Histórico', icon: 'trend' },
  { screen: 'settings', label: 'Configurações', icon: 'sliders' },
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
            onClick={() => onGo(t.screen)}
          >
            <Icon name={t.icon} size={20} strokeWidth={active ? 2.2 : 1.8} />
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
