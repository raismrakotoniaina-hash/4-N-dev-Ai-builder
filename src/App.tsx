import { useEffect, useState } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { Modal } from './components/ui/Modal';
import { navigationItems } from './data/navigation';
import { builderApi, type BuilderUser } from './lib/builderApi';
import { useLanguage } from './lib/i18n';
import type { AppView, Project, ProjectFile } from './types/app';

type ProjectWithFiles = Project & { files?: ProjectFile[]; fileCount?: number };

function App() {
  const { t } = useLanguage();
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [modal, setModal] = useState(false);
  const [user, setUser] = useState<BuilderUser | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<ProjectWithFiles | null>(null);
  const [prompt, setPrompt] = useState('');
  const [message, setMessage] = useState('Midira na mamoròna kaonty hanombohana.');
  const [busy, setBusy] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const currentPage = navigationItems.find((item) => item.id === activeView) ?? navigationItems[0];

  async function refreshProjects() {
    const items = await builderApi.listProjects();
    setProjects(items);
  }

  useEffect(() => {
    const showNotifications = () => setMessage('Tsy mbola misy fampandrenesana vaovao.');
    window.addEventListener('builder:notifications', showNotifications);
    return () => window.removeEventListener('builder:notifications', showNotifications);
  }, []);

  useEffect(() => {
    let active = true;
    builderApi.me().then(async (currentUser) => {
      if (!active) return;
      setUser(currentUser);
      const items = await builderApi.listProjects();
      if (!active) return;
      setProjects(items);
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
      setMessage('Tafiditra soa aman-tsara. Vonona ny Builder raha voalamina amin’ny serveur ny Core.');
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
      setMessage('Nivoaka tamin’ny kaonty ianao.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Tsy afaka nivoaka.');
    }
  }

  async function createProject() {
    if (!prompt.trim() || !user) return;
    setBusy(true);
    try {
      const description = prompt.trim();
      const project = await builderApi.createProject(description.slice(0, 120), description.slice(0, 2000));
      setMessage('Mamorona ny rakitra amin’ny alalan’ny 4N DEV Core…');
      const generated = await builderApi.generateProject(project.id, description);
      await refreshProjects();
      setSelected(generated.project as ProjectWithFiles);
      setPrompt(''); setModal(false); setActiveView('files');
      const cost = typeof generated.usage?.charged_usd === 'number' ? ' | Core charge: $' + generated.usage.charged_usd.toFixed(4) : '';
      setMessage('Vita ny génération. Rakitra noforonina: ' + generated.generatedFiles.length + cost);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Tsy nahomby ny génération; mety mbola voatahiry ilay tetikasa.');
      await refreshProjects().catch(() => {});
    } finally { setBusy(false); }
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

  return (
    <>
      <AppLayout activeView={activeView} currentPage={currentPage} isMobileSidebarOpen={mobile}
        isSidebarCollapsed={collapsed} onChangeView={setActiveView}
        onCloseMobileSidebar={() => setMobile(false)} onOpenMobileSidebar={() => setMobile(true)}
        onToggleSidebar={() => setCollapsed((value) => !value)} onNewProject={() => setModal(true)}>
        <div className="ai-builder-workspace">
          <div className="workspace-header">
            <div><span className="eyebrow">4N DEV CORE</span><h1>{currentPage.label}</h1><p>{t('AI Builder — kaonty manokana, Core no mitantana ny modely sy ny billing.')}</p></div>
            <div className="workspace-status">{message}</div>
          </div>

          {!user ? (
            <section className="workspace-card">
              <h2>{authMode === 'register' ? 'Mamoròna kaonty AI Builder' : 'Midira amin’ny kaontinao'}</h2>
              <p>{t('Ny kaonty Builder dia misaraka amin’ny Core Console. Ny Core sy ny modely dia tantanan’ny developer ao ambadika.')}</p>
              <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ianao@example.com" /></label>
              <label>Teny miafina<input type="password" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Farafahakeliny 12 tarehintsoratra" /></label>
              <button disabled={busy || !email.trim() || password.length < (authMode === 'register' ? 12 : 1)} onClick={submitAuth}>{busy ? 'Miandry…' : authMode === 'register' ? 'Mamorona kaonty' : 'Hiditra'}</button>
              <button className="project-row" disabled={busy} onClick={() => setAuthMode(authMode === 'register' ? 'login' : 'register')}>{authMode === 'register' ? 'Efa manana kaonty? Hiditra' : 'Tsy mbola manana kaonty? Hisoratra anarana'}</button>
            </section>
          ) : (
            <>
              <div className="workspace-card">
                <p>Kaonty: <strong>{user.email}</strong></p>
                <button className="project-row" onClick={signOut}>{t('Hivoaka')}</button>
              </div>

              {activeView === 'dashboard' && <section className="workspace-grid">
                <div className="workspace-card workspace-hero">
                  <span className="eyebrow">BUILD WITH AI</span><h2>{t('Farito ny tetikasanao.')}</h2>
                  <p>{t('Plan → Generate files → Save to project. Ny Core no mitantana ny modely sy billing.')}</p>
                  <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ohatra: Mamoròna boutique misy catalogue, panier ary espace admin…" />
                  <button disabled={busy || !prompt.trim()} onClick={createProject}>{busy ? 'Mamorona amin’ny AI…' : 'Mamorona application amin’ny AI'}</button>
                </div>
                <div className="workspace-card"><h3>{t('Tetikasa')}</h3><strong>{projects.length}</strong><p>{t('Voatahiry isaky ny kaonty.')}</p>
                  {projects.slice(0, 5).map((project) => <button className="project-row" key={project.id} onClick={() => openProject(project)}>{project.name}</button>)}
                </div>
                <div className="workspace-card"><h3>{t('Core services')}</h3><p>Model catalogue · Core balance · Project storage</p><span className="core-badge">CORE MANAGED BY DEVELOPER</span></div>
              </section>}

              {activeView === 'builder' && <section className="workspace-card"><h2>AI Builder</h2><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Farito ny zavatra tianao hatsangana…" /><button disabled={busy || !prompt.trim()} onClick={createProject}>{busy ? 'Mitahiry…' : 'Mamorona sy mitahiry tetikasa'}</button><p>Ny AI Builder no mandrindra ny modely Core ao ambadika.</p></section>}

              {activeView === 'projects' && <section className="workspace-card"><h2>{t('Ny tetikasako')}</h2><p>Tehirizina ao amin’ny backend, ary ny tompony ihany no mahazo azy.</p>{projects.map((project) => <button className="project-row" key={project.id} onClick={() => openProject(project)}>{project.name}</button>)}{!projects.length && <p>{t('Tsy mbola misy tetikasa.')}</p>}</section>}

              {activeView === 'files' && <section className="workspace-card"><h2>{selected?.name || 'Rakitra tetikasa'}</h2>{selected?.files?.length ? selected.files.map((file) => <div className="file-row" key={file.path}><code>{file.path}</code><span>{file.content.length} chars</span><details><summary>{t('Jereo ny kaody')}</summary><pre>{file.content}</pre></details></div>) : <p>{selected ? 'Mbola tsy misy rakitra voatahiry ao amin’ity tetikasa ity.' : 'Misafidiana tetikasa ao amin’ny Projects.'}</p>}</section>}

              {activeView === 'help' && <section className="workspace-card"><h2>{currentPage.label === 'Help Center' ? currentPage.label : 'Help Center'}</h2><p>Fanampiana amin’ny kaonty, famoronana tetikasa, fitahirizana rakitra ary famahana hadisoana.</p><p>Raha tsy mandeha ny génération, jereo ny hafatra aseho eo ambony ary aza averina imbetsaka ny fangatahana raha misy mety handany crédit.</p></section>}

              {activeView === 'settings' && <section className="workspace-card">
                <h2>{t('4N DEV Core')}</h2>
                <p>Ny modely sy ny Core API key dia tantanan’ny developer ao amin’ny serveur. Tsy mila mampiditra <code>4ndev_sk</code> ny mpampiasa, ary tsy aseho ao amin’ny navigateur ny lakile.</p>
                <p>Ny génération dia miasa rehefa voalamina ao amin’ny environment an’ny Builder ny <code>BUILDER_CORE_API_KEY</code>. Raha tsy mbola voalamina izany dia hampiseho hadisoana mazava ny backend.</p>
              </section>}

              {!['dashboard', 'builder', 'projects', 'files', 'settings', 'help'].includes(activeView) && <section className="workspace-card"><h2>{currentPage.label}</h2><p>Hovelarina aorian’ny fametrahana ny pipeline build voaaro sy preview mitokana.</p></section>}
            </>
          )}
        </div>
      </AppLayout>
      <Modal isOpen={modal && Boolean(user)} onClose={() => setModal(false)} title="Tetikasa AI vaovao" description="Mamorona rakitra amin’ny alalan’ny Core; ny fandaniana dia alaina amin’ny balance Core.">
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Farito ny tetikasa…" />
        <button disabled={busy || !prompt.trim()} onClick={createProject}>{busy ? 'Mamorona amin’ny AI…' : 'Mamorona application'}</button>
      </Modal>
    </>
  );
}

export default App;
