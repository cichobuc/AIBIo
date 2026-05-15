'use client';

import { GripVertical } from 'lucide-react';
import * as ResizablePrimitive from 'react-resizable-panels';
import { cn } from './utils';

// react-resizable-panels v4 uses `direction` prop internally but the shipped type
// definitions don't declare it, causing TS to reject it. We expose it here so
// callers can write direction="horizontal"|"vertical" without type errors.
type PanelGroupProps = Omit<React.ComponentProps<typeof ResizablePrimitive.Group>, 'direction'> & {
  direction?: 'horizontal' | 'vertical';
};

const ResizablePanelGroup = ({ className, direction = 'horizontal', ...props }: PanelGroupProps) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Group = ResizablePrimitive.Group as React.ComponentType<any>;
  return (
    <Group
      direction={direction}
      className={cn('flex h-full w-full data-[panel-group-direction=vertical]:flex-col', className)}
      {...props}
    />
  );
};

const ResizablePanel = ResizablePrimitive.Panel;

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Separator> & { withHandle?: boolean }) => (
  <ResizablePrimitive.Separator
    className={cn(
      'relative flex w-px items-center justify-center bg-border transition-colors hover:bg-ring/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full',
      className,
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border border-border bg-accent">
        <GripVertical className="h-2.5 w-2.5 text-muted-foreground" />
      </div>
    )}
  </ResizablePrimitive.Separator>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
