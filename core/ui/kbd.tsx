import { cn } from './utils';

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-caption text-muted-foreground',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
