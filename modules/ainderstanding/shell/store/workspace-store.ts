'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AIMode } from '@/core/types/agent';
import type { SSEEvent } from '@/core/orchestration/streaming';

type PendingApproval = Extract<SSEEvent, { type: 'approval_required' }>['payload'];

type ActiveAgent = { agentName: string; message: string };

export type BottomPanelTab = 'output' | 'sql' | 'results' | 'approvals';

export type SettingsSection =
  | 'ai-behavior'
  | 'approval-gates'
  | 'data-profiling'
  | 'models-sql'
  | 'documentation'
  | 'testing'
  | 'connections'
  | 'ui-ux';

interface WorkspaceState {
  workspaceId: string;
  aiMode: AIMode;
  isSessionActive: boolean;
  sessionId: string | null;

  sidebarOpen: boolean;
  chatPanelOpen: boolean;
  bottomPanelOpen: boolean;
  bottomPanelTab: BottomPanelTab;

  settingsOpen: boolean;
  activeSettingsSection: SettingsSection;

  pendingApproval: PendingApproval | null;
  activeAgents: ActiveAgent[];
  messages: SSEEvent[];
}

interface WorkspaceActions {
  init: (workspaceId: string) => void;
  setAiMode: (mode: AIMode) => void;
  setSession: (active: boolean, sessionId?: string) => void;

  toggleSidebar: () => void;
  toggleChatPanel: () => void;
  toggleBottomPanel: () => void;
  setSidebarOpen: (open: boolean) => void;
  setChatPanelOpen: (open: boolean) => void;
  setBottomPanelOpen: (open: boolean) => void;
  setBottomPanelTab: (tab: BottomPanelTab) => void;

  openSettings: (section?: SettingsSection) => void;
  closeSettings: () => void;
  setActiveSettingsSection: (section: SettingsSection) => void;

  setPendingApproval: (approval: PendingApproval | null) => void;
  addActiveAgent: (agent: ActiveAgent) => void;
  removeActiveAgent: (agentName: string) => void;
  addMessage: (event: SSEEvent) => void;
  clearMessages: () => void;
}

type WorkspaceStore = WorkspaceState & WorkspaceActions;

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set) => ({
      workspaceId: '',
      aiMode: 'auto',
      isSessionActive: false,
      sessionId: null,

      sidebarOpen: true,
      chatPanelOpen: true,
      bottomPanelOpen: false,
      bottomPanelTab: 'output',

      settingsOpen: false,
      activeSettingsSection: 'ai-behavior',

      pendingApproval: null,
      activeAgents: [],
      messages: [],

      init: (workspaceId) => set({ workspaceId, messages: [], activeAgents: [], isSessionActive: false }),
      setAiMode: (aiMode) => set({ aiMode }),
      setSession: (active, sessionId) => set({ isSessionActive: active, sessionId: sessionId ?? null }),

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleChatPanel: () => set((s) => ({ chatPanelOpen: !s.chatPanelOpen })),
      toggleBottomPanel: () => set((s) => ({ bottomPanelOpen: !s.bottomPanelOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setChatPanelOpen: (open) => set({ chatPanelOpen: open }),
      setBottomPanelOpen: (open) => set({ bottomPanelOpen: open }),
      setBottomPanelTab: (tab) => set({ bottomPanelTab: tab }),

      openSettings: (section) => set({ settingsOpen: true, activeSettingsSection: section ?? 'ai-behavior' }),
      closeSettings: () => set({ settingsOpen: false }),
      setActiveSettingsSection: (section) => set({ activeSettingsSection: section }),

      setPendingApproval: (approval) => set({ pendingApproval: approval }),
      addActiveAgent: (agent) =>
        set((s) => {
          const existing = s.activeAgents.find((a) => a.agentName === agent.agentName);
          if (existing) {
            return { activeAgents: s.activeAgents.map((a) => (a.agentName === agent.agentName ? agent : a)) };
          }
          return { activeAgents: [...s.activeAgents, agent] };
        }),
      removeActiveAgent: (agentName) =>
        set((s) => ({ activeAgents: s.activeAgents.filter((a) => a.agentName !== agentName) })),
      addMessage: (event) => set((s) => ({ messages: [...s.messages.slice(-200), event] })),
      clearMessages: () => set({ messages: [] }),
    }),
    {
      name: 'aibio-workspace',
      partialize: (state) => ({
        aiMode: state.aiMode,
        sidebarOpen: state.sidebarOpen,
        chatPanelOpen: state.chatPanelOpen,
        bottomPanelOpen: state.bottomPanelOpen,
        bottomPanelTab: state.bottomPanelTab,
      }),
    },
  ),
);
