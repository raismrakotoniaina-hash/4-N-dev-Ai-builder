import { useEffect, useState } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { Modal } from './components/ui/Modal';
import { navigationItems } from './data/navigation';
import { builderApi } from './lib/builderApi';
import type { AppView, BuilderModel, Project, ProjectFile } from './types/app';

function App() {
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [modal, setModal] = useState(false);
  const [models, setModels] = useState<BuilderModel[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [modelStatus, setModelStatus] = useState('Checking 4N DEV Core models…');
  const [projects] = useState<Project[]>([]);
  const [selected] = useState<Project | null>(null);
  const [files] = useState<ProjectFile[]>([]);
  const [prompt, setPrompt] = useState('');
  const [message, setMessage] = useState('Backend setup required before generation can start.');
  const [busy, setBusy] = useState(false);

  const currentPage = navigationItems.find((item) => item.id === activeView) ?? navigationItems[0];

  useEffect(() => {
    let active = true;
    builderApi.listModels()
      .then((items) => {
        if (!active) return;
        setModels(items);
        setSelectedModel(items[0]?.id || '');
        setModelStatus(`${items.length} Core models available`);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setModelStatus(error instanceof Error ? error.message : 'Could not load Core models.');
      });
    return () => { active = false; };
  }, []);

  function createProject() {
    if (!prompt.trim()) return;
    if (!selectedModel) {
      setMessage('Select a Core model after connecting the Builder backend.');
      return;
    }
    setBusy(true);
    setMessage('Model selection is ready, but generation is intentionally disabled until secure user authentication, project persistence and per-user billing are implemented.');
    setBusy(false);
  }

  function openProject(project: Project) {
    void project;
    setMessage('Project persistence is not enabled yet. Existing Core metadata routes are not a substitute for Builder file storage.');
  }

  const modelPicker = (
    <label className="builder-model-picker">
      <span>AI model</span>
      <select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)} disabled={!models.length || busy}>
        {!models.length && <option value="">Connect Builder backend to load models</option>}
        {models.map((model) => (
          <option key={model.id} value={model.id}>{model.name} — {model.family}</option>
        ))}
      </select>
      <small>{modelStatus}</small>
    </label>
  );

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
              <p>Brief client → Plan → Generate → Review → Code → Build → Preview.</p>
              {modelPicker}
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Ex: Crée une boutique moderne avec catalogue, panier et espace admin…" />
              <button disabled={busy || !prompt.trim() || !selectedModel} onClick={createProject}>{busy ? 'Construction…' : 'Préparer la génération'}</button>
            </div>
            <div className="workspace-card"><h3>Projects</h3><strong>{projects.length}</strong><p>La persistance des projets sera activée après la mise en place du backend et de sa base de données.</p>
              {projects.slice(0,5).map(p => <button className="project-row" key={p.id} onClick={() => openProject(p)}>{p.name}</button>)}
            </div>
            <div className="workspace-card"><h3>Core services</h3><p>Model catalogue · Planner · Generator · Review · Build · Test · Preview</p><span className="core-badge">MODEL CATALOGUE FIRST</span></div>
          </section>}

          {activeView === 'builder' && <section className="workspace-card"><h2>AI Builder</h2>{modelPicker}<textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Décris le projet client…" /><button disabled={busy || !prompt.trim() || !selectedModel} onClick={createProject}>{busy ? 'Processing…' : 'Préparer la génération'}</button></section>}

          {activeView === 'projects' && <section className="workspace-card"><h2>Projects</h2><p>La liste sera reliée au stockage persistant du Builder dans l’étape suivante.</p>{projects.map(p => <button className="project-row" key={p.id} onClick={() => openProject(p)}>{p.name}</button>)}</section>}

          {activeView === 'files' && <section className="workspace-card"><h2>{selected?.name || 'Project files'}</h2>{files.length ? files.map(f => <div className="file-row" key={f.path}><code>{f.path}</code><span>{f.content.length} chars</span></div>) : <p>Le stockage des fichiers du Builder n’est pas encore activé.</p>}</section>}

          {activeView === 'settings' && <section className="workspace-card"><h2>4N DEV Core connection</h2><p>Le backend du Builder se connectera à <code>https://api.4ndev.dev</code>. Les clés Core seront conservées côté serveur, jamais dans le navigateur.</p><p>{modelStatus}</p><p>Backend URL: <code>VITE_BUILDER_API_URL</code></p></section>}

          {!['dashboard','builder','projects','files','settings'].includes(activeView) && <section className="workspace-card"><h2>{currentPage.label}</h2><p>Cette section sera activée après la mise en place du stockage des projets, du pipeline de build sécurisé et des previews isolées.</p></section>}
        </div>
      </AppLayout>
      <Modal isOpen={modal} onClose={() => setModal(false)} title="New AI project" description="Create a project from a client brief.">
        {modelPicker}
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Décris le besoin du client…" />
        <button disabled={busy || !prompt.trim() || !selectedModel} onClick={createProject}>{busy ? 'Processing…' : 'Préparer la génération'}</button>
      </Modal>
    </>
  );
}
export default App;
