'use client';

import { useEffect } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { useRouter } from 'next/navigation';

const MODULE_ORDER = ['connect', 'explore', 'govern', 'model', 'document', 'test', 'export'];

export function useKeyboardShortcuts(workspaceId: string) {
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);
  const toggleChatPanel = useWorkspaceStore((s) => s.toggleChatPanel);
  const toggleBottomPanel = useWorkspaceStore((s) => s.toggleBottomPanel);
  const router = useRouter();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      const shift = e.shiftKey;

      if (meta && !shift && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
        return;
      }
      if (meta && shift && e.key === 'A') {
        e.preventDefault();
        toggleChatPanel();
        return;
      }
      if (meta && !shift && e.key === 'j') {
        e.preventDefault();
        toggleBottomPanel();
        return;
      }

      // ⌘1–⌘7 module navigation
      if (meta && !shift) {
        const idx = parseInt(e.key, 10);
        if (idx >= 1 && idx <= 7) {
          const mod = MODULE_ORDER[idx - 1];
          if (mod) {
            e.preventDefault();
            router.push(`/workspace/${workspaceId}/${mod}`);
          }
        }
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [workspaceId, toggleSidebar, toggleChatPanel, toggleBottomPanel, router]);
}
