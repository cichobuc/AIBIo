'use client';

import { usePathname } from 'next/navigation';

export function PrimarySidebar({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const module = segments[segments.length - 1];

  return (
    <div className="flex h-full flex-col overflow-hidden bg-card border-r border-border">
      {children ?? (
        <div className="flex flex-1 items-center justify-center text-caption text-muted-foreground">
          {module}
        </div>
      )}
    </div>
  );
}
