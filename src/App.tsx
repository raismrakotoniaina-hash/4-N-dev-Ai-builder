import { useEffect, useMemo, useState } from 'react';
import { translate, type Language } from './lib/i18n';
import { ArrowRight, CheckCircle2, Code2, CreditCard, FolderOpen, LoaderCircle, LogOut, Monitor, Plus, Smartphone, Sparkles, Terminal, X } from 'lucide-react';

type User = { id: string; email: string };
type BillingInterval = '1_month' | '3_months' | '6_months' | '12_months';
type BillingPlan = { id: 'free' | 'starter' | 'pro' | 'business'; pricesUsdCents: Record<BillingInterval, number>; durations: BillingInterval[]; prototypeOnly: boolean };
type BillingState = { subscription: { plan: 'free' | 'starter' | 'pro' | 'business'; billingInterval: BillingInterval | 'monthly'; status: string; priceUsdCents: number; currency: string; periodStart: string | null; periodEnd: string | null; cancelAtPeriodEnd: boolean }; creditsBalance: number; freeGeneration: { status: 'available' | 'processing' | 'used'; projectId: string | null; usedAt: string | null }; plans: BillingPlan[]; paymentsEnabled: boolean; renewalEnabled: boolean; creditsPolicy: { status: string }; integrations?: { github: { available: boolean; status: string; eligiblePlans: string[]; message: string } } };
type Project = { id: string; name: string; description?: string; status?: string; updated_at?: string; files?: FileItem[] };
type FileItem = { path: string; content: string };
type Mode = 'web' | 'mobile';
type Screen = 'build' | 'projects' | 'code' | 'preview' | 'billing';
const API = (import.meta.env.VITE_BUILDER_API_URL || window.location.origin).replace(/\/$/, '');
const BILLING_INTERVALS: { id: BillingInterval; label: string; months: number }[] = [
  { id: '1_month', label: '1 month', months: 1 },
  { id: '3_months', label: '3 months', months: 3 },
  { id: '6_months', label: '6 months', months: 6 },
  { id: '12_months', label: '1 year', months: 12 }
];
const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(cents / 100);
const discountPercent = (monthly: number, total: number, months: number) => monthly > 0 && months > 1 ? Math.max(0, Math.round((1 - total / (monthly * months)) * 100)) : 0;
async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(API + path, { ...init, credentials: 'include', headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success !== true) throw new Error(data.error || 'Request failed (' + response.status + ')');
  return data as T;
}
export default function App() {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('4n-builder-language');
      if (saved === 'mg' || saved === 'fr' || saved === 'en') return saved;
    } catch {}
    return 'mg';
  });
  const t = (value: string) => translate(value, language);
  useEffect(() => {
    try { localStorage.setItem('4n-builder-language', language); } catch {}
  }, [language]);
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('1_month');
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [activeFile, setActiveFile] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [savingFile, setSavingFile] = useState(false);
  const [buildBusy, setBuildBusy] = useState(false);
  const [mode, setMode] = useState<Mode>('web');
  const [screen, setScreen] = useState<Screen>('build');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [query, setQuery] = useState('');
  const sourceFiles = files.filter(f => f.path !== '__4ndev_preview.html');
  const currentFile = sourceFiles.find(f => f.path === activeFile) || sourceFiles[0];
  const previewFile = files.find(f => f.path === '__4ndev_preview.html');
  const filtered = useMemo(() => projects.filter(p => p.name.toLowerCase().includes(query.toLowerCase())), [projects, query]);
  const paidActive = Boolean(billing?.subscription && billing.subscription.plan !== 'free' && billing.subscription.status === 'active' && billing.subscription.periodEnd && Date.parse(billing.subscription.periodEnd) > Date.now());
  const canGenerate = Boolean(billing && (paidActive || billing.freeGeneration.status === 'available'));

  async function refreshBilling() {
    const result = await api<{ billing: BillingState }>('/api/billing');
    setBilling(result.billing);
  }
  async function refreshProjects() {
    const result = await api<{ projects: Project[] }>('/api/projects');
    setProjects(result.projects || []);
  }
  async function openProject(item: Project) {
    try {
      const result = await api<{ project: Project }>('/api/projects/' + item.id);
      setProject(result.project);
      const nextFiles = result.project.files || [];
      setFiles(nextFiles);
      const firstSource = nextFiles.find(f => f.path !== '__4ndev_preview.html');
      setActiveFile(firstSource?.path || '');
      setDraftContent(firstSource?.content || '');
      setScreen('code');
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open project.'); }
  }
  useEffect(() => {
    let alive = true;
    api<{ user: User }>('/api/auth/me')
      .then(async r => {
        if (!alive) return;
        setUser(r.user);
        const results = await Promise.allSettled([refreshProjects(), refreshBilling()]);
        if (!alive) return;
        if (results[0].status === 'rejected') setError('Could not load your projects. Please refresh.');
        if (results[1].status === 'rejected') setError('Could not load subscription status. Refresh before generating.');
      })
      .catch(() => { if (alive) setUser(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  async function authenticate(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const r = await api<{ user: User }>('/api/auth/' + authMode, { method: 'POST', body: JSON.stringify({ email, password }) });
      setUser(r.user);
      const results = await Promise.allSettled([refreshProjects(), refreshBilling()]);
      if (results[0].status === 'rejected') setError('Signed in, but projects could not be loaded. Please refresh.');
      if (results[1].status === 'rejected') setError('Signed in, but subscription status could not be loaded. Refresh before generating.');
      setNotice('Welcome to your workspace.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not sign in.'); }
    finally { setBusy(false); }
  }
  function startNewProject() {
    setProject(null); setFiles([]); setActiveFile(''); setDraftContent(''); setPrompt(''); setError(''); setNotice(''); setScreen('build'); setMobileMenu(false);
  }
  async function saveCurrentFile() {
    if (!project || !currentFile || savingFile || draftContent === currentFile.content) return;
    setSavingFile(true); setError(''); setNotice('');
    try {
      const result = await api<{ file: FileItem }>('/api/projects/' + project.id + '/files', {
        method: 'PUT', body: JSON.stringify({ path: currentFile.path, content: draftContent })
      });
      setFiles(previous => previous.map(file => file.path === result.file.path ? result.file : file));
      setProject(previous => previous ? { ...previous, files: (previous.files || []).map(file => file.path === result.file.path ? result.file : file) } : previous);
      setNotice('Source saved. Run a new validated build before sharing or publishing this version.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this file.'); }
    finally { setSavingFile(false); }
  }
  async function buildAndValidate() {
    if (!project || buildBusy || savingFile) return;
    setBuildBusy(true); setError(''); setNotice('');
    try {
      if (currentFile && draftContent !== currentFile.content) {
        const saved = await api<{ file: FileItem }>('/api/projects/' + project.id + '/files', {
          method: 'PUT', body: JSON.stringify({ path: currentFile.path, content: draftContent })
        });
        setFiles(previous => previous.map(file => file.path === saved.file.path ? saved.file : file));
        setProject(previous => previous ? { ...previous, files: (previous.files || []).map(file => file.path === saved.file.path ? saved.file : file) } : previous);
      }
      const result = await api<{ project: Project; previewAvailable: boolean; log: string }>('/api/projects/' + project.id + '/validate', { method: 'POST' });
      const nextFiles = result.project.files || [];
      setProject(result.project); setFiles(nextFiles);
      setNotice(result.previewAvailable ? 'Build and validation passed. The preview now matches the saved source.' : 'Build passed. No preview artifact was returned.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Build validation failed. The last successful preview is preserved.');
    } finally { setBuildBusy(false); }
  }
  async function signOut() {
    try { await api('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) }); } catch {}
    setUser(null); setProjects([]); setProject(null); setFiles([]); setScreen('build');
  }
  async function generate(text = prompt, target = mode) {
    const brief = text.trim();
    if (!brief) { setError('Soraty aloha izay application tianao hatsangana.'); return; }
    if (!billing) { setError('Subscription status is not available yet. Refresh the workspace before generating.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      let active = project;
      if (!active) {
        const created = await api<{ project: Project }>('/api/projects', { method: 'POST', body: JSON.stringify({ name: brief.slice(0, 56) || (target === 'mobile' ? 'Mobile app' : 'Web app'), description: brief }) });
        active = created.project; setProject(active);
      }
      const fullPrompt = 'TARGET PLATFORM: ' + (target === 'mobile' ? 'MOBILE. Generate a native Expo React Native app for Android and iOS in the mobile/ directory.' : 'WEB. Generate a responsive React + TypeScript + Vite web app.') + '\n' + brief;
      if (!paidActive && billing.freeGeneration.status !== 'available') throw new Error(t(billing.freeGeneration.status === 'processing' ? 'Your free generation is in progress.' : 'Your one free Core generation has already been used. Choose a paid plan to generate again.'));
      const result = await api<{ project: Project; usage?: { charged_usd?: number }; generationMode?: string }>('/api/projects/' + active.id + '/generate', { method: 'POST', body: JSON.stringify({ prompt: fullPrompt }) });
      const generated = result.project.files || [];
      const firstSource = generated.find(f => f.path !== '__4ndev_preview.html');
      setFiles(generated); setActiveFile(firstSource?.path || ''); setDraftContent(firstSource?.content || ''); setProject(result.project); await Promise.all([refreshProjects(), refreshBilling()]); setScreen(generated.some(f => f.path === '__4ndev_preview.html') ? 'preview' : 'code');
      setNotice(!paidActive ? t('Your free Core generation is ready.') : t('AI generation and build validation completed.'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed.');
      if (files.some(file => file.path !== '__4ndev_preview.html')) setScreen('code');
    }
    finally { setBusy(false); }
  }
  if (loading) return <main className="loading-screen"><LoaderCircle className="spin" size={28}/><span>{t("Loading your workspace…")}</span></main>;
  if (!user) return <main className="auth-screen"><div className="auth-glow"/><section className="auth-card"><div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}><select aria-label="Language" value={language} onChange={event=>setLanguage(event.target.value as Language)} style={{background:'transparent',border:'1px solid var(--border, #dbe2ee)',borderRadius:8,padding:'7px 9px',color:'inherit',fontSize:12}}><option value="mg">Malagasy</option><option value="fr">Français</option><option value="en">English</option></select></div><div className="brand"><span className="brand-icon"><Sparkles size={21}/></span><span><b>4N DEV</b><small>AI APP STUDIO</small></span></div><p className="eyebrow">{t("YOUR IDEA, BUILT WITH AI")}</p><h1>{t("Make something")}<br/><em>{t("remarkable.")}</em></h1><p className="auth-copy">{t("Describe your idea. Build for the web or create a native mobile app from one workspace.")}</p><form onSubmit={authenticate}><label>{t("Email address")}</label><input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/><label>{t("Password")}</label><input type="password" minLength={12} autoComplete={authMode==='login'?'current-password':'new-password'} required value={password} onChange={e=>setPassword(e.target.value)} placeholder={t("At least 12 characters")}/>{error&&<p className="error">{error}</p>}<button className="primary full" disabled={busy}>{busy?<LoaderCircle className="spin" size={17}/>:null}{t(authMode==='register'?'Create workspace':'Sign in')}<ArrowRight size={17}/></button></form><p className="switch-auth">{t(authMode==='register'?'Already have an account?':'New to 4N DEV?')} <button onClick={()=>{setAuthMode(authMode==='register'?'login':'register');setError('')}}>{t(authMode==='register'?'Sign in':'Create workspace')}</button></p><div className="secure-note"><CheckCircle2 size={14}/> {t('Private workspace · Your projects stay yours')}</div></section></main>;

  return <div className="app-shell"><aside className={'sidebar '+(mobileMenu?'sidebar-open':'')}><div className="brand"><span className="brand-icon"><Sparkles size={21}/></span><span><b>4N DEV</b><small>AI APP STUDIO</small></span><button className="close-menu" onClick={()=>setMobileMenu(false)}><X size={18}/></button></div><button className="workspace-card"><span className="workspace-avatar">{user.email[0]?.toUpperCase()}</span><span><b>{t("My workspace")}</b><small>{user.email}</small></span></button><p className="nav-label">{t("WORKSPACE")}</p><button className={'nav-link '+(screen==='build'?'selected':'')} onClick={startNewProject}><Sparkles size={17}/> {t('Create app')}</button><button className={'nav-link '+(screen==='projects'?'selected':'')} onClick={()=>{setScreen('projects');setMobileMenu(false)}}><FolderOpen size={17}/> {t('My projects')} <span className="nav-count">{projects.length}</span></button><button className={'nav-link '+(screen==='preview'?'selected':'')} onClick={()=>{setScreen('preview');setMobileMenu(false)}} disabled={!previewFile}><Monitor size={17}/> {t('Preview')}</button><button className={'nav-link '+(screen==='billing'?'selected':'')} onClick={()=>{setScreen('billing');setMobileMenu(false);setError('');refreshBilling()}}><CreditCard size={17}/> {t('Billing')}</button><div className="sidebar-bottom"><button className="nav-link signout" onClick={signOut}><LogOut size={17}/> {t('Sign out')}</button></div></aside><main className="main-area"><header className="topbar"><button className="menu-button" onClick={()=>setMobileMenu(true)}><span>☰</span></button><div className="breadcrumbs"><span>{t("Workspace")}</span><span>/</span><b>{t(screen==='build'?'Create app':screen==='projects'?'My projects':screen==='billing'?'Billing':project?.name||'Code')}</b></div><div className="top-actions"><select aria-label="Language" value={language} onChange={event=>setLanguage(event.target.value as Language)} style={{background:'transparent',border:'1px solid var(--border, #dbe2ee)',borderRadius:8,padding:'7px 9px',color:'inherit',fontSize:12}}><option value="mg">Malagasy</option><option value="fr">Français</option><option value="en">English</option></select><span className="avatar">{user.email[0]?.toUpperCase()}</span><span className="user-email">{user.email}</span></div></header>
  {screen==='build'&&<section className="builder-page"><div className="hero"><h1>{t("What will you")}<br className="mobile-break"/> <em>{t("build today?")}</em></h1></div><div className="composer"><div className="composer-top"><div><span className="composer-kicker">{t("NEW PROJECT")}</span><h2>{t("Describe your app")}</h2></div></div><div className="mode-picker"><button className={mode==='web'?'mode-option active':'mode-option'} onClick={()=>setMode('web')}><Monitor size={19}/><span><b>{t("Web app")}</b><small>{t('React · TypeScript')}</small></span>{mode==='web'&&<CheckCircle2 size={16}/>}</button><button className={mode==='mobile'?'mode-option active':'mode-option'} onClick={()=>setMode('mobile')}><Smartphone size={19}/><span><b>{t("Mobile app")}</b><small>{t('Expo · Android & iOS')}</small></span>{mode==='mobile'&&<CheckCircle2 size={16}/>}</button></div><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder={t(mode==='web'?'A booking platform with a calendar, customer accounts, and an admin dashboard…':'A mobile habit tracker with daily goals, reminders, and progress charts…')} rows={5} maxLength={12000}/><div className="composer-bottom"><span>{prompt.length.toLocaleString()} / 12,000 characters</span><button className="primary" onClick={()=>generate()} disabled={busy||!prompt.trim()||!canGenerate}>{busy?<><LoaderCircle size={17} className="spin"/> {t('Building…')}</>:<><Sparkles size={17}/> {t('Generate with 4N Core')} <ArrowRight size={16}/></>}</button></div>{billing&&!paidActive&&<div className="notice-banner"><CheckCircle2 size={16}/><span>{t(billing.freeGeneration.status==='available'?'One free Core generation available':billing.freeGeneration.status==='processing'?'Your free generation is in progress.':'Your one free Core generation has already been used. Choose a paid plan to generate again.')}</span></div>}{error&&<div className="error-banner">{error}</div>}{notice&&<div className="notice-banner"><CheckCircle2 size={16}/>{notice}</div>}<p className="privacy-line"><CheckCircle2 size={14}/> Your app is generated in an isolated build environment.</p></div></section>}
  {screen==='projects'&&<section className="content-page"><div className="page-title-row"><div><span className="composer-kicker">{t("YOUR WORKSPACE")}</span><h1>{t("My projects")}</h1><p>{t("Pick up where you left off.")}</p></div><button className="primary" onClick={()=>{setProject(null);setFiles([]);setPrompt('');setScreen('build')}}><Plus size={17}/> {t('New project')}</button></div><input className="search-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('Search projects…')}/>{error&&<p className="error">{error}</p>}<div className="project-grid">{filtered.map(p=><button className="project-card" key={p.id} onClick={()=>openProject(p)}><span className="project-symbol"><FolderOpen size={20}/></span><b>{p.name}</b><small>{p.description||'AI-generated project'}</small><span className="project-meta">{p.status||'Saved project'} <ArrowRight size={15}/></span></button>)}</div>{!filtered.length&&<div className="empty-state"><FolderOpen size={28}/><b>{t("No projects yet")}</b><p>{t("Your generated apps will appear here.")}</p><button className="secondary" onClick={()=>setScreen('build')}>{t("Create your first app")}</button></div>}</section>}
  {screen==='billing'&&<section className="content-page billing-page">
    <div className="page-title-row"><div><span className="composer-kicker">SUBSCRIPTION</span><h1>{t("Plans & billing")}</h1><p>{t("Choose how long you want your 4N DEV plan to run.")}</p></div><button className="secondary" onClick={()=>refreshBilling()}><LoaderCircle size={15}/> {t('Refresh billing')}</button></div>
    {billing ? <><div className="billing-current"><div><span className="billing-label">{t("CURRENT PLAN")}</span><h2>{billing.subscription.plan.toUpperCase()}</h2><p>{billing.subscription.plan==='free'?t('Free plan'):billing.subscription.status==='active'?t('Subscription active'):`Status: ${billing.subscription.status}`}</p></div><div className="billing-current-meta"><b>{billing.subscription.plan==='free'?'$0':money(billing.subscription.priceUsdCents)}</b><span>{billing.subscription.periodEnd?new Date(billing.subscription.periodEnd).toLocaleDateString():'No paid subscription'}</span><small>{billing.subscription.plan==='free'?t(billing.freeGeneration.status==='used'?'Free generation used':billing.freeGeneration.status==='processing'?'Free generation in progress':'One free Core generation available'):billing.subscription.cancelAtPeriodEnd?'Cancellation scheduled at period end':t('AI usage and credits are managed by 4N Core.')}</small></div></div>
      <div className="billing-selector-heading"><div><span className="composer-kicker">{t("BILLING PERIOD")}</span><p>{t("Longer periods cost less per month.")}</p></div></div><div className="billing-periods">{BILLING_INTERVALS.map(option=>{const sample=billing.plans.find(p=>p.id==='starter');const base=sample?.pricesUsdCents['1_month']||0;const total=sample?.pricesUsdCents[option.id]||0;const discount=discountPercent(base,total,option.months);return <button key={option.id} className={billingInterval===option.id?'billing-period active':'billing-period'} onClick={()=>setBillingInterval(option.id)}><b>{t(option.label)}</b>{discount>0&&<small>Save {discount}%</small>}</button>})}</div>
      <div className="billing-plan-grid">{billing.plans.filter(plan=>plan.id!=='free').map(plan=>{const total=plan.pricesUsdCents[billingInterval];const months=BILLING_INTERVALS.find(item=>item.id===billingInterval)!.months;const monthly=plan.pricesUsdCents['1_month'];const discount=discountPercent(monthly,total,months);const active=billing.subscription.plan===plan.id&&billing.subscription.status==='active';return <article className={plan.id==='pro'?'billing-plan featured':'billing-plan'} key={plan.id}>{plan.id==='pro'&&<span className="billing-popular">{t('POPULAR')}</span>}<span className="billing-plan-name">{plan.id.toUpperCase()}</span><div className="billing-price">{money(total)}<small> / {months===1?'month':months===12?'year':`${months} months`}</small></div><p className="billing-monthly">{money(Math.round(total/months))} / month equivalent</p>{discount>0?<span className="billing-saving">Save {discount}%</span>:<span className="billing-saving muted">{t('Flexible monthly billing')}</span>}<ul><li><CheckCircle2 size={14}/> {t('AI app generation through 4N Core')}</li><li><CheckCircle2 size={14}/> {t('Web and mobile projects')}</li><li><CheckCircle2 size={14}/> {t('Editable source and build validation')}</li>{(plan.id==='pro'||plan.id==='business')&&<li><CheckCircle2 size={14}/> {t('GitHub integration planned · not available yet')}</li>}</ul><button className={active?'secondary':'primary'} disabled={!billing.paymentsEnabled||active}>{active?t('Current plan'):billing.paymentsEnabled?'Choose '+plan.id:t('Payments not enabled')}</button></article>})}</div>
    </> : <div className="empty-state"><CreditCard size={28}/><b>{t("Billing details unavailable")}</b><p>{t("Refresh the page after checking your connection.")}</p></div>}
    {error&&<div className="error-banner">{error}</div>}
  </section>}
  {screen==='code'&&<section className="content-page code-page"><div className="page-title-row"><div><span className="composer-kicker">{t("GENERATED PROJECT")}</span><h1>{project?.name||'Your app'}</h1><p>{sourceFiles.length} files · saved to your workspace</p></div><div className="row-actions"><button className="primary" onClick={buildAndValidate} disabled={buildBusy||savingFile}>{buildBusy?<LoaderCircle size={16} className="spin"/>:<CheckCircle2 size={16}/>} {t(buildBusy?'Building…':'Build & Validate')}</button>{previewFile&&<button className="secondary" onClick={()=>setScreen('preview')}><Monitor size={16}/> {t('Preview app')}</button>}<button className="secondary" onClick={startNewProject}><Plus size={16}/> {t('New generation')}</button></div></div>{notice&&<div className="notice-banner"><CheckCircle2 size={16}/>{notice}</div>}{error&&<div className="error-banner">{error}</div>}<div className="code-layout"><aside className="file-list"><div className="file-list-heading"><FolderOpen size={15}/> PROJECT FILES</div>{sourceFiles.map(f=><button key={f.path} className={currentFile?.path===f.path?'file-row active':'file-row'} onClick={()=>{setActiveFile(f.path);setDraftContent(f.content)}}><Code2 size={14}/><span>{f.path}</span></button>)}</aside><div className="code-view"><div className="code-toolbar"><span><Terminal size={15}/>{currentFile?.path||'Select a file'}</span><span>{draftContent.length.toLocaleString()} chars</span></div>{currentFile ? <><textarea className="code-editor" aria-label={'Edit ' + currentFile.path} spellCheck={false} value={draftContent} onChange={event=>setDraftContent(event.target.value)} /><div className="code-save-bar"><span>{draftContent === currentFile.content ? t('All changes saved') : t('Unsaved changes')}</span><button className="primary" onClick={saveCurrentFile} disabled={savingFile || draftContent === currentFile.content}>{savingFile ? <LoaderCircle size={15} className="spin"/> : null}{t('Save file')}</button></div></> : <div className="empty-state"><Code2 size={28}/><b>{t("No source files available")}</b><p>{t("Your project and original prompt are preserved. Return to Create app to retry generation.")}</p><button className="secondary" onClick={()=>setScreen('build')}>{t("Back to prompt")}</button></div>}</div></div></section>}{screen==='preview'&&<section className="content-page preview-page"><div className="page-title-row"><div><span className="composer-kicker">{t("LIVE WORKSPACE")}</span><h1>{project?.name||'Your app'}</h1><p>{t("Preview of the isolated, validated build.")}</p></div><button className="secondary" onClick={()=>setScreen('code')}><Code2 size={16}/> View source</button></div>{previewFile?<iframe title={(project?.name||'Application')+' preview'} srcDoc={previewFile.content} sandbox="allow-scripts" referrerPolicy="no-referrer" style={{display:'block',width:'100%',height:'min(76vh,900px)',minHeight:480,border:'1px solid #e2e7f0',borderRadius:16,background:'#fff'}}/>:<div className="empty-state"><Monitor size={28}/><b>{t("Preview not available")}</b><p>This project has no validated preview artifact yet. Return to the code editor and run Build & Validate.</p><button className="secondary" onClick={()=>setScreen('build')}>Build prototype</button></div>}</section>}</main></div>;
}
