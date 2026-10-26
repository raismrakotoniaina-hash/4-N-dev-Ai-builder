const COOKIE = 'builder_session';
const MAX_PROMPT = 4000;
const MAX_FILES = 8;

function cookieValue(header = '') {
  for (const item of header.split(';')) {
    const [key, ...rest] = item.trim().split('=');
    if (key === COOKIE) return rest.join('=');
  }
  return null;
}

function send(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(payload));
}

export function chooseTemplate(prompt) {
  const value = prompt.toLowerCase();
  if (/portfolio|cv|resume|personnel|personal website/.test(value)) return 'portfolio';
  if (/dashboard|admin|statistique|analytics|gestion/.test(value)) return 'dashboard';
  if (/restaurant|boutique|business|entreprise|commerce|service/.test(value)) return 'business';
  return 'landing';
}

export function makeFiles({ projectName, prompt, template }) {
  const safeName = projectName.trim().slice(0, 100) || 'Mon prototype';
  const description = prompt.trim().slice(0, 240);
  const title = JSON.stringify(safeName);
  const descriptionJson = JSON.stringify(description);
  const templateJson = JSON.stringify(template);
  const app = `import { useState } from 'react';

const projectName = ${title};
const description = ${descriptionJson};
const template = ${templateJson};

const sections = {
  landing: [
    { title: 'Tongasoa', text: 'Pejy fandraisana mazava sy sariaka ho an’ny tetikasanao.' },
    { title: 'Ny tolotra', text: 'Hazavao eto ireo tolotra na endri-javatra lehibe.' },
    { title: 'Mifandraisa aminay', text: 'Ampio eto ny fomba hifandraisan’ny mpitsidika aminao.' }
  ],
  portfolio: [
    { title: 'Mombamomba ahy', text: 'Ampidiro eto ny mombamomba anao sy ny fahaizanao.' },
    { title: 'Asa nataoko', text: 'Asehoy eto ireo tetikasa sy asa vita.' },
    { title: 'Fifandraisana', text: 'Ampidiro eto ny rohy sy ny antsipirian’ny fifandraisana.' }
  ],
  business: [
    { title: 'Ny orinasanay', text: 'Ampidiro eto ny fampahafantarana ny orinasanao.' },
    { title: 'Tolotra sy vokatra', text: 'Asehoy eto ireo vokatra na tolotra.' },
    { title: 'Fifandraisana', text: 'Ampidiro eto ny adiresy sy ny fomba hifandraisana.' }
  ],
  dashboard: [
    { title: 'Famintinana', text: 'Toerana hametrahana ireo tarehimarika lehibe.' },
    { title: 'Tatitra', text: 'Toerana hametrahana tabilao sy tatitra.' },
    { title: 'Fitantanana', text: 'Toerana hametrahana ireo asa fitantanana.' }
  ]
};

export default function App() {
  const [active, setActive] = useState(0);
  const items = sections[template] || sections.landing;
  return (
    <main className="page">
      <nav className="nav"><span className="brand">{projectName}</span><span className="badge">Prototype Free</span></nav>
      <section className="hero">
        <p className="eyebrow">4N DEV AI BUILDER · {template.toUpperCase()}</p>
        <h1>{projectName}</h1>
        <p className="lead">{description || 'Prototype voalohany azo ovaina sy hatsaraina.'}</p>
        <a className="button" href="#contenu">Hijery ny votoaty</a>
      </section>
      <section id="contenu" className="content">
        <h2>Fototra azo hatsaraina</h2>
        <div className="tabs">{items.map((item, index) => <button key={item.title} className={active === index ? 'tab active' : 'tab'} onClick={() => setActive(index)}>{item.title}</button>)}</div>
        <article className="card"><span className="number">0{active + 1}</span><h3>{items[active].title}</h3><p>{items[active].text}</p></article>
      </section>
      <footer>Prototype noforonina tamin’ny algorithm sy template — tsy nampiasa 4N DEV Core.</footer>
    </main>
  );
}
`;
  const css = `:root { font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #172033; background: #f5f7fb; font-synthesis: none; }
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; }
button, a { font: inherit; }
.page { min-height: 100vh; }
.nav { display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1.2rem clamp(1rem,5vw,4rem); background:#fff; border-bottom:1px solid #e6eaf2; }
.brand { font-weight:800; letter-spacing:-.03em; }
.badge { padding:.4rem .7rem; border-radius:999px; background:#e4f8ee; color:#12663b; font-size:.8rem; font-weight:700; }
.hero { padding:clamp(3rem,9vw,7rem) clamp(1rem,10vw,8rem); background:linear-gradient(135deg,#eaf2ff,#fff 65%,#e7fbf3); }
.eyebrow { color:#4263a4; font-size:.75rem; font-weight:800; letter-spacing:.14em; }
h1 { max-width:900px; margin:.7rem 0 1rem; font-size:clamp(2.4rem,7vw,5rem); line-height:1.04; letter-spacing:-.06em; overflow-wrap:anywhere; }
.lead { max-width:680px; color:#59657a; font-size:clamp(1rem,2vw,1.25rem); line-height:1.7; }
.button { display:inline-block; margin-top:1rem; padding:.85rem 1.15rem; border-radius:.8rem; color:white; background:#2458d3; text-decoration:none; font-weight:700; }
.content { max-width:1000px; margin:auto; padding:3rem 1rem 4rem; }
h2 { font-size:clamp(1.6rem,4vw,2.4rem); letter-spacing:-.04em; }
.tabs { display:flex; flex-wrap:wrap; gap:.6rem; margin:1.5rem 0; }
.tab { padding:.7rem 1rem; border:1px solid #dbe2ee; border-radius:.7rem; background:white; color:#26334b; cursor:pointer; }
.tab.active { color:white; background:#172f69; border-color:#172f69; }
.card { padding:clamp(1.3rem,4vw,2.5rem); border:1px solid #e2e7f0; border-radius:1.2rem; background:white; box-shadow:0 12px 40px #182c4a0a; }
.number { color:#6384c7; font-size:.8rem; font-weight:800; }
h3 { font-size:1.6rem; margin:.6rem 0; }
.card p { color:#657086; line-height:1.7; }
footer { padding:1.5rem; text-align:center; color:#6a7487; font-size:.85rem; border-top:1px solid #e2e7f0; }
@media (max-width:600px) { .nav { padding:1rem; } .tabs { display:grid; grid-template-columns:1fr; } .tab { text-align:left; } }
`;
  const packageJson = JSON.stringify({
    name: '4ndev-free-prototype',
    private: true,
    version: '1.0.0',
    type: 'module',
    scripts: { build: 'tsc -b && vite build' },
    dependencies: { react: '19.3.0', 'react-dom': '19.3.0' },
    devDependencies: { '@vitejs/plugin-react': '6.1.1', '@types/react': '19.3.0', '@types/react-dom': '19.3.0', '@types/node': '22.20.2', typescript: '5.7.3', vite: '8.3.5' }
  }, null, 2);
  const tsconfig = JSON.stringify({
    compilerOptions: {
      target: 'ES2022', useDefineForClassFields: true, lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      module: 'ESNext', skipLibCheck: true, moduleResolution: 'bundler', allowImportingTsExtensions: true,
      verbatimModuleSyntax: true, moduleDetection: 'force', noEmit: true, jsx: 'react-jsx', strict: true
    },
    include: ['src']
  }, null, 2);
  return [
    { path: 'package.json', content: packageJson },
    { path: 'index.html', content: '<!doctype html><html lang="mg"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><meta name="description" content="4N DEV Free prototype"/><title>4N DEV Free Prototype</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>' },
    { path: 'tsconfig.json', content: tsconfig },
    { path: 'vite.config.ts', content: "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()] });\n" },
    { path: 'src/main.tsx', content: "import { StrictMode } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App';\nimport './index.css';\n\ncreateRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);\n" },
    { path: 'src/App.tsx', content: app },
    { path: 'src/index.css', content: css }
  ].slice(0, MAX_FILES);
}

export function createFreePrototypeApi({ store, buildValidator = async () => ({ success: true }) }) {
  return async function freePrototypeApi(req, res, url) {
    const match = url.pathname.match(/^\\/api\\/projects\\/([0-9a-f-]{36})\\/prototype$/i);
    if (!match || req.method !== 'POST') return false;
    const user = await store.getUserForSession(cookieValue(req.headers.cookie));
    if (!user) return send(res, 401, { success: false, error: 'Authentication required.' });
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 8000) return send(res, 413, { success: false, error: 'Prototype request is too large.' });
        chunks.push(chunk);
      }
      let body;
      try { body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; }
      catch { return send(res, 400, { success: false, error: 'Request body must be valid JSON.' }); }
      const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
      if (!prompt || prompt.length > MAX_PROMPT) return send(res, 400, { success: false, error: 'Describe the prototype in 1–4,000 characters.' });
      const project = await store.getProject(user.id, match[1]);
      if (!project) return send(res, 404, { success: false, error: 'Project not found.' });
      const template = chooseTemplate(prompt);
      const files = makeFiles({ projectName: project.name, prompt, template });
      if (files.length > MAX_FILES) return send(res, 500, { success: false, error: 'Prototype template exceeds the file limit.' });
      await buildValidator(files);
      const savedFiles = await store.putFiles(user.id, match[1], files);
      if (!savedFiles) return send(res, 404, { success: false, error: 'Project not found while saving prototype.' });
      return send(res, 200, {
        success: true,
        mode: 'free-template',
        coreCalls: 0,
        project: await store.getProject(user.id, match[1]),
        generatedFiles: savedFiles,
        template
      });
    } catch (error) {
      return send(res, error.statusCode || 422, { success: false, error: error.statusCode ? error.message : 'Free prototype generation failed.' });
    }
  };
}
