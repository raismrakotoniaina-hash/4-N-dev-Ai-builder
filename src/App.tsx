import { useEffect, useRef, useState } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { Modal } from './components/ui/Modal';
import { navigationItems } from './data/navigation';
import { builderApi, type BuilderBilling, type BuilderUser } from './lib/builderApi';
import { useLanguage } from './lib/i18n';
import type { AppView, Project, ProjectFile } from './types/app';

type ProjectWithFiles = Project & { files?: ProjectFile[]; fileCount?: number; previewHtml?: string };

function App() {
  const { t } = useLanguage();
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [modal, setModal] = useState(false);
  const [user, setUser] = useState<BuilderUser | null>(null);
  const [billing, setBilling] = useState<BuilderBilling | null>(null);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('yearly');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<ProjectWithFiles | null>(null);
  const [prompt, setPrompt] = useState('');
  const [message, setMessage] = useState('Midira na mamoròna kaonty hanombohana.');
  const [busy, setBusy] = useState(false);
  const [generationLog, setGenerationLog] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const currentPage = navigationItems.find((item) => item.id === activeView) ?? navigationItems[0];

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [generationLog]);

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

  useEffect(() => {
    if (!user || activeView !== 'settings') return;
    let active = true;
    builderApi.billing().then((state) => {
      if (active) setBilling(state);
    }).catch((error) => {
      if (active) setMessage(error instanceof Error ? error.message : 'Tsy afaka naka ny mombamomba ny billing.');
    });
    return () => { active = false; };
  }, [user, activeView]);

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
    if (!prompt.trim() || !user || busy) return;
    setBusy(true);
    const description = prompt.trim();
    setGenerationLog(['Manomana ny application…']);
    setActiveView('builder');
    setMessage('Mamorona ny application…');
    let progressPoller: number | undefined;
    try {
      const project = await builderApi.createProject(description.slice(0, 120), description.slice(0, 2000));
      progressPoller = window.setInterval(async () => {
        try {
          const status = await builderApi.generationStatus(project.id);
          if (status.steps.length) setGenerationLog(status.steps.map((step) => step.message));
        } catch {
          // Keep the current progress visible if a single status poll fails.
        }
      }, 1000);
      const generated = await builderApi.generateProject(project.id, description);
      if (progressPoller !== undefined) window.clearInterval(progressPoller);
      const finalStatus = await builderApi.generationStatus(project.id).catch(() => null);
      if (finalStatus?.steps.length) setGenerationLog(finalStatus.steps.map((step) => step.message));
      else setGenerationLog((previous) => [...previous, 'VITA: voatahiry ny rakitra ary nahomby ny build.']);
      await refreshProjects();
      const storedFiles = (generated.project as ProjectWithFiles).files || [];
      const previewHtml = storedFiles.find((file) => file.path === '__4ndev_preview.html')?.content;
      setSelected({ ...(generated.project as ProjectWithFiles), files: generated.generatedFiles as ProjectFile[], previewHtml });
      setPrompt('');
      setModal(false);
      setActiveView(generated.previewAvailable ? 'preview' : 'files');
      setMessage('Vita ny application. Rakitra: ' + generated.generatedFiles.length + (generated.mode === 'free-template' ? '.' : '. Crédit nampiasaina: ' + (generated.creditsCharged ?? 10) + '.'));
    } catch (error) {
      if (progressPoller !== undefined) window.clearInterval(progressPoller);
      const detail = error instanceof Error ? error.message : 'Tsy nahomby ny génération AI.';
      setGenerationLog((previous) => [...previous, 'TSY TAFITA: ' + detail]);
      setMessage(detail);
      await refreshProjects().catch(() => {});
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
              <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t('ianao@example.com')} /></label>
              <label>Teny miafina<input type="password" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t('Farafahakeliny 12 tarehintsoratra')} /></label>
              <button disabled={busy || !email.trim() || password.length < (authMode === 'register' ? 12 : 1)} onClick={submitAuth}>{busy ? 'Miandry…' : authMode === 'register' ? 'Mamorona kaonty' : 'Hiditra'}</button>
              <button className="project-row" disabled={busy} onClick={() => setAuthMode(authMode === 'register' ? 'login' : 'register')}>{authMode === 'register' ? 'Efa manana kaonty? Hiditra' : 'Tsy mbola manana kaonty? Hisoratra anarana'}</button>
            </section>
          ) : (
            <>
              <div className="workspace-card">
                <p>Kaonty: <strong>{user.email}</strong></p>
                <button className="project-row" onClick={signOut}>{t('Hivoaka')}</button>
              </div>

              {generationLog.length > 0 && <section className="workspace-card generation-progress" aria-live="polite">
                <h2>{busy ? 'Mandroso ny generation AI…' : 'Tatitra generation AI'}</h2>
                <p>Ireo dingana ireo dia tatitra avy amin’ny serveur, havaozina isaky ny mandroso ny Core na ny build worker.</p>
                <ol className="generation-log">{generationLog.map((line, index) => <li key={index} className={line.startsWith('VITA:') ? 'generation-log__done' : line.startsWith('TSY TAFITA:') ? 'generation-log__error' : ''}>{line}</li>)}</ol>
                {busy && <div className="generation-progress__bar" role="progressbar" aria-label="Famoronana application mandeha"><span /></div>}
                <div ref={logEndRef} />
              </section>}

              {activeView === 'dashboard' && <section className="workspace-grid">
                <div className="workspace-card workspace-hero">
                  <span className="eyebrow">{t('BUILD WITH AI')}</span><h2>{t('Farito ny tetikasanao.')}</h2>
                  <p>Mamoròna application web mifanaraka amin’ny finday sy solosaina. Ny Builder dia hanomana ny rakitra ary hanamarina ny build.</p>
                  <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={t('Ohatra: Mamoròna boutique misy catalogue, panier ary espace admin…')} />
                  <button disabled={busy || !prompt.trim()} onClick={createProject}>{busy ? 'Mamorona application…' : 'Mamorona application'}</button>
                </div>
                <div className="workspace-card"><h3>{t('Tetikasa')}</h3><strong>{projects.length}</strong><p>{t('Voatahiry isaky ny kaonty.')}</p>
                  {projects.slice(0, 5).map((project) => <button className="project-row" key={project.id} onClick={() => openProject(project)}>{project.name}</button>)}
                </div>
                <div className="workspace-card"><h3>{t('Core services')}</h3><p>Model catalogue · Core balance · Project storage</p><span className="core-badge">CORE MANAGED BY DEVELOPER</span></div>
              </section>}

              {activeView === 'builder' && <section className="workspace-card"><h2>AI Builder</h2><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={t('Farito ny zavatra tianao hatsangana…')} /><button disabled={busy || !prompt.trim()} onClick={createProject}>{busy ? 'Mitahiry…' : 'Mamorona sy mitahiry tetikasa'}</button><p>Farito ny application tianao hatsangana, dia tehirizo ao amin’ny tetikasanao.</p></section>}

              {activeView === 'projects' && <section className="workspace-card"><h2>{t('Ny tetikasako')}</h2><p>Tehirizina ao amin’ny backend, ary ny tompony ihany no mahazo azy.</p>{projects.map((project) => <button className="project-row" key={project.id} onClick={() => openProject(project)}>{project.name}</button>)}{!projects.length && <p>{t('Tsy mbola misy tetikasa.')}</p>}</section>}

              {activeView === 'preview' && <section className="workspace-card"><h2>{selected?.name || 'Preview application'}</h2>{selected?.previewHtml || selected?.files?.some((file) => file.path === '__4ndev_preview.html') ? <iframe title={'Preview ' + (selected?.name || 'application')} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={selected?.previewHtml || selected?.files?.find((file) => file.path === '__4ndev_preview.html')?.content} style={{ width: '100%', minHeight: '70vh', border: '1px solid #dbe2ee', borderRadius: '12px', background: '#fff' }} /> : <p>Tsy mbola misy preview voaorina ho an’ity tetikasa ity. Avereno ny generation rehefa misy ny build worker.</p>}<button onClick={() => setActiveView('files')}>Hijery ny rakitra</button></section>}

              {activeView === 'files' && <section className="workspace-card"><h2>{selected?.name || 'Rakitra tetikasa'}</h2>{selected?.files?.filter((file) => file.path !== '__4ndev_preview.html').length ? selected.files.filter((file) => file.path !== '__4ndev_preview.html').map((file) => <div className="file-row" key={file.path}><code>{file.path}</code><span>{file.content.length} chars</span><details><summary>{t('Jereo ny kaody')}</summary><pre>{file.content}</pre></details></div>) : <p>{selected ? 'Mbola tsy misy rakitra voatahiry ao amin’ity tetikasa ity.' : 'Misafidiana tetikasa ao amin’ny Projects.'}</p>}</section>}

              {activeView === 'help' && <section className="workspace-card"><h2>{currentPage.label === 'Help Center' ? currentPage.label : 'Help Center'}</h2><p>Fanampiana amin’ny kaonty, famoronana tetikasa, fitahirizana rakitra ary famahana hadisoana.</p><p>Raha tsy mandeha ny génération, jereo ny hafatra aseho eo ambony ary aza averina imbetsaka ny fangatahana raha misy mety handany crédit.</p></section>}

              {activeView === 'settings' && <>
                <section className="workspace-card">
                  <h2>{t('Abonnement sy crédit')}</h2>
                  <p>Misafidiana fandoavana isam-bolana na fandoavana 12 volana mialoha. Ny vidiny isan-taona dia misy fihenam-bidy raha oharina amin’ny fandoavana isam-bolana in-12.</p>
                  <div className="project-actions">
                    <button className={billingInterval === 'monthly' ? '' : 'project-row'} onClick={() => setBillingInterval('monthly')}>Volana 1</button>
                    <button className={billingInterval === 'yearly' ? '' : 'project-row'} onClick={() => setBillingInterval('yearly')}>Taona 1 — misy fihenam-bidy</button>
                  </div>
                  {billing ? <>
                    <div className="workspace-grid">
                      {billing.plans.map((plan) => {
                        const price = plan.pricesUsdCents[billingInterval];
                        return <article className="workspace-card" key={plan.id}>
                          <h3>{plan.id.toUpperCase()}</h3>
                          <p><strong>${(price / 100).toFixed(2)} USD</strong> {billingInterval === 'monthly' ? '/ volana' : '/ 12 volana'}</p>
                          {billingInterval === 'yearly' && plan.yearlySavingsUsdCents !== null && <p>Mitahiry ${(plan.yearlySavingsUsdCents / 100).toFixed(2)} USD isan-taona · mitovy amin’ny ${(plan.yearlyMonthlyEquivalentUsdCents / 100).toFixed(2)} USD/volana</p>}
                          <p>Crédit omena isam-bolana: {plan.monthlyCredits}</p>
                          {plan.prototypeOnly && <p>Famoronana maimaim-poana</p>}
                        </article>;
                      })}
                    </div>
                    <p>Fandoavam-bola sy renewal automatique: mbola tsy mandeha. Tsy mbola afaka mividy abonnement amin’ity efijery ity.</p>
                    <p>Satan’ny crédit: {billing.creditsPolicy.status}. Tsy mbola ampiharina ny fanomezana sy fahataperan’ny crédit isam-bolana.</p>
                    <p>Balance ankehitriny: {billing.creditsBalance} crédit.</p>
                  </> : <p>Maka ny vidiny sy ny satan’ny abonnement…</p>}
                </section>
                <section className="workspace-card">
                  <h2>{t('4N DEV Core')}</h2>
                  <p>Ny modely sy ny Core API key dia tantanan’ny developer ao amin’ny serveur. Tsy mila mampiditra <code>4ndev_sk</code> ny mpampiasa, ary tsy aseho ao amin’ny navigateur ny lakile.</p>
                  <p>Ny génération dia miasa rehefa voalamina ao amin’ny environment an’ny Builder ny <code>BUILDER_CORE_API_KEY</code>. Raha tsy mbola voalamina izany dia hampiseho hadisoana mazava ny backend.</p>
                </section>
              </>}

              {!['dashboard', 'builder', 'projects', 'files', 'settings', 'help'].includes(activeView) && <section className="workspace-card"><h2>{currentPage.label}</h2><p>Misafidiana tetikasa iray hanohizana.</p></section>}
            </>
          )}
        </div>
      </AppLayout>
      <Modal isOpen={modal && Boolean(user)} onClose={() => setModal(false)} title="Tetikasa AI vaovao" description="Farito ny application tianao hatsangana. Ho voatahiry ao amin’ny tetikasanao ny rakitra.">
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={t('Farito ny tetikasa…')} />
        <button disabled={busy || !prompt.trim()} onClick={createProject}>{busy ? 'Mamorona application…' : 'Mamorona application'}</button>
      </Modal>
    </>
  );
}

export default App;
