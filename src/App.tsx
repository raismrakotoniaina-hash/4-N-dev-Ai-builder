import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Code2, FolderOpen, LoaderCircle, LogOut, Monitor, Plus, Settings, Smartphone, Sparkles, Terminal, X } from 'lucide-react';

type User = { id: string; email: string };
type Project = { id: string; name: string; description?: string; status?: string; updated_at?: string; files?: FileItem[] };
type FileItem = { path: string; content: string };
type Mode = 'web' | 'mobile';
type Screen = 'build' | 'projects' | 'code' | 'settings';
const API = (import.meta.env.VITE_BUILDER_API_URL || window.location.origin).replace(/\/$/, '');
const starters = [
  { title: 'SaaS dashboard', detail: 'Metrics, team workspace and settings', mode: 'web' as Mode, prompt: 'Build a responsive SaaS dashboard with analytics cards, charts, team management, settings, and realistic sample data.' },
  { title: 'Online store', detail: 'Products, search and shopping cart', mode: 'web' as Mode, prompt: 'Build a responsive online store with product search, categories, product detail pages, cart quantity controls, and checkout summary.' },
  { title: 'Task manager', detail: 'Tasks, filters and progress', mode: 'mobile' as Mode, prompt: 'Build a native Expo React Native mobile task manager for Android and iOS with task creation, editing, completion, filters, and local persistence.' }
];
async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(API + path, { ...init, credentials: 'include', headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success !== true) throw new Error(data.error || 'Request failed (' + response.status + ')');
  return data as T;
}
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [activeFile, setActiveFile] = useState('');
  const [mode, setMode] = useState<Mode>('web');
  const [screen, setScreen] = useState<Screen>('build');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [query, setQuery] = useState('');
  const [coreKey, setCoreKey] = useState('');
  const [coreConnected, setCoreConnected] = useState(false);
  const [coreBalance, setCoreBalance] = useState<string | null>(null);
  const [coreBusy, setCoreBusy] = useState(false);
  const currentFile = files.find(f => f.path === activeFile) || files[0];
  const filtered = useMemo(() => projects.filter(p => p.name.toLowerCase().includes(query.toLowerCase())), [projects, query]);

  async function refreshCoreStatus() {
    try {
      const status = await api<{ connected: boolean }>('/api/core/connection');
      setCoreConnected(status.connected);
      if (status.connected) {
        const result = await api<{ credits: unknown }>('/api/core/credits');
        setCoreBalance(JSON.stringify(result.credits));
      } else setCoreBalance(null);
    } catch (e) { setCoreBalance(e instanceof Error ? e.message : 'Core balance unavailable.'); }
  }
  async function connectCore() {
    if (!coreKey.trim()) { setError('Ampidiro ny Core key.'); return; }
    setCoreBusy(true); setError(''); setNotice('');
    try {
      await api('/api/core/connect', { method: 'POST', body: JSON.stringify({ apiKey: coreKey.trim() }) });
      setCoreKey(''); setCoreConnected(true); await refreshCoreStatus(); setNotice('4N Core connected successfully.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not connect 4N Core.'); }
    finally { setCoreBusy(false); }
  }
  async function disconnectCore() {
    setCoreBusy(true); setError('');
    try {
      await api('/api/core/connection', { method: 'DELETE' });
      setCoreConnected(false); setCoreBalance(null); setNotice('4N Core key disconnected.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not disconnect Core.'); }
    finally { setCoreBusy(false); }
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
      setActiveFile(nextFiles[0]?.path || '');
      setScreen('code');
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open project.'); }
  }
  useEffect(() => {
    api<{ user: User }>('/api/auth/me').then(r => { setUser(r.user); return Promise.all([refreshProjects(), refreshCoreStatus()]); })
      .catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);
  async function authenticate(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const r = await api<{ user: User }>('/api/auth/' + authMode, { method: 'POST', body: JSON.stringify({ email, password }) });
      setUser(r.user); await Promise.all([refreshProjects(), refreshCoreStatus()]); setNotice('Welcome to your workspace.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not sign in.'); }
    finally { setBusy(false); }
  }
  async function signOut() {
    try { await api('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) }); } catch {}
    setUser(null); setProjects([]); setProject(null); setFiles([]); setScreen('build');
  }
  async function generate(text = prompt, target = mode) {
    const brief = text.trim();
    if (!brief) { setError('Soraty aloha izay application tianao hatsangana.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      let active = project;
      if (!active) {
        const created = await api<{ project: Project }>('/api/projects', { method: 'POST', body: JSON.stringify({ name: brief.slice(0, 56) || (target === 'mobile' ? 'Mobile app' : 'Web app'), description: brief }) });
        active = created.project; setProject(active);
      }
      const fullPrompt = 'TARGET PLATFORM: ' + (target === 'mobile' ? 'MOBILE. Generate a native Expo React Native app for Android and iOS in the mobile/ directory.' : 'WEB. Generate a responsive React + TypeScript + Vite web app.') + '\n' + brief;
      const result = await api<{ project: Project; usage?: { charged_usd?: number } }>('/api/projects/' + active.id + '/generate', { method: 'POST', body: JSON.stringify({ prompt: fullPrompt }) });
      const generated = result.project.files || [];
      setFiles(generated); setActiveFile(generated[0]?.path || ''); setProject(result.project); await refreshProjects(); setScreen('code');
      setNotice('Generation and isolated build validation completed.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Generation failed.'); }
    finally { setBusy(false); }
  }
  if (loading) return <main className="loading-screen"><LoaderCircle className="spin" size={28}/><span>Loading your workspace…</span></main>;
  if (!user) return <main className="auth-screen"><div className="auth-glow"/><section className="auth-card"><div className="brand"><span className="brand-icon"><Sparkles size={21}/></span><span><b>4N DEV</b><small>AI APP STUDIO</small></span></div><p className="eyebrow">YOUR IDEA, BUILT WITH AI</p><h1>Make something<br/><em>remarkable.</em></h1><p className="auth-copy">Describe your idea. Build for the web or create a native mobile app from one workspace.</p><form onSubmit={authenticate}><label>Email address</label><input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/><label>Password</label><input type="password" minLength={12} autoComplete={authMode==='login'?'current-password':'new-password'} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 10 characters"/>{error&&<p className="error">{error}</p>}<button className="primary full" disabled={busy}>{busy?<LoaderCircle className="spin" size={17}/>:null}{authMode==='register'?'Create workspace':'Sign in'}<ArrowRight size={17}/></button></form><p className="switch-auth">{authMode==='register'?'Already have an account?':'New to 4N DEV?'} <button onClick={()=>{setAuthMode(authMode==='register'?'login':'register');setError('')}}>{authMode==='register'?'Sign in':'Create account'}</button></p><div className="secure-note"><CheckCircle2 size={14}/> Private workspace · Your projects stay yours</div></section></main>;

  return <div className="app-shell"><aside className={'sidebar '+(mobileMenu?'sidebar-open':'')}><div className="brand"><span className="brand-icon"><Sparkles size={21}/></span><span><b>4N DEV</b><small>AI APP STUDIO</small></span><button className="close-menu" onClick={()=>setMobileMenu(false)}><X size={18}/></button></div><button className="workspace-card"><span className="workspace-avatar">{user.email[0]?.toUpperCase()}</span><span><b>My workspace</b><small>{user.email}</small></span></button><p className="nav-label">WORKSPACE</p><button className={'nav-link '+(screen==='build'?'selected':'')} onClick={()=>{setScreen('build');setMobileMenu(false)}}><Sparkles size={17}/> Create app</button><button className={'nav-link '+(screen==='projects'?'selected':'')} onClick={()=>{setScreen('projects');setMobileMenu(false)}}><FolderOpen size={17}/> My projects <span className="nav-count">{projects.length}</span></button><button className={'nav-link '+(screen==='settings'?'selected':'')} onClick={()=>{setScreen('settings');setMobileMenu(false);setError('');refreshCoreStatus()}}><Settings size={17}/> Settings</button><div className="sidebar-bottom"><div className="core-card"><span className="core-dot"/><div><b>4N Core</b><small>AI billing & orchestration</small></div><span className="live-label">{coreConnected?'CONNECTED':'SETUP'}</span></div><button className="nav-link signout" onClick={signOut}><LogOut size={17}/> Sign out</button><p className="sidebar-foot">BUILD WITH CLARITY. SHIP WITH CONFIDENCE.</p></div></aside><main className="main-area"><header className="topbar"><button className="menu-button" onClick={()=>setMobileMenu(true)}><span>☰</span></button><div className="breadcrumbs"><span>Workspace</span><span>/</span><b>{screen==='build'?'Create app':screen==='projects'?'My projects':screen==='settings'?'Settings':project?.name||'Code'}</b></div><div className="top-actions"><span className="avatar">{user.email[0]?.toUpperCase()}</span><span className="user-email">{user.email}</span></div></header>
  {screen==='build'&&<section className="builder-page"><div className="hero"><div className="hero-pill"><span/> THE AI-POWERED APP WORKSPACE</div><h1>What will you<br className="mobile-break"/> <em>build today?</em></h1><p>Start with an idea. 4N DEV turns your description into a real project.</p></div><div className="composer"><div className="composer-top"><div><span className="composer-kicker">NEW PROJECT</span><h2>Describe your app</h2></div><span className="step-number">01 <span>/ 03</span></span></div><div className="mode-picker"><button className={mode==='web'?'mode-option active':'mode-option'} onClick={()=>setMode('web')}><Monitor size={19}/><span><b>Web app</b><small>React · TypeScript</small></span>{mode==='web'&&<CheckCircle2 size={16}/>}</button><button className={mode==='mobile'?'mode-option active':'mode-option'} onClick={()=>setMode('mobile')}><Smartphone size={19}/><span><b>Mobile app</b><small>Expo · Android & iOS</small></span>{mode==='mobile'&&<CheckCircle2 size={16}/>}</button></div><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder={mode==='web'?'A booking platform with a calendar, customer accounts, and an admin dashboard…':'A mobile habit tracker with daily goals, reminders, and progress charts…'} rows={5} maxLength={12000}/><div className="composer-bottom"><span>{prompt.length.toLocaleString()} / 12,000 characters</span><button className="primary" onClick={()=>generate()} disabled={busy||!prompt.trim()}>{busy?<><LoaderCircle size={17} className="spin"/> Building…</>:<><Sparkles size={17}/> Generate app <ArrowRight size={16}/></>}</button></div>{error&&<div className="error-banner">{error}</div>}{notice&&<div className="notice-banner"><CheckCircle2 size={16}/>{notice}</div>}<p className="privacy-line"><CheckCircle2 size={14}/> Your app is generated in an isolated build environment.</p></div><div className="starter-section"><div className="section-heading"><div><span className="composer-kicker">GET A HEAD START</span><h2>Start from an idea</h2></div><span className="starter-caption">Choose a template prompt</span></div><div className="starter-grid">{starters.map(item=><button key={item.title} className="starter-card" onClick={()=>{setMode(item.mode);setPrompt(item.prompt)}}><span className="starter-icon">{item.mode==='mobile'?<Smartphone size={19}/>:<Code2 size={19}/>}</span><b>{item.title}</b><small>{item.detail}</small><span className="starter-arrow"><ArrowRight size={16}/></span></button>)}</div></div></section>}
  {screen==='projects'&&<section className="content-page"><div className="page-title-row"><div><span className="composer-kicker">YOUR WORKSPACE</span><h1>My projects</h1><p>Pick up where you left off.</p></div><button className="primary" onClick={()=>{setProject(null);setFiles([]);setPrompt('');setScreen('build')}}><Plus size={17}/> New project</button></div><input className="search-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search projects…"/>{error&&<p className="error">{error}</p>}<div className="project-grid">{filtered.map(p=><button className="project-card" key={p.id} onClick={()=>openProject(p)}><span className="project-symbol"><FolderOpen size={20}/></span><b>{p.name}</b><small>{p.description||'AI-generated project'}</small><span className="project-meta">{p.status||'Saved project'} <ArrowRight size={15}/></span></button>)}</div>{!filtered.length&&<div className="empty-state"><FolderOpen size={28}/><b>No projects yet</b><p>Your generated apps will appear here.</p><button className="secondary" onClick={()=>setScreen('build')}>Create your first app</button></div>}</section>}
  {screen==='settings'&&<section className="content-page settings-page">
    <div className="page-title-row"><div><span className="composer-kicker">ACCOUNT CONNECTION</span><h1>4N Core settings</h1><p>Connect your own Core key. AI usage and credit deductions remain managed by 4N Core.</p></div></div>
    <div className="settings-card">
      <div className="settings-card-heading"><span className="starter-icon"><Sparkles size={19}/></span><div><h2>4N DEV Core</h2><p>Encrypted key storage · Core-owned balance</p></div><span className={coreConnected?'connection-state connected':'connection-state'}>{coreConnected?'CONNECTED':'NOT CONNECTED'}</span></div>
      {coreConnected ? <><div className="balance-panel"><b>Core balance response</b><code>{coreBalance || 'Loading Core balance…'}</code><p>Balance comes from Core; Builder does not keep a separate AI credit ledger.</p></div><button className="secondary" disabled={coreBusy} onClick={refreshCoreStatus}><LoaderCircle size={15} className={coreBusy?'spin':''}/> Refresh balance</button><button className="danger-button" disabled={coreBusy} onClick={disconnectCore}>Disconnect Core key</button></> :
      <form className="core-connect-form" onSubmit={e=>{e.preventDefault();connectCore()}}><label htmlFor="core-api-key">Core secret key</label><input id="core-api-key" type="password" autoComplete="off" value={coreKey} onChange={e=>setCoreKey(e.target.value)} placeholder="Paste your Core secret key" required/><p>Your key is validated with Core and encrypted before it is saved.</p><button className="primary" disabled={coreBusy}>{coreBusy?<LoaderCircle size={16} className="spin"/>:<CheckCircle2 size={16}/>} Connect 4N Core <ArrowRight size={16}/></button></form>}
      {error&&<div className="error-banner">{error}</div>}{notice&&<div className="notice-banner"><CheckCircle2 size={16}/>{notice}</div>}
    </div><p className="privacy-line"><CheckCircle2 size={14}/> Model selection stays developer-controlled. Core determines whether the account has enough credits.</p>
  </section>}
  {screen==='code'&&<section className="content-page code-page"><div className="page-title-row"><div><span className="composer-kicker">GENERATED PROJECT</span><h1>{project?.name||'Your app'}</h1><p>{files.length} files · saved to your workspace</p></div><button className="secondary" onClick={()=>setScreen('build')}><Plus size={16}/> New generation</button></div>{notice&&<div className="notice-banner"><CheckCircle2 size={16}/>{notice}</div>}{error&&<div className="error-banner">{error}</div>}<div className="code-layout"><aside className="file-list"><div className="file-list-heading"><FolderOpen size={15}/> PROJECT FILES</div>{files.map(f=><button key={f.path} className={currentFile?.path===f.path?'file-row active':'file-row'} onClick={()=>setActiveFile(f.path)}><Code2 size={14}/><span>{f.path}</span></button>)}</aside><div className="code-view"><div className="code-toolbar"><span><Terminal size={15}/>{currentFile?.path||'Select a file'}</span><span>{currentFile?.content.length.toLocaleString()||0} chars</span></div><pre><code>{currentFile?.content||'No files returned.'}</code></pre></div></div></section>}</main></div>;
}
