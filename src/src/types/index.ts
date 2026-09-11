import type { ReactNode } from "react";

/**
 * Karazana fichier azo ampiasaina ao amin'ny project.
 * `other` dia mamela format vaovao ampiana any aoriana.
 */
export type ProjectFileType =
  | "typescript"
  | "javascript"
  | "tsx"
  | "jsx"
  | "html"
  | "css"
  | "json"
  | "markdown"
  | "image"
  | "other";

/**
 * Fichier iray ao anatin'ny project.
 */
export interface ProjectFile {
  id: string;
  name: string;
  path: string;
  content: string;
  type: ProjectFileType;
  language?: string;
  size?: number;
  isDirectory?: boolean;
  isReadOnly?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Satan'ny project.
 */
export type ProjectStatus =
  | "draft"
  | "generating"
  | "ready"
  | "error"
  | "archived";

/**
 * Project iray noforonina na tantanan'ny AI Builder.
 */
export interface Project {
  id: string;
  name: string;
  description?: string;
  prompt?: string;
  status: ProjectStatus;
  files: ProjectFile[];
  thumbnail?: string;
  framework?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Navigation item ampiasaina amin'ny sidebar,
 * topbar na mobile bottom navigation.
 */
export interface NavigationItem {
  id: string;
  label: string;
  path?: string;
  icon?: ReactNode;
  badge?: string | number;
  disabled?: boolean;
  hidden?: boolean;
  children?: NavigationItem[];
}

/**
 * Dingana arahina mandritra ny AI generation.
 */
export type AIGenerationStep =
  | "idle"
  | "analyzing"
  | "planning"
  | "generating"
  | "validating"
  | "completed"
  | "error"
  | "cancelled";

/**
 * Karazana erreur azo avy amin'ny AI generation.
 */
export interface AIGenerationError {
  code?: string;
  message: string;
  details?: string;
  retryable?: boolean;
}

/**
 * State fototra hitantanana ny génération AI.
 */
export interface AIGenerationState {
  status: AIGenerationStep;
  prompt: string;
  progress: number;
  message?: string;
  currentFile?: string;
  generatedFiles: ProjectFile[];
  projectId?: string;
  startedAt?: string;
  completedAt?: string;
  error?: AIGenerationError;
}

/**
 * Input ilaina hanombohana génération vaovao.
 */
export interface AIGenerationRequest {
  prompt: string;
  projectId?: string;
  projectName?: string;
  framework?: string;
  existingFiles?: ProjectFile[];
}

/**
 * Valin'ny génération rehefa vita.
 */
export interface AIGenerationResult {
  project: Project;
  generatedFiles: ProjectFile[];
  summary?: string;
}

/**
 * State initial azo ampiasaina mivantana amin'ny React state.
 */
export const initialAIGenerationState: AIGenerationState = {
  status: "idle",
  prompt: "",
  progress: 0,
  generatedFiles: [],
};
