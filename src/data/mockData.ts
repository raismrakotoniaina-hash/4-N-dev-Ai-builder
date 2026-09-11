import type {
  AIGenerationState,
  Project,
  ProjectFile,
} from "../types";

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  prompt: string;
  framework: string;
  icon: string;
  tags: string[];
}

export const landingPageFiles: ProjectFile[] = [
  {
    id: "file-1",
    name: "App.tsx",
    path: "src/App.tsx",
    type: "tsx",
    language: "typescript",
    content: `import "./index.css";

export default function App() {
  return <main><h1>Build with 4N Dev</h1></main>;
}`,
    createdAt: "2026-09-10T08:00:00.000Z",
    updatedAt: "2026-09-10T08:00:00.000Z",
  },
  {
    id: "file-2",
    name: "index.css",
    path: "src/index.css",
    type: "css",
    language: "css",
    content: `body{margin:0;background:#080b14;color:#fff;font-family:Arial,sans-serif}`,
    createdAt: "2026-09-10T08:00:00.000Z",
    updatedAt: "2026-09-10T08:00:00.000Z",
  },
  {
    id: "file-3",
    name: "main.tsx",
    path: "src/main.tsx",
    type: "tsx",
    language: "typescript",
    content: `import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);`,
    createdAt: "2026-09-10T08:00:00.000Z",
    updatedAt: "2026-09-10T08:00:00.000Z",
  },
];

export const mockProjects: Project[] = [
  {
    id: "project-1",
    name: "4N Dev Landing",
    description: "Premium futuristic landing page.",
    prompt: "Create a premium landing page for 4N Dev.",
    status: "ready",
    framework: "React + TypeScript + Vite",
    tags: ["Landing Page", "React", "Premium"],
    files: landingPageFiles,
    createdAt: "2026-09-10T08:00:00.000Z",
    updatedAt: "2026-09-10T08:00:00.000Z",
  },
  {
    id: "project-2",
    name: "N-AI Dashboard",
    description: "AI project analytics dashboard.",
    prompt: "Create a dark AI analytics dashboard.",
    status: "draft",
    framework: "React + TypeScript + Vite",
    tags: ["Dashboard", "AI"],
    files: [],
    createdAt: "2026-09-10T09:00:00.000Z",
    updatedAt: "2026-09-10T09:00:00.000Z",
  },
];

export const projectTemplates: ProjectTemplate[] = [
  {
    id: "template-1",
    name: "Landing Page",
    description: "Site vitrine modern sy responsive.",
    prompt: "Create a premium responsive landing page with hero and CTA.",
    framework: "React + TypeScript + Vite",
    icon: "✨",
    tags: ["Website", "Responsive"],
  },
  {
    id: "template-2",
    name: "AI Dashboard",
    description: "Dashboard futuriste ho an'ny analytics.",
    prompt: "Create a dark futuristic AI analytics dashboard.",
    framework: "React + TypeScript + Vite",
    icon: "📊",
    tags: ["Dashboard", "Analytics"],
  },
  {
    id: "template-3",
    name: "Portfolio",
    description: "Portfolio premium ho an'ny developer.",
    prompt: "Create a modern developer portfolio with project cards.",
    framework: "React + TypeScript + Vite",
    icon: "🚀",
    tags: ["Portfolio", "Creative"],
  },
];

export const initialAIGenerationState: AIGenerationState = {
  status: "idle",
  prompt: "",
  progress: 0,
  generatedFiles: [],
};
