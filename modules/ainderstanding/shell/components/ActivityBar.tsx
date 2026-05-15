'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Database,
  Compass,
  Shield,
  Layers,
  FileText,
  CheckSquare,
  Download,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, cn } from '@/core/ui';

const MODULES = [
  { key: 'connect', icon: Database, label: 'Connect', tip: 'Manage data sources' },
  { key: 'explore', icon: Compass, label: 'Explore', tip: 'Schema & profiling' },
  { key: 'govern', icon: Shield, label: 'Govern', tip: 'GDPR & permissions' },
  { key: 'model', icon: Layers, label: 'Model', tip: 'Dimensional model' },
  { key: 'document', icon: FileText, label: 'Document', tip: 'Governance docs' },
  { key: 'test', icon: CheckSquare, label: 'Test', tip: 'Data quality' },
  { key: 'export', icon: Download, label: 'Export', tip: 'Export to dbt' },
] as const;

function ActivityItem({
  href,
  icon: Icon,
  label,
  tip,
  active,
}: {
  href?: string;
  icon: React.ElementType;
  label: string;
  tip: string;
  active?: boolean;
}) {
  const className = cn(
    'relative flex h-[48px] w-[48px] items-center justify-center text-muted-foreground transition-colors hover:text-foreground hover:bg-card',
    active && 'text-foreground bg-card before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:bg-primary before:rounded-r',
  );

  const content = (
    <Tooltip delayDuration={400}>
      <TooltipTrigger asChild>
        {href ? (
          <Link href={href} className={className} aria-label={label}>
            <Icon className="h-[18px] w-[18px]" />
          </Link>
        ) : (
          <button className={className} aria-label={label}>
            <Icon className="h-[18px] w-[18px]" />
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent side="right" className="text-caption">
        {tip}
      </TooltipContent>
    </Tooltip>
  );

  return content;
}

export function ActivityBar({ workspaceId }: { workspaceId: string }) {
  const pathname = usePathname();

  return (
    <TooltipProvider>
      <nav
        className="flex w-[48px] shrink-0 flex-col border-r border-border bg-card"
        aria-label="Module navigation"
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex h-[48px] w-[48px] items-center justify-center border-b border-border text-accent-ai hover:bg-secondary transition-colors"
          aria-label="AIBIo home"
        >
          <span className="text-section font-bold">◈</span>
        </Link>

        {/* Module icons */}
        <div className="flex flex-1 flex-col">
          {MODULES.map((mod) => (
            <ActivityItem
              key={mod.key}
              href={`/workspace/${workspaceId}/${mod.key}`}
              icon={mod.icon}
              label={mod.label}
              tip={mod.tip}
              active={pathname.includes(`/${mod.key}`)}
            />
          ))}
        </div>

        {/* Bottom actions */}
        <div className="border-t border-border">
          <ActivityItem icon={Settings} label="Settings" tip="Settings (⌘,)" />
          <ActivityItem icon={HelpCircle} label="Help" tip="Help & docs" />
        </div>
      </nav>
    </TooltipProvider>
  );
}
