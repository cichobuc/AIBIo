'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, HelpCircle } from 'lucide-react';
import { Button, Avatar, AvatarFallback, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/core/ui';
import { ModeSelector } from './ModeSelector';

const MODULE_LABELS: Record<string, string> = {
  connect: 'Connect',
  explore: 'Explore',
  govern: 'Govern',
  model: 'Model',
  document: 'Document',
  test: 'Test',
  translate: 'Translate',
  export: 'Export',
};

export function TopBar({ workspaceId }: { workspaceId: string }) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const moduleSegment = segments[segments.length - 1];
  const moduleLabel = moduleSegment ? MODULE_LABELS[moduleSegment] : undefined;

  return (
    <TooltipProvider>
      <header className="flex h-[48px] shrink-0 items-center justify-between border-b border-border bg-card px-3">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-body text-muted-foreground min-w-0">
          <span className="text-accent-ai font-bold shrink-0">◈</span>
          <span className="text-muted-foreground/50">/</span>
          <Link
            href={`/workspace/${workspaceId}/connect`}
            className="truncate hover:text-foreground transition-colors max-w-[160px]"
          >
            {workspaceId}
          </Link>
          {moduleLabel && (
            <>
              <span className="text-muted-foreground/50">/</span>
              <span className="text-foreground truncate">{moduleLabel}</span>
            </>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 shrink-0">
          <ModeSelector />

          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings (⌘,)</TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Help & docs</TooltipContent>
          </Tooltip>

          <Avatar className="h-7 w-7 cursor-pointer">
            <AvatarFallback className="text-caption">U</AvatarFallback>
          </Avatar>
        </div>
      </header>
    </TooltipProvider>
  );
}
