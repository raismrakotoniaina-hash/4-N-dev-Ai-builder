import type { ReactNode } from 'react';
import type { AppView, NavigationItem } from '../../types/app';
import { BottomNavigation } from './BottomNavigation';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

interface AppLayoutProps {
  activeView: AppView;
  children: ReactNode;
  currentPage: NavigationItem;
  isMobileSidebarOpen: boolean;
  isSidebarCollapsed: boolean;
  onChangeView: (view: AppView) => void;
  onCloseMobileSidebar: () => void;
  onNewProject: () => void;
  onOpenMobileSidebar: () => void;
  onToggleSidebar: () => void;
}

export function AppLayout({
  activeView,
  children,
  currentPage,
  isMobileSidebarOpen,
  isSidebarCollapsed,
  onChangeView,
  onCloseMobileSidebar,
  onNewProject,
  onOpenMobileSidebar,
  onToggleSidebar,
}: AppLayoutProps) {
  const handleChangeView = (view: AppView) => {
    onChangeView(view);
    onCloseMobileSidebar();
  };

  return (
    <div className="app-shell">
      <div
        aria-hidden="true"
        className={`mobile-sidebar-overlay ${
          isMobileSidebarOpen ? 'mobile-sidebar-overlay--visible' : ''
        }`}
        onClick={onCloseMobileSidebar}
      />

      <div
        className={`mobile-sidebar-container ${
          isMobileSidebarOpen ? 'mobile-sidebar-container--open' : ''
        }`}
      >
        <Sidebar
          activeView={activeView}
          isCollapsed={false}
          onChangeView={handleChangeView}
          onCollapse={onCloseMobileSidebar}
          onNewProject={onNewProject}
        />
      </div>

      <div className="desktop-sidebar">
        <Sidebar
          activeView={activeView}
          isCollapsed={isSidebarCollapsed}
          onChangeView={onChangeView}
          onCollapse={onToggleSidebar}
          onNewProject={onNewProject}
        />
      </div>

      <div
        className={`app-shell__content ${
          isSidebarCollapsed ? 'app-shell__content--sidebar-collapsed' : ''
        }`}
      >
        <Topbar
          currentPage={currentPage}
          onOpenMobileMenu={onOpenMobileSidebar}
        />

        <main className="app-shell__main">{children}</main>
      </div>

      <BottomNavigation activeView={activeView} onChangeView={onChangeView} />
    </div>
  );
          }
