'use client';
import { cn } from '@/core/ui';
import type { SettingsSection } from '../../store/workspace-store';

interface SidebarItem {
  key: SettingsSection;
  label: string;
}

const ITEMS: SidebarItem[] = [
  { key: 'ai-behavior', label: 'AI Behavior' },
  { key: 'approval-gates', label: 'Approval Gates' },
  { key: 'data-profiling', label: 'Data & Profiling' },
  { key: 'models-sql', label: 'Models & SQL' },
  { key: 'documentation', label: 'Documentation' },
  { key: 'testing', label: 'Testing' },
  { key: 'connections', label: 'Connections' },
  { key: 'ui-ux', label: 'UI / UX' },
];

interface Props {
  active: SettingsSection;
  onSelect: (section: SettingsSection) => void;
}

export function SettingsSidebar({ active, onSelect }: Props) {
  return (
    <nav className="w-[180px] shrink-0 border-r border-border py-2">
      {ITEMS.map((item) => (
        <button
          key={item.key}
          onClick={() => onSelect(item.key)}
          className={cn(
            'relative w-full px-4 py-2 text-left text-sm transition-colors hover:text-foreground',
            active === item.key
              ? 'text-foreground bg-secondary before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-primary before:rounded-r'
              : 'text-muted-foreground',
          )}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
