import { useState } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { Modal } from './components/ui/Modal';
import { PagePlaceholder } from './components/ui/PagePlaceholder';
import { navigationItems } from './data/navigation';
import type { AppView } from './types/app';

function App() {
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);

  const currentPage =
    navigationItems.find((item) => item.id === activeView) ?? navigationItems[0];

  return (
    <>
      <AppLayout
        activeView={activeView}
        currentPage={currentPage}
        isMobileSidebarOpen={isMobileSidebarOpen}
        isSidebarCollapsed={isSidebarCollapsed}
        onChangeView={setActiveView}
        onCloseMobileSidebar={() => setIsMobileSidebarOpen(false)}
        onNewProject={() => setIsNewProjectModalOpen(true)}
        onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        onToggleSidebar={() => setIsSidebarCollapsed((current) => !current)}
      >
        <PagePlaceholder page={currentPage} />
      </AppLayout>

      <Modal
        description="Amin’ny Partie 3 no hampidirina ny form sy ny project templates."
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        title="Create a new project"
      >
        <p className="modal-message">
          Vonona ny AI workspace. Safidio ny “New Project” rehefa vita ny
          dashboard sy project setup.
        </p>
      </Modal>
    </>
  );
}

export default App;
