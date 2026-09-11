import type { LucideIcon } from 'lucide-react';

export type AppView =
  | 'dashboard'
  | 'builder'
  | 'code'
  | 'preview'
  | 'files'
  | 'projects';

export interface NavigationItem {
  id: AppView;
  label: string;
  description: string;
  icon: LucideIcon;
}
