import {
  Code2,
  Eye,
  FolderTree,
  LayoutDashboard,
  Rocket,
  Sparkles,
} from 'lucide-react';
import type { NavigationItem } from '../types/app';

export const navigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Overview an’ny workspace',
    icon: LayoutDashboard,
  },
  {
    id: 'builder',
    label: 'AI Builder',
    description: 'Mamorona app amin’ny prompt',
    icon: Sparkles,
  },
  {
    id: 'code',
    label: 'Code',
    description: 'Jereo sy ovay ny code',
    icon: Code2,
  },
  {
    id: 'preview',
    label: 'Preview',
    description: 'Live preview an’ilay app',
    icon: Eye,
  },
  {
    id: 'files',
    label: 'Files',
    description: 'Project file explorer',
    icon: FolderTree,
  },
  {
    id: 'projects',
    label: 'My Projects',
    description: 'Projects voatahiry',
    icon: Rocket,
  },
];
