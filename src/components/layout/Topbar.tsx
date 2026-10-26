import { Bell, Menu, Search } from 'lucide-react';
import type { NavigationItem } from '../../types/app';
import { useLanguage } from '../../lib/i18n';
import { Badge } from '../ui/Badge';

interface TopbarProps {
  currentPage: NavigationItem;
  onOpenMobileMenu: () => void;
}

export function Topbar({ currentPage, onOpenMobileMenu }: TopbarProps) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="topbar">
      <div className="topbar__page">
        <button
          aria-label={t('Sokafy ny menu')}
          className="topbar__menu-button"
          onClick={onOpenMobileMenu}
          type="button"
        >
          <Menu size={22} />
        </button>
        <div>
          <div className="topbar__breadcrumb">
            <span>4-N-DEV</span><span>/</span><strong>{t(currentPage.label)}</strong>
          </div>
          <h2>{t(currentPage.label)}</h2>
        </div>
      </div>
      <div className="topbar__actions">
        <label className="language-selector">
          <span>{t('Fiteny')}</span>
          <select aria-label={t('Fiteny')} value={language} onChange={(event) => setLanguage(event.target.value as 'en' | 'fr' | 'mg')}>
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="mg">Malagasy</option>
          </select>
        </label>
        <button aria-label={t('Search')} className="topbar__action-button" onClick={() => document.querySelector<HTMLTextAreaElement>('.workspace-hero textarea, .workspace-card textarea')?.focus()} type="button"><Search size={19} /></button>
        <button aria-label={t('Notifications')} className="topbar__action-button topbar__notification" onClick={() => window.dispatchEvent(new CustomEvent('builder:notifications'))} type="button"><Bell size={19} /><i /></button>
        <div className="topbar__profile">
          <div className="topbar__avatar">4N</div>
          <div className="topbar__user"><strong>4N DEV</strong><Badge variant="primary">Builder</Badge></div>
        </div>
      </div>
    </header>
  );
}
