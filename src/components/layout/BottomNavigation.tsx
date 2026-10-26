import { navigationItems } from '../../data/navigation';
import type { AppView } from '../../types/app';
import { useLanguage } from '../../lib/i18n';

interface BottomNavigationProps {
  activeView: AppView;
  onChangeView: (view: AppView) => void;
}

export function BottomNavigation({
  activeView,
  onChangeView,
}: BottomNavigationProps) {
  const { t } = useLanguage();
  const mobileItems = navigationItems.slice(0, 5);

  return (
    <nav aria-label="Mobile navigation" className="bottom-navigation">
      {mobileItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.id === activeView;

        return (
          <button
            aria-current={isActive ? 'page' : undefined}
            className={isActive ? 'bottom-navigation__item--active' : ''}
            key={item.id}
            onClick={() => onChangeView(item.id)}
            type="button"
          >
            <span className="bottom-navigation__icon">
              <Icon size={20} strokeWidth={1.9} />
            </span>
            <span>{t(item.label)}</span>
          </button>
        );
      })}
    </nav>
  );
}
