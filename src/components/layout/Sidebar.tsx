import {
  ChevronLeft,
  CircleHelp,
  Command,
  PanelLeftClose,
  Plus,
  Settings,
} from 'lucide-react';
import { navigationItems } from '../../data/navigation';
import type { AppView } from '../../types/app';
import { useLanguage } from '../../lib/i18n';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface SidebarProps {
  activeView: AppView;
  isCollapsed: boolean;
  onChangeView: (view: AppView) => void;
  onCollapse: () => void;
  onNewProject: () => void;
}

export function Sidebar({
  activeView,
  isCollapsed,
  onChangeView,
  onCollapse,
  onNewProject,
}: SidebarProps) {
  const { t } = useLanguage();
  return (
    <aside className={`sidebar ${isCollapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__top">
        <div className="sidebar__brand">
          <div className="sidebar__logo" aria-hidden="true">
            <span>4</span>
            <strong>N</strong>
          </div>

          {!isCollapsed && (
            <div className="sidebar__brand-text">
              <strong>4-N-DEV</strong>
              <span>AI BUILDER</span>
            </div>
          )}
        </div>

        <button
          aria-label={isCollapsed ? t('Sokafy ny sidebar') : t('Afeno ny sidebar')}
          className="sidebar__collapse"
          onClick={onCollapse}
          type="button"
        >
          {isCollapsed ? <ChevronLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <div className="sidebar__workspace">
        {!isCollapsed && <span className="sidebar__section-label">{t('WORKSPACE')}</span>}

        <Button
          aria-label="Mamorona projet vaovao"
          className="sidebar__new-project"
          fullWidth
          onClick={onNewProject}
          size="sm"
        >
          <Plus size={17} />
          {!isCollapsed && <span>{t('New Project')}</span>}
        </Button>
      </div>

      <nav aria-label="Main navigation" className="sidebar__navigation">
        {!isCollapsed && <span className="sidebar__section-label">{t('NAVIGATION')}</span>}

        <div className="sidebar__nav-list">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <button
                aria-current={isActive ? 'page' : undefined}
                aria-label={t(item.label)}
                className={`sidebar__nav-item ${
                  isActive ? 'sidebar__nav-item--active' : ''
                }`}
                key={item.id}
                onClick={() => onChangeView(item.id)}
                title={isCollapsed ? t(item.label) : undefined}
                type="button"
              >
                <Icon size={19} strokeWidth={1.8} />
                {!isCollapsed && <span>{t(item.label)}</span>}
                {isActive && !isCollapsed && <i />}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="sidebar__bottom">
        {!isCollapsed && (
          <div className="sidebar__status">
            <div className="sidebar__status-icon">
              <Command size={16} />
            </div>
            <div>
              <span>{t('AI Engine')}</span>
              <Badge pulse variant="success">
                Ready
              </Badge>
            </div>
          </div>
        )}

        <div className="sidebar__utility">
          <button aria-label="Settings" type="button">
            <Settings size={19} />
            {!isCollapsed && <span>{t('Settings')}</span>}
          </button>

          <button aria-label="Help center" type="button">
            <CircleHelp size={19} />
            {!isCollapsed && <span>{t('Help Center')}</span>}
          </button>
        </div>
      </div>
    </aside>
  );
          }
