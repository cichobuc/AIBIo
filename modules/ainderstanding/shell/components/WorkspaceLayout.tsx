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
import { SettingsDialog } from './settings/SettingsDialog';

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

  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [hPx, setHPx] = useState({ sidebar: 280, chat: 320 });
  const [vPx, setVPx] = useState({ bottom: 200 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (el) {
      setHPx({
        sidebar: Math.round(el.clientWidth * 0.19),
        chat: Math.round(el.clientWidth * 0.26),
      });
      setVPx({ bottom: Math.round(el.clientHeight * 0.28) });
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
            // Outer vertical group: top-row (sidebar+main+chat) | bottom panel
            <ResizablePanelGroup direction="vertical" className="absolute inset-0">
              <ResizablePanel id="top-row" minSize={200}>
                {/* Inner horizontal group: sidebar | main content | chat */}
                <ResizablePanelGroup direction="horizontal">
                  {sidebarOpen && (
                    <>
                      <ResizablePanel id="sidebar" defaultSize={hPx.sidebar} minSize={180}>
                        <PrimarySidebar />
                      </ResizablePanel>
                      <ResizableHandle withHandle />
                    </>
                  )}

                  <ResizablePanel id="content" minSize={300}>
                    <div className="h-full overflow-auto">{children}</div>
                  </ResizablePanel>

                  {chatPanelOpen && (
                    <>
                      <ResizableHandle withHandle />
                      <ResizablePanel id="chat" defaultSize={hPx.chat} minSize={240}>
                        <GlobalChatPanel workspaceId={workspaceId} />
                      </ResizablePanel>
                    </>
                  )}
                </ResizablePanelGroup>
              </ResizablePanel>

              {bottomPanelOpen && (
                <>
                  <ResizableHandle withHandle direction="vertical" />
                  <ResizablePanel id="bottom" defaultSize={vPx.bottom} minSize={100}>
                    <BottomPanel />
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
      <SettingsDialog workspaceId={workspaceId} />
    </div>
  );
}
