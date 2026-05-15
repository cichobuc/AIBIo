'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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

// react-resizable-panels v4 treats defaultSize as pixel units.
// We measure the container before mount and convert percentages to pixels.
function pct(containerPx: number, percentage: number) {
  return Math.round(containerPx * (percentage / 100));
}

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
  const bottomPanelOpen = useWorkspaceStore((s) => s.bottomPanelOpen);

  // Defer panel group render to after first layout so the container has real
  // pixel dimensions and defaultSize calculations are correct.
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [hPx, setHPx] = useState({ sidebar: 200, chat: 280 });
  const [vPx, setVPx] = useState({ bottom: 150 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (el) {
      setHPx({
        sidebar: pct(el.clientWidth, 19),
        chat: pct(el.clientWidth, 26),
      });
      setVPx({ bottom: pct(el.clientHeight, 22) });
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    init(workspaceId);
  }, [workspaceId, init]);

  useSSEStream(workspaceId);
  useKeyboardShortcuts(workspaceId);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TopBar workspaceId={workspaceId} />

      <div className="flex flex-1 overflow-hidden">
        <ActivityBar workspaceId={workspaceId} />

        <div ref={containerRef} className="relative min-w-0 flex-1 overflow-hidden">
          {mounted && (
            <ResizablePanelGroup direction="horizontal" className="absolute inset-0">
              {sidebarOpen && (
                <>
                  <ResizablePanel
                    id="sidebar"
                    defaultSize={hPx.sidebar}
                    minSize={pct(hPx.sidebar + hPx.chat + 400, 14)}
                    collapsible
                    onResize={(size) => { if (size.asPercentage === 0) useWorkspaceStore.getState().setSidebarOpen(false); }}
                  >
                    <PrimarySidebar />
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                </>
              )}

              <ResizablePanel id="main">
                <ResizablePanelGroup direction="vertical">
                  <ResizablePanel id="content">
                    <div className="h-full overflow-auto">{children}</div>
                  </ResizablePanel>

                  {bottomPanelOpen && (
                    <>
                      <ResizableHandle withHandle />
                      <ResizablePanel
                        id="bottom"
                        defaultSize={vPx.bottom}
                        collapsible
                        onResize={(size) => { if (size.asPercentage === 0) useWorkspaceStore.getState().setBottomPanelOpen(false); }}
                      >
                        <BottomPanel />
                      </ResizablePanel>
                    </>
                  )}
                </ResizablePanelGroup>
              </ResizablePanel>

              {chatPanelOpen && (
                <>
                  <ResizableHandle withHandle />
                  <ResizablePanel
                    id="chat"
                    defaultSize={hPx.chat}
                    collapsible
                    onResize={(size) => { if (size.asPercentage === 0) useWorkspaceStore.getState().setChatPanelOpen(false); }}
                  >
                    <GlobalChatPanel workspaceId={workspaceId} />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          )}
        </div>
      </div>

      <StatusBar workspaceId={workspaceId} />

      <ApprovalDialog />
      <CommandPalette workspaceId={workspaceId} />
    </div>
  );
}
