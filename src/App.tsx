import { useEffect, useState } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { Modal } from './components/ui/Modal';
import { navigationItems } from './data/navigation';
import { coreApi } from './lib/coreApi';
import type { AppView, Project, ProjectFile } from './types/app';

function App() {
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [modal, setModal] = useState(false);
  const [apiKey, setApiKey] = useState(coreApi.getApiKey());
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [prompt, setPrompt] = useState('');
  const [message, setMessage] = useState('Ready');
  const [busy, setBusy] = useState(false);

  const currentPage = navigationItems.find((item) => item.id === activeView) ?? navigationItems[0];

  useEffect(() => { coreApi.listProjects().then(r => setProjects(r.projects || [])).catch(() => setMessage('Connect a 4N DEV API key to load projects.')); }, []);

  async function createProject() {
    if (!prompt.trim()) return;
    setBusy(true); setMessage('Creating project with 4N DEV Core…');
    try {
      const plan = await coreApi.plan(prompt);
      const result = await coreApi.generate({ prompt, ...(plan || {}) });
      if (result.project) {
        setProjects(p => [result.project as Project, ...p]);
        setSelected(result.project as Project);
      }
      setMessage('AI Builder workflow completed: Plan → Generate.');
      setPrompt('');
      setModal(false);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Builder request failed'); }
    finally { setBusy(false); }
  }

  async function openProject(project: Project) {
    setSelected(project);
    try { const r = await coreApi.listFiles(project.id); setFiles(r.files || []); setActiveView('files'); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to load files'); }
  }

  return (
    <>
      <AppLayout activeView={activeView} currentPage={currentPage} isMobileSidebarOpen={mobile}
        isSidebarCollapsed={collapsed} onChangeView={setActiveView}
        onCloseMobileSidebar={() => setMobile(false)} onOpenMobileSidebar={() => setMobile(true)}
        onToggleSidebar={() => setCollapsed(v => !v)} onNewProject={() => setModal(true)}>
        <div className="ai-builder-workspace">
          <div className="workspace-header">
            <div><span className="eyebrow">4N DEV CORE</span><h1>{currentPage.label}</h1><p>AI Builder connecté au moteur 4N DEV.</p></div>
            <div className="workspace-status">{message}</div>
          </div>

          {activeView === 'dashboard' && <section className="workspace-grid">
            <div className="workspace-card workspace-hero">
              <span className="eyebrow">BUILD WITH AI</span><h2>Décris ton projet. 4N DEV le construit.</h2>
              <p>Brief client → Plan → Generate → Review → Code → Build → Deploy.</p>
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Ex: Crée une boutique moderne avec catalogue, panier et espace admin…" />
              <button disabled={busy || !prompt.trim()} onClick={createProject}>{busy ? 'Construction…' : 'Lancer AI Builder'}</button>
            </div>
            <div className="workspace-card"><h3>Projects</h3><strong>{projects.length}</strong><p>Projets synchronisés avec 4N DEV Core.</p>
              {projects.slice(0,5).map(p => <button className="project-row" key={p.id} onClick={() => openProject(p)}>{p.name}</button>)}
            </div>
            <div className="workspace-card"><h3>Core services</h3><p>Planner · Generator · Review · Build · Deploy · Credits · Usage</p><span className="core-badge">CONNECTED ENGINE</span></div>
          </section>}

          {activeView === 'builder' && <section className="workspace-card"><h2>AI Builder</h2><textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Décris le projet client…" /><button disabled={busy} onClick={createProject}>{busy ? 'Processing…' : 'Plan & Generate'}</button></section>}

          {activeView === 'projects' && <section className="workspace-card"><h2>Projects</h2>{projects.map(p => <button className="project-row" key={p.id} onClick={() => openProject(p)}>{p.name}</button>)}</section>}

          {activeView === 'files' && <section className="workspace-card"><h2>{selected?.name || 'Project files'}</h2>{files.length ? files.map(f => <div className="file-row" key={f.path}><code>{f.path}</code><span>{f.content.length} chars</span></div>) : <p>No files loaded.</p>}</section>}

          {activeView === 'settings' && <section className="workspace-card"><h2>4N DEV Core connection</h2><p>API key used by this private Builder workspace.</p><input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="4ndev_sk_…" /><button onClick={() => { coreApi.setApiKey(apiKey); setMessage('API key saved locally.'); }}>Save connection</button></section>}

          {!['dashboard','builder','projects','files','settings'].includes(activeView) && <section className="workspace-card"><h2>{currentPage.label}</h2><p>This workspace is connected to the 4N DEV Core engine. The next actions use the selected project and Core API.</p></section>}
        </div>
      </AppLayout>
      <Modal isOpen={modal} onClose={() => setModal(false)} title="New AI project" description="Create a project from a client brief.">
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Décris le besoin du client…" />
        <button disabled={busy} onClick={createProject}>{busy ? 'Processing…' : 'Create with AI'}</button>
      </Modal>
    </>
  );
}
export default App;
