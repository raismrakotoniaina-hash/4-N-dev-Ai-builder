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
  shortLabel: string;
  description: string;
}
