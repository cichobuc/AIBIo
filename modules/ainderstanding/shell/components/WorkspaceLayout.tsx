'use client';

import { useEffect } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/core/ui';
import { useWorkspaceStore } from '../store/workspace-store';
import { useSSEStream } from '../hooks/useSSEStream';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { ActivityBar } from './ActivityBar';
import { TopBar } from './TopBar';
import { PrimarySidebar } from './PrimarySidebar';
import { GlobalChatPanel } from './GlobalChatPanel';
import { ApprovalDialog } from './ApprovalDialog';
import { BottomPanel } from './BottomPanel';
import { StatusBar } from './StatusBar';
import { CommandPalette } from './CommandPalette';

export function WorkspaceLayout({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: React.ReactNode;
}) {
  const init = useWorkspaceStore((s) => s.init);
  const sidebarOpen = useWorkspaceStore((s) => s.sidebarOpen);
  const chatPanelOpen = useWorkspaceStore((s) => s.chatPanelOpen);

  // Initialize workspace on mount
  useEffect(() => {
    init(workspaceId);
  }, [workspaceId, init]);

  // SSE stream connection
  useSSEStream(workspaceId);

  // Global keyboard shortcuts
  useKeyboardShortcuts(workspaceId);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TopBar workspaceId={workspaceId} />

      <div className="flex flex-1 overflow-hidden">
        <ActivityBar workspaceId={workspaceId} />

        <ResizablePanelGroup orientation="horizontal" className="flex-1">
          {sidebarOpen && (
            <>
              <ResizablePanel
                defaultSize={19}
                minSize={14}
                maxSize={37}
                collapsible
                onResize={(size) => { if (size.asPercentage === 0) useWorkspaceStore.getState().setSidebarOpen(false); }}
              >
                <PrimarySidebar />
              </ResizablePanel>
              <ResizableHandle />
            </>
          )}

          <ResizablePanel minSize={30}>
            <div className="flex h-full flex-col overflow-hidden">
              <div className="flex-1 overflow-auto">{children}</div>
              <BottomPanel />
            </div>
          </ResizablePanel>

          {chatPanelOpen && (
            <>
              <ResizableHandle />
              <ResizablePanel
                defaultSize={26}
                minSize={20}
                maxSize={43}
                collapsible
                onResize={(size) => { if (size.asPercentage === 0) useWorkspaceStore.getState().setChatPanelOpen(false); }}
              >
                <GlobalChatPanel workspaceId={workspaceId} />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      <StatusBar workspaceId={workspaceId} />

      {/* Global overlays */}
      <ApprovalDialog />
      <CommandPalette workspaceId={workspaceId} />
    </div>
  );
}
