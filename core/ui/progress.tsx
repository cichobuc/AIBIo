import * as React from 'react';
import { cn } from './utils';

type Props = React.HTMLAttributes<HTMLDivElement> & { value?: number; max?: number };

const Progress = React.forwardRef<HTMLDivElement, Props>(({ className, value = 0, max = 100, ...props }, ref) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}
      {...props}
    >
      <div
        className="h-full bg-primary transition-all duration-1000"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
});
Progress.displayName = 'Progress';

export { Progress };
