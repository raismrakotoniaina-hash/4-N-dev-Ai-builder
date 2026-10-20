import { useEffect, useState } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { Modal } from './components/ui/Modal';
import { navigationItems } from './data/navigation';
import { builderApi, type BuilderUser } from './lib/builderApi';
import type { AppView, BuilderModel, Project, ProjectFile } from './types/app';

type ProjectWithFiles = Project & { files?: ProjectFile[]; fileCount?: number };

function App() {
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [modal, setModal] = useState(false);
  const [models, setModels] = useState<BuilderModel[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [modelStatus, setModelStatus] = useState('Mikaroka ireo modely Core…');
  const [user, setUser] = useState<BuilderUser | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<ProjectWithFiles | null>(null);
  const [prompt, setPrompt] = useState('');
  const [message, setMessage] = useState('Midira na mamoròna kaonty hanombohana.');
  const [busy, setBusy] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [coreKey, setCoreKey] = useState('');
  const [coreConnected, setCoreConnected] = useState(false);
  const [coreCredits, setCoreCredits] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');

  const currentPage = navigationItems.find((item) => item.id === activeView) ?? navigationItems[0];

  async function refreshProjects() {
    const items = await builderApi.listProjects();
    setProjects(items);
  }

  useEffect(() => {
    let active = true;
    builderApi.listModels().then((items) => {
      if (!active) return;
      setModels(items);
      setSelectedModel(items[0]?.id || '');
      setModelStatus(items.length + ' modely Core azo ampiasaina');
    }).catch((error: unknown) => {
      if (active) setModelStatus(error instanceof Error ? error.message : 'Tsy afaka naka modely Core.');
    });
    builderApi.me().then(async (currentUser) => {
      if (!active) return;
      setUser(currentUser);
      const [items, connection] = await Promise.all([builderApi.listProjects(), builderApi.coreConnection()]);
      if (!active) return;
      setProjects(items);
      setCoreConnected(connection.connected);
      setMessage('Tafiditra soa aman-tsara.');
    }).catch(() => {
      if (active) setUser(null);
    });
    return () => { active = false; };
  }, []);

  async function submitAuth() {
    setBusy(true);
    try {
      const account = authMode === 'register'
        ? await builderApi.register(email, password)
        : await builderApi.login(email, password);
      setUser(account);
      setPassword('');
      await refreshProjects();
      const connection = await builderApi.coreConnection();
      setCoreConnected(connection.connected);
      setMessage('Tafiditra soa aman-tsara. Ampifandraiso amin’ny Core ny lakilenao.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Tsy nahomby ny fidirana.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    try {
      await builderApi.logout();
      setUser(null);
      setProjects([]);
      setSelected(null);
      setCoreConnected(false);
      setCoreCredits('');
      setMessage('Nivoaka tamin’ny kaonty ianao.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Tsy afaka nivoaka.');
    }
  }

  async function createProject() {
    if (!prompt.trim() || !user) return;
    setBusy(true);
    try {
      const project = await builderApi.createProject(prompt.trim().slice(0, 120), prompt.trim());
      await refreshProjects();
      setSelected(project);
      setPrompt('');
      setModal(false);
      setActiveView('projects');
      setMessage('Voatahiry ilay tetikasa. Mbola tsy alefa ny famoronana kaody AI mandra-pahavitan’ny fiarovana sy ny build sandbox.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Tsy afaka nitahiry ny tetikasa.');
    } finally {
      setBusy(false);
    }
  }

  async function openProject(project: Project) {
    try {
      const full = await builderApi.getProject(project.id) as ProjectWithFiles;
      setSelected(full);
      setActiveView('files');
      setMessage('Tetikasa sy rakitra nalaina avy amin’ny fitahirizana maharitra.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Tsy afaka nanokatra ilay tetikasa.');
    }
  }

  async function connectCore() {
    setBusy(true);
    setSettingsMessage('');
    try {
      await builderApi.connectCore(coreKey);
      setCoreKey('');
      setCoreConnected(true);
      setSettingsMessage('Voamarina ary voatahiry voaaro ny lakile Core.');
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : 'Tsy afaka nampifandray Core.');
    } finally {
      setBusy(false);
    }
  }

  async function loadCoreCredits() {
    setBusy(true);
    try {
      const result = await builderApi.coreCredits();
      setCoreCredits(JSON.stringify(result, null, 2));
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : 'Tsy afaka naka ny balance Core.');
    } finally {
      setBusy(false);
    }
  }

  const modelPicker = (
    <label className="builder-model-picker">
      <span>Modely AI</span>
      <select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)} disabled={!models.length || busy}>
        {!models.length && <option value="">Ampifandraiso ny backend Builder</option>}
        {models.map((model) => <option key={model.id} value={model.id}>{model.name} — {model.family}</option>)}
      </select>
      <small>{modelStatus}</small>
    </label>
  );

  return (
    <>
      <AppLayout activeView={activeView} currentPage={currentPage} isMobileSidebarOpen={mobile}
        isSidebarCollapsed={collapsed} onChangeView={setActiveView}
        onCloseMobileSidebar={() => setMobile(false)} onOpenMobileSidebar={() => setMobile(true)}
        onToggleSidebar={() => setCollapsed((value) => !value)} onNewProject={() => setModal(true)}>
        <div className="ai-builder-workspace">
          <div className="workspace-header">
            <div><span className="eyebrow">4N DEV CORE</span><h1>{currentPage.label}</h1><p>AI Builder — kaonty manokana, Core balance manokana.</p></div>
            <div className="workspace-status">{message}</div>
          </div>

          {!user ? (
            <section className="workspace-card">
              <h2>{authMode === 'register' ? 'Mamoròna kaonty AI Builder' : 'Midira amin’ny kaontinao'}</h2>
              <p>Ny kaonty Builder dia misaraka amin’ny Core Console. Ampifandraiso avy eo ny 4ndev_sk mba hampiasa ny balance Core-nao.</p>
              <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ianao@example.com" /></label>
              <label>Teny miafina<input type="password" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Farafahakeliny 12 tarehintsoratra" /></label>
              <button disabled={busy || !email.trim() || password.length < (authMode === 'register' ? 12 : 1)} onClick={submitAuth}>{busy ? 'Miandry…' : authMode === 'register' ? 'Mamorona kaonty' : 'Hiditra'}</button>
              <button className="project-row" disabled={busy} onClick={() => setAuthMode(authMode === 'register' ? 'login' : 'register')}>{authMode === 'register' ? 'Efa manana kaonty? Hiditra' : 'Tsy mbola manana kaonty? Hisoratra anarana'}</button>
            </section>
          ) : (
            <>
              <div className="workspace-card">
                <p>Kaonty: <strong>{user.email}</strong></p>
                <button className="project-row" onClick={signOut}>Hivoaka</button>
              </div>

              {activeView === 'dashboard' && <section className="workspace-grid">
                <div className="workspace-card workspace-hero">
                  <span className="eyebrow">BUILD WITH AI</span><h2>Farito ny tetikasanao.</h2>
                  <p>Ny dingana manaraka rehefa vonona ny pipeline: Plan → Generate → Build → Test → Repair → Preview.</p>
                  {modelPicker}
                  <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ohatra: Mamoròna boutique misy catalogue, panier ary espace admin…" />
                  <button disabled={busy || !prompt.trim()} onClick={createProject}>{busy ? 'Mitahiry…' : 'Mamorona sy mitahiry tetikasa'}</button>
                </div>
                <div className="workspace-card"><h3>Tetikasa</h3><strong>{projects.length}</strong><p>Voatahiry isaky ny kaonty.</p>
                  {projects.slice(0, 5).map((project) => <button className="project-row" key={project.id} onClick={() => openProject(project)}>{project.name}</button>)}
                </div>
                <div className="workspace-card"><h3>Core services</h3><p>Model catalogue · Core balance · Project storage</p><span className="core-badge">CORE CONNECT {coreConnected ? 'CONNECTED' : 'REQUIRED'}</span></div>
              </section>}

              {activeView === 'builder' && <section className="workspace-card"><h2>AI Builder</h2>{modelPicker}<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Farito ny zavatra tianao hatsangana…" /><button disabled={busy || !prompt.trim()} onClick={createProject}>{busy ? 'Mitahiry…' : 'Mamorona sy mitahiry tetikasa'}</button><p>Ny famoronana kaody AI dia mbola tsy alefa amin’ity dingana ity.</p></section>}

              {activeView === 'projects' && <section className="workspace-card"><h2>Ny tetikasako</h2><p>Tehirizina ao amin’ny backend, ary ny tompony ihany no mahazo azy.</p>{projects.map((project) => <button className="project-row" key={project.id} onClick={() => openProject(project)}>{project.name}</button>)}{!projects.length && <p>Tsy mbola misy tetikasa.</p>}</section>}

              {activeView === 'files' && <section className="workspace-card"><h2>{selected?.name || 'Rakitra tetikasa'}</h2>{selected?.files?.length ? selected.files.map((file) => <div className="file-row" key={file.path}><code>{file.path}</code><span>{file.content.length} chars</span></div>) : <p>{selected ? 'Mbola tsy misy rakitra voatahiry ao amin’ity tetikasa ity.' : 'Misafidiana tetikasa ao amin’ny Projects.'}</p>}</section>}

              {activeView === 'settings' && <section className="workspace-card">
                <h2>Fampifandraisana 4N DEV Core</h2>
                <p>Core API: <code>https://api.4ndev.dev</code>. Ny Core no mitantana ny balance sy billing. Tsy tehirizina ao amin’ny navigateur ny lakile.</p>
                <p>Toetry ny fifandraisana: <strong>{coreConnected ? 'Mifandray' : 'Tsy mbola mifandray'}</strong></p>
                {!coreConnected && <><label>4N DEV Core secret key<input type="password" autoComplete="off" value={coreKey} onChange={(event) => setCoreKey(event.target.value)} placeholder="4ndev_sk_…" /></label><button disabled={busy || !coreKey.trim()} onClick={connectCore}>{busy ? 'Manamarina…' : 'Ampifandraiso ny Core'}</button></>}
                {coreConnected && <><button disabled={busy} onClick={loadCoreCredits}>Jereo ny balance Core</button><button className="project-row" disabled={busy} onClick={async () => { await builderApi.disconnectCore(); setCoreConnected(false); setCoreCredits(''); setSettingsMessage('Nesorina ny fifandraisana Core.'); }}>Esory ny fifandraisana</button></>}
                {settingsMessage && <p>{settingsMessage}</p>}
                {coreCredits && <pre>{coreCredits}</pre>}
                <p>{modelStatus}</p>
              </section>}

              {!['dashboard', 'builder', 'projects', 'files', 'settings'].includes(activeView) && <section className="workspace-card"><h2>{currentPage.label}</h2><p>Hovelarina aorian’ny fametrahana ny pipeline build voaaro sy preview mitokana.</p></section>}
            </>
          )}
        </div>
      </AppLayout>
      <Modal isOpen={modal && Boolean(user)} onClose={() => setModal(false)} title="Tetikasa AI vaovao" description="Tehirizo ny famaritana; mbola tsy mandeha ny génération AI.">
        {modelPicker}
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Farito ny tetikasa…" />
        <button disabled={busy || !prompt.trim()} onClick={createProject}>{busy ? 'Mitahiry…' : 'Mamorona sy mitahiry'}</button>
      </Modal>
    </>
  );
}

export default App;
