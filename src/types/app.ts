export type AppView = 'dashboard' | 'builder' | 'code' | 'preview' | 'files' | 'projects' | 'deployments' | 'settings';

import type { LucideIcon } from 'lucide-react';

export interface NavigationItem {
  id: AppView;
  label: string;
  description: string;
  icon: LucideIcon;
}

export interface Project { id: string; name: string; description?: string; status?: string; created_at?: string; updated_at?: string; }
export interface ProjectFile { id?: string; project_id: string; path: string; content: string; language?: string; }
export interface Deployment { id: string; project_id: string; status: string; url?: string; created_at?: string; }
export interface BuilderPlan { project?: Record<string, unknown>; files?: Array<{ path: string; content?: string; language?: string }>; }
export interface BuilderResult { success?: boolean; project?: Project; files?: ProjectFile[]; plan?: BuilderPlan; review?: Record<string, unknown>; build?: Record<string, unknown>; deployment?: Deployment; [key: string]: unknown; }
