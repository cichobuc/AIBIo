'use client';

import { GripVertical } from 'lucide-react';
import * as ResizablePrimitive from 'react-resizable-panels';
import { cn } from './utils';

// react-resizable-panels v4 renamed the prop from `direction` to `orientation`.
// We keep our external API as `direction` for consistent callers, and map it to
// `orientation` when forwarding to the library.
type PanelGroupProps = Omit<React.ComponentProps<typeof ResizablePrimitive.Group>, 'orientation'> & {
  direction?: 'horizontal' | 'vertical';
};

const ResizablePanelGroup = ({ className, direction = 'horizontal', ...props }: PanelGroupProps) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Group = ResizablePrimitive.Group as React.ComponentType<any>;
  return (
    <Group
      orientation={direction}
      className={cn(
        'flex h-full w-full',
        direction === 'vertical' ? 'flex-col' : 'flex-row',
        className,
      )}
      {...props}
    />
  );
};

const ResizablePanel = ResizablePrimitive.Panel;

const ResizableHandle = ({
  withHandle,
  direction = 'horizontal',
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Separator> & {
  withHandle?: boolean;
  direction?: 'horizontal' | 'vertical';
}) => (
  <ResizablePrimitive.Separator
    className={cn(
      'relative flex items-center justify-center bg-border transition-colors hover:bg-ring/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
      direction === 'vertical' ? 'h-px w-full cursor-row-resize' : 'w-px cursor-col-resize',
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
