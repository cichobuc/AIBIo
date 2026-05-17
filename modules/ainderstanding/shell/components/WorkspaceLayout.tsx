'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/core/ui';
import { cn } from '@/core/ui';
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
import { ModuleTabBar } from './ModuleTabBar';

export function WorkspaceLayout({
  workspaceId,
  children,
  sidebar,
}: {
  workspaceId: string;
  children: React.ReactNode;
  sidebar?: React.ReactNode;
}) {
  const init = useWorkspaceStore((s) => s.init);
  const sidebarOpen = useWorkspaceStore((s) => s.sidebarOpen);
  const chatPanelOpen = useWorkspaceStore((s) => s.chatPanelOpen);
  const bottomPanelOpen = useWorkspaceStore((s) => s.bottomPanelOpen);

  const pathname = usePathname();
  const router = useRouter();

  const activeModule = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    const wsIdx = segments.findIndex((s) => s === workspaceId);
    return segments[wsIdx + 1] ?? '';
  }, [pathname, workspaceId]);

  // Cache rendered panels by module — never unmounted while open
  const panelCacheRef = useRef<Map<string, React.ReactNode>>(new Map());
  panelCacheRef.current.set(activeModule, children);

  const [openModules, setOpenModules] = useState<string[]>(() =>
    activeModule ? [activeModule] : [],
  );

  // Add new module to open list before paint to avoid flash
  useLayoutEffect(() => {
    if (!activeModule) return;
    setOpenModules((prev) => (prev.includes(activeModule) ? prev : [...prev, activeModule]));
  }, [activeModule]);

  const closeModule = useCallback(
    (mod: string) => {
      panelCacheRef.current.delete(mod);
      setOpenModules((prev) => {
        const remaining = prev.filter((m) => m !== mod);
        if (mod === activeModule && remaining.length > 0) {
          router.push(`/workspace/${workspaceId}/${remaining[remaining.length - 1]}`);
        }
        return remaining;
      });
    },
    [activeModule, workspaceId, router],
  );

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
                        <PrimarySidebar>{sidebar}</PrimarySidebar>
                      </ResizablePanel>
                      <ResizableHandle withHandle />
                    </>
                  )}

                  <ResizablePanel id="content" minSize={300}>
                    <div className="flex h-full flex-col">
                      <ModuleTabBar
                        openModules={openModules}
                        activeModule={activeModule}
                        workspaceId={workspaceId}
                        onClose={closeModule}
                      />
                      <div className="relative min-h-0 flex-1">
                        {openModules.map((mod) => (
                          <div
                            key={mod}
                            className={cn(
                              'absolute inset-0 overflow-auto',
                              mod !== activeModule && 'hidden',
                            )}
                          >
                            {panelCacheRef.current.get(mod)}
                          </div>
                        ))}
                      </div>
                    </div>
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
