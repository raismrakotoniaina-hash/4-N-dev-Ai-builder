import { Construction } from 'lucide-react';
import type { NavigationItem } from '../../types/app';
import { Badge } from './Badge';
import { Card } from './Card';

interface PagePlaceholderProps {
  page: NavigationItem;
}

export function PagePlaceholder({ page }: PagePlaceholderProps) {
  const Icon = page.icon;

  return (
    <div className="page-placeholder">
      <Card className="page-placeholder__card" variant="glass">
        <div className="page-placeholder__icon">
          <Icon size={30} strokeWidth={1.7} />
        </div>

        <Badge variant="cyan">
          <Construction size={13} />
          WORKSPACE
        </Badge>

        <h1>{page.label}</h1>
        <p>{page.description}</p>

        <div className="page-placeholder__grid" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </Card>
    </div>
  );
        }
