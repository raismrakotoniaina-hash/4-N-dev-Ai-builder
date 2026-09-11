import { useState, type ReactNode } from "react";

type NavigationItem = {
  id: string;
  label: string;
  icon: ReactNode;
};

const Icon = ({ children }: { children: ReactNode }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

const navigationItems: NavigationItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: (
      <Icon>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </Icon>
    ),
  },
  {
    id: "ai-builder",
    label: "AI Builder",
    icon: (
      <Icon>
        <path d="M12 2 13.6 7.4 19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6L12 2Z" />
        <path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
      </Icon>
    ),
  },
  {
    id: "code",
    label: "Code",
    icon: (
      <Icon>
        <path d="m8 9-4 3 4 3" />
        <path d="m16 9 4 3-4 3" />
        <path d="m14 5-4 14" />
      </Icon>
    ),
  },
  {
    id: "preview",
    label: "Preview",
    icon: (
      <Icon>
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
        <circle cx="12" cy="12" r="2.5" />
      </Icon>
    ),
  },
  {
    id: "files",
    label: "Files",
    icon: (
      <Icon>
        <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
      </Icon>
    ),
  },
  {
    id: "projects",
    label: "My Projects",
    icon: (
      <Icon>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M3 9h18" />
        <path d="M8 4v5" />
      </Icon>
    ),
  },
];

const projectTemplates = [
  {
    icon: "◇",
    title: "Web Application",
    description: "Build a responsive and production-ready web application.",
    color: "blue",
  },
  {
    icon: "◈",
    title: "Landing Page",
    description: "Create a premium landing page designed to convert.",
    color: "violet",
  },
  {
    icon: "⌁",
    title: "Dashboard",
    description: "Generate a modern dashboard with intelligent components.",
    color: "cyan",
  },
];

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [prompt, setPrompt] = useState("");

  const currentPage =
    navigationItems.find((item) => item.id === activePage)?.label ?? "Dashboard";

  const selectPage = (id: string) => {
    setActivePage(id);
    setSidebarOpen(false);
  };

  const startBuilding = () => {
    if (!prompt.trim()) return;
    setActivePage("ai-builder");
  };

  return (
    <div className="app-shell">
      <div className="ambient-glow ambient-glow-one" />
      <div className="ambient-glow ambient-glow-two" />

      {sidebarOpen && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            4N
          </div>

          <div className="brand-copy">
            <strong>4N Dev</strong>
            <span>AI Builder</span>
          </div>

          <button
            className="sidebar-close"
            type="button"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
          >
            ×
          </button>
        </div>

        <nav className="main-navigation" aria-label="Main navigation">
          <span className="navigation-label">Workspace</span>

          {navigationItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`navigation-item ${
                activePage === item.id ? "active" : ""
              }`}
              onClick={() => selectPage(item.id)}
            >
              <span className="navigation-icon">{item.icon}</span>
              <span>{item.label}</span>
              {activePage === item.id && (
                <span className="active-indicator" />
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-upgrade">
          <span className="upgrade-icon">✦</span>
          <strong>Unlock your potential</strong>
          <p>Build faster with intelligent AI-powered tools.</p>
          <button type="button">Explore Pro</button>
        </div>

        <div className="sidebar-user">
          <div className="user-avatar">VD</div>
          <div>
            <strong>4N Developer</strong>
            <span>Free workspace</span>
          </div>
          <button type="button" aria-label="User menu">
            •••
          </button>
        </div>
      </aside>

      <div className="application-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="menu-button"
              type="button"
              aria-label="Open navigation"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(true)}
            >
              <span />
              <span />
              <span />
            </button>

            <div>
              <span className="topbar-eyebrow">4N Dev Workspace</span>
              <h1>{currentPage}</h1>
            </div>
          </div>

          <div className="topbar-actions">
            <button
              className="icon-button"
              type="button"
              aria-label="Notifications"
            >
              <Icon>
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                <path d="M10 21h4" />
              </Icon>
              <span className="notification-dot" />
            </button>

            <button
              className="new-project-button"
              type="button"
              onClick={() => setActivePage("ai-builder")}
            >
              <span>＋</span>
              <span>New Project</span>
            </button>
          </div>
        </header>

        <main className="main-content">
          <section className="hero-section">
            <div className="hero-badge">
              <span>✦</span>
              AI-powered development workspace
            </div>

            <h2>
              Turn your ideas into
              <span> powerful applications.</span>
            </h2>

            <p>
              Describe what you want to build. 4N Dev AI Builder transforms
              your vision into a modern application structure and clean code.
            </p>

            <div className="prompt-panel">
              <div className="prompt-header">
                <span className="ai-orb">✦</span>
                <div>
                  <strong>What do you want to build?</strong>
                  <span>Describe your project in natural language</span>
                </div>
              </div>

              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Example: Create a modern project management dashboard with analytics, tasks and a responsive dark interface..."
                rows={5}
              />

              <div className="prompt-footer">
                <div className="prompt-tools">
                  <button type="button" aria-label="Attach a file">
                    <Icon>
                      <path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />
                    </Icon>
                  </button>
                  <span>{prompt.length} characters</span>
                </div>

                <button
                  className="build-button"
                  type="button"
                  disabled={!prompt.trim()}
                  onClick={startBuilding}
                >
                  Generate Project
                  <span>→</span>
                </button>
              </div>
            </div>
          </section>

          <section className="templates-section">
            <div className="section-heading">
              <div>
                <span>Quick start</span>
                <h3>Start with a template</h3>
              </div>

              <button type="button">
                View all templates <span>→</span>
              </button>
            </div>

            <div className="template-grid">
              {projectTemplates.map((template) => (
                <article
                  className="template-card"
                  key={template.title}
                  onClick={() => {
                    setPrompt(`Create a modern ${template.title.toLowerCase()}`);
                    setActivePage("ai-builder");
                  }}
                >
                  <div className={`template-icon ${template.color}`}>
                    {template.icon}
                  </div>
                  <div>
                    <h4>{template.title}</h4>
                    <p>{template.description}</p>
                  </div>
                  <button type="button" aria-label={`Use ${template.title}`}>
                    →
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="workspace-overview">
            <div className="section-heading">
              <div>
                <span>Workspace overview</span>
                <h3>Your recent projects</h3>
              </div>
            </div>

            <div className="empty-projects">
              <div className="empty-project-icon">
                <Icon>
                  <path d="M12 3v18" />
                  <path d="M3 12h18" />
                </Icon>
              </div>
              <h4>Create your first project</h4>
              <p>
                Your generated applications and recent projects will appear
                here.
              </p>
              <button
                type="button"
                onClick={() => setActivePage("ai-builder")}
              >
                Start building
              </button>
            </div>
          </section>
        </main>

        <nav className="mobile-navigation" aria-label="Mobile navigation">
          {navigationItems.slice(0, 5).map((item) => (
            <button
              key={item.id}
              type="button"
              className={activePage === item.id ? "active" : ""}
              onClick={() => selectPage(item.id)}
            >
              <span>{item.icon}</span>
              <small>{item.label}</small>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

export default App;
