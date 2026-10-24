import { useEffect, useState } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { Modal } from './components/ui/Modal';
import { navigationItems } from './data/navigation';
import { builderApi, type BuilderUser } from './lib/builderApi';
import type { AppView, Project, ProjectFile } from './types/app';
import { useLanguage } from './lib/i18n';

type ProjectWithFiles = Project & { files?: ProjectFile[]; fileCount?: number };

function App() {
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [modal, setModal] = useState(false);
  const { t } = useLanguage();
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
  const translatedPage = { ...currentPage, label: t(currentPage.label), description: t(currentPage.description) };

  async function refreshProjects() {
    const items = await builderApi.listProjects();
    setProjects(items);
  }

  useEffect(() => {
    let active = true;
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
    if (!coreConnected) { setMessage(t('Ampifandraiso amin’ny Settings aloha ny 4N DEV Core API key.')); setActiveView('settings'); setModal(false); return; }
    setBusy(true);
    try {
      const description = prompt.trim();
      const project = await builderApi.createProject(description.slice(0, 120), description.slice(0, 2000));
      setMessage(t('Mamorona ny rakitra amin’ny alalan’ny 4N DEV Core…'));
      const generated = await builderApi.generateProject(project.id, description);
      await refreshProjects();
      setSelected(generated.project as ProjectWithFiles);
      setPrompt(''); setModal(false); setActiveView('files');
      const cost = typeof generated.usage?.charged_usd === 'number' ? ' | Core charge: $' + generated.usage.charged_usd.toFixed(4) : '';
      setMessage(t('Vita ny génération.') + ' Rakitra noforonina: ' + generated.generatedFiles.length + cost);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Tsy nahomby ny génération; mety mbola voatahiry ilay tetikasa.'));
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

  

  return (
    <>
      <AppLayout activeView={activeView} currentPage={translatedPage} isMobileSidebarOpen={mobile}
        isSidebarCollapsed={collapsed} onChangeView={setActiveView}
        onCloseMobileSidebar={() => setMobile(false)} onOpenMobileSidebar={() => setMobile(true)}
        onToggleSidebar={() => setCollapsed((value) => !value)} onNewProject={() => setModal(true)}>
        <div className="ai-builder-workspace">
          <div className="workspace-header">
            <div><span className="eyebrow">4N DEV AI BUILDER</span><h1>{translatedPage.label}</h1><p>{t('Workspace-nao hananganana sy hitantanana application.')}</p></div>
            <div className="workspace-status">{t(message)}</div>
          </div>

          {!user ? (
            <section className="workspace-card">
              <h2>{t(authMode === 'register' ? 'Mamoròna kaonty AI Builder' : 'Midira amin’ny kaontinao')}</h2>
              <p>{t('Ny kaonty Builder dia misaraka amin’ny Core Console. Ampifandraiso avy eo ny 4ndev_sk mba hampiasa ny balance Core-nao.')}</p>
              <label>{t('Email')}<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ianao@example.com" /></label>
              <label>{t('Teny miafina')}<input type="password" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t('Farafahakeliny 12 tarehintsoratra')} /></label>
              <button disabled={busy || !email.trim() || password.length < (authMode === 'register' ? 12 : 1)} onClick={submitAuth}>{busy ? t('Miandry…') : authMode === 'register' ? t('Mamorona kaonty') : t('Hiditra')}</button>
              <button className="project-row" disabled={busy} onClick={() => setAuthMode(authMode === 'register' ? 'login' : 'register')}>{t(authMode === 'register' ? 'Efa manana kaonty? Hiditra' : 'Tsy mbola manana kaonty? Hisoratra anarana')}</button>
            </section>
          ) : (
            <>
              <div className="workspace-card">
                <p>{t('Kaonty')}: <strong>{user.email}</strong></p>
                <button className="project-row" onClick={signOut}>Hivoaka</button>
              </div>

              {activeView === 'dashboard' && <section className="workspace-grid">
                <div className="workspace-card workspace-hero">
                  <span className="eyebrow">BUILD WITH AI</span><h2>{t('Farito ny tetikasanao.')}</h2>
                  <p>{t('Farito ny zavatra tianao hatsangana amin’ny alalan’ny AI.')}</p>
                  
                  <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={t('Ohatra: Mamoròna boutique misy catalogue, panier ary espace admin…')} />
                  <button disabled={busy || !prompt.trim()} onClick={createProject}>{busy ? t('Mitahiry…') : t('Mamorona application amin’ny AI')}</button>
                </div>
                <div className="workspace-card"><h3>{t('Tetikasa')}</h3><strong>{projects.length}</strong><p>{t('Voatahiry isaky ny kaonty.')}</p>
                  {projects.slice(0, 5).map((project) => <button className="project-row" key={project.id} onClick={() => openProject(project)}>{project.name}</button>)}
                </div>
                <div className="workspace-card"><h3>{t('Serivisy Core')}</h3><p>Core balance · Project storage</p><span className="core-badge">CORE CONNECT {coreConnected ? 'CONNECTED' : 'REQUIRED'}</span></div>
              </section>}

              {activeView === 'builder' && <section className="workspace-card"><h2>{t('AI Builder')}</h2><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={t('Farito ny zavatra tianao hatsangana…')} /><button disabled={busy || !prompt.trim()} onClick={createProject}>{busy ? t('Mitahiry…') : t('Mamorona application amin’ny AI')}</button><p>{t('Ny AI Builder no mandrindra ny modely Core ao ambadika.')}</p></section>}

              {activeView === 'projects' && <section className="workspace-card"><h2>{t('Ny tetikasako')}</h2><p>{t('Tehirizina ao amin’ny backend, ary ny tompony ihany no mahazo azy.')}</p>{projects.map((project) => <button className="project-row" key={project.id} onClick={() => openProject(project)}>{project.name}</button>)}{!projects.length && <p>Tsy mbola misy tetikasa.</p>}</section>}

              {activeView === 'files' && <section className="workspace-card"><h2>{selected?.name || t('Rakitra tetikasa')}</h2>{selected?.files?.length ? selected.files.map((file) => <div className="file-row" key={file.path}><code>{file.path}</code><span>{file.content.length} chars</span></div>) : <p>{t(selected ? 'Mbola tsy misy rakitra voatahiry ao amin’ity tetikasa ity.' : 'Misafidiana tetikasa ao amin’ny Projects.')}</p>}</section>}

              {activeView === 'settings' && <section className="workspace-card">
                <h2>{t('Fampifandraisana 4N DEV Core')}</h2>
                <p>{t('Core API:')} <code>https://api.4ndev.dev</code>. {t('Ny Core no mitantana ny balance sy billing. Tsy tehirizina ao amin’ny navigateur ny lakile.')}</p>
                <p>{t('Toetry ny fifandraisana')}: <strong>{t(coreConnected ? 'Mifandray' : 'Tsy mbola mifandray')}</strong></p>
                {!coreConnected && <><label>4N DEV Core secret key<input type="password" autoComplete="off" value={coreKey} onChange={(event) => setCoreKey(event.target.value)} placeholder="4ndev_sk_…" /></label><button disabled={busy || !coreKey.trim()} onClick={connectCore}>{busy ? t('Manamarina…') : t('Ampifandraiso ny Core')}</button></>}
                {coreConnected && <><button disabled={busy} onClick={loadCoreCredits}>{t('Jereo ny balance Core')}</button><button className="project-row" disabled={busy} onClick={async () => { await builderApi.disconnectCore(); setCoreConnected(false); setCoreCredits(''); setSettingsMessage('Nesorina ny fifandraisana Core.'); }}>{t('Esory ny fifandraisana')}</button></>}
                {settingsMessage && <p>{settingsMessage}</p>}
                {coreCredits && <pre>{coreCredits}</pre>}
              </section>}

              {!['dashboard', 'builder', 'projects', 'files', 'settings'].includes(activeView) && <section className="workspace-card"><h2>{currentPage.label}</h2><p>Hovelarina aorian’ny fametrahana ny pipeline build voaaro sy preview mitokana.</p></section>}
            </>
          )}
        </div>
      </AppLayout>
      <Modal isOpen={modal && Boolean(user)} onClose={() => setModal(false)} title={t('Tetikasa AI vaovao')} description={t('Mamorona rakitra amin’ny alalan’ny Core; ny fandaniana dia alaina amin’ny balance Core.')}>
        
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={t('Farito ny tetikasa…')} />
        <button disabled={busy || !prompt.trim()} onClick={createProject}>{busy ? t('Mitahiry…') : t('Mamorona application')}</button>
      </Modal>
    </>
  );
}

export default App;
