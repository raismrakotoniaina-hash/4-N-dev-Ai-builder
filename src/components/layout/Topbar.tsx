import { Bell, Menu, Search } from 'lucide-react';
import type { NavigationItem } from '../../types/app';
import { Badge } from '../ui/Badge';

interface TopbarProps {
  currentPage: NavigationItem;
  onOpenMobileMenu: () => void;
}

export function Topbar({ currentPage, onOpenMobileMenu }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar__page">
        <button
          aria-label="Sokafy ny menu"
          className="topbar__menu-button"
          onClick={onOpenMobileMenu}
          type="button"
        >
          <Menu size={22} />
        </button>

        <div>
          <div className="topbar__breadcrumb">
            <span>4-N-DEV</span>
            <span>/</span>
            <strong>{currentPage.label}</strong>
          </div>
          <h2>{currentPage.label}</h2>
        </div>
      </div>

      <div className="topbar__actions">
        <button aria-label="Search" className="topbar__action-button" type="button">
          <Search size={19} />
        </button>

        <button
          aria-label="Notifications"
          className="topbar__action-button topbar__notification"
          type="button"
        >
          <Bell size={19} />
          <i />
        </button>

        <div className="topbar__profile">
          <div className="topbar__avatar">V</div>
          <div className="topbar__user">
            <strong>Vola</strong>
            <Badge variant="primary">Free</Badge>
          </div>
        </div>
      </div>
    </header>
  );
          }
