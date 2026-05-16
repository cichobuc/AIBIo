'use client';
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  ScrollArea,
} from '@/core/ui';
import { useWorkspaceStore } from '../../store/workspace-store';
import type { SettingsSection } from '../../store/workspace-store';
import { SettingsSidebar } from './SettingsSidebar';
import { useSettingsPatch } from './useSettingsPatch';
import { AIBehaviorSection } from './sections/AIBehaviorSection';
import { ApprovalGatesSection } from './sections/ApprovalGatesSection';
import type { ApprovalSettingsRow } from '@/modules/ainderstanding/govern/lib/types';
import { DataProfilingSection } from './sections/DataProfilingSection';
import { ModelsSqlSection } from './sections/ModelsSqlSection';
import { DocumentationSection } from './sections/DocumentationSection';
import { TestingSection } from './sections/TestingSection';
import { ConnectionsSection } from './sections/ConnectionsSection';
import { UiUxSection } from './sections/UiUxSection';

export interface WorkspaceSettingsLocal {
  // AI behavior
  aiMode: string;
  showToolCalls: boolean;
  maxSupervisorTurns: number;
  sessionTimeoutMin: number;
  chatHistoryRetentionCount: number;
  // Data & profiling
  autoProfileOnSourceAdd: boolean;
  schemaChangeAutoDetect: boolean;
  piiHeuristicsEnabled: boolean;
  profileSampleThresholdRows: number;
  topValuesPerColumn: number;
  // Models & SQL
  selfHealMaxRetries: number;
  parallelBuildConcurrency: number;
  // Documentation
  autoWriteDocs: boolean;
  docVerbosity: string;
  docConfidenceThreshold: string;
  includeSampleDataInDocs: boolean;
  // Testing
  autoRunTestsAfterMaterialize: boolean;
  aiTestGenerationEnabled: boolean;
  testParallelConcurrency: number;
  testExecutionTimeoutSec: number;
  failingPkSamplesCount: number;
  // Connections
  queryTimeoutSec: number;
}

const DEFAULTS: WorkspaceSettingsLocal = {
  aiMode: 'auto',
  showToolCalls: true,
  maxSupervisorTurns: 20,
  sessionTimeoutMin: 60,
  chatHistoryRetentionCount: 100,
  autoProfileOnSourceAdd: true,
  schemaChangeAutoDetect: true,
  piiHeuristicsEnabled: true,
  profileSampleThresholdRows: 1_000_000,
  topValuesPerColumn: 10,
  selfHealMaxRetries: 3,
  parallelBuildConcurrency: 4,
  autoWriteDocs: true,
  docVerbosity: 'standard',
  docConfidenceThreshold: 'high',
  includeSampleDataInDocs: false,
  autoRunTestsAfterMaterialize: true,
  aiTestGenerationEnabled: true,
  testParallelConcurrency: 8,
  testExecutionTimeoutSec: 30,
  failingPkSamplesCount: 5,
  queryTimeoutSec: 30,
};

interface Props {
  workspaceId: string;
  workspaceName?: string;
}

export function SettingsDialog({ workspaceId, workspaceName }: Props) {
  const settingsOpen = useWorkspaceStore((s) => s.settingsOpen);
  const activeSection = useWorkspaceStore((s) => s.activeSettingsSection);
  const closeSettings = useWorkspaceStore((s) => s.closeSettings);
  const setActiveSection = useWorkspaceStore((s) => s.setActiveSettingsSection);

  const [local, setLocal] = useState<WorkspaceSettingsLocal>(DEFAULTS);
  const [approval, setApproval] = useState<ApprovalSettingsRow | null>(null);
  const [loaded, setLoaded] = useState(false);

  const patch = useSettingsPatch(workspaceId, (field, prev) => {
    setLocal((s) => ({ ...s, [field]: prev }));
  });

  useEffect(() => {
    if (!settingsOpen || loaded) return;

    Promise.all([
      fetch(`/api/workspaces/${workspaceId}/settings`).then((r) => r.json()),
      fetch(`/api/workspaces/${workspaceId}`).then((r) => r.json()),
      fetch(`/api/govern/${workspaceId}`).then((r) => r.json()),
    ]).then(([settingsRes, workspaceRes, governRes]) => {
      const s = (settingsRes as { settings?: Record<string, unknown> }).settings ?? {};
      const w = (workspaceRes as { workspace?: Record<string, unknown> }).workspace ?? {};
      const gs = (governRes as { settings?: ApprovalSettingsRow }).settings ?? null;
      if (gs) setApproval(gs);
      setLocal({
        aiMode: (w.aiMode as string) ?? DEFAULTS.aiMode,
        showToolCalls: (s.showToolCalls as boolean) ?? DEFAULTS.showToolCalls,
        maxSupervisorTurns: (s.maxSupervisorTurns as number) ?? DEFAULTS.maxSupervisorTurns,
        sessionTimeoutMin: (s.sessionTimeoutMin as number) ?? DEFAULTS.sessionTimeoutMin,
        chatHistoryRetentionCount: (s.chatHistoryRetentionCount as number) ?? DEFAULTS.chatHistoryRetentionCount,
        autoProfileOnSourceAdd: (s.autoProfileOnSourceAdd as boolean) ?? DEFAULTS.autoProfileOnSourceAdd,
        schemaChangeAutoDetect: (s.schemaChangeAutoDetect as boolean) ?? DEFAULTS.schemaChangeAutoDetect,
        piiHeuristicsEnabled: (s.piiHeuristicsEnabled as boolean) ?? DEFAULTS.piiHeuristicsEnabled,
        profileSampleThresholdRows: (s.profileSampleThresholdRows as number) ?? DEFAULTS.profileSampleThresholdRows,
        topValuesPerColumn: (s.topValuesPerColumn as number) ?? DEFAULTS.topValuesPerColumn,
        selfHealMaxRetries: (s.selfHealMaxRetries as number) ?? DEFAULTS.selfHealMaxRetries,
        parallelBuildConcurrency: (s.parallelBuildConcurrency as number) ?? DEFAULTS.parallelBuildConcurrency,
        autoWriteDocs: (s.autoWriteDocs as boolean) ?? DEFAULTS.autoWriteDocs,
        docVerbosity: (s.docVerbosity as string) ?? DEFAULTS.docVerbosity,
        docConfidenceThreshold: (s.docConfidenceThreshold as string) ?? DEFAULTS.docConfidenceThreshold,
        includeSampleDataInDocs: (s.includeSampleDataInDocs as boolean) ?? DEFAULTS.includeSampleDataInDocs,
        autoRunTestsAfterMaterialize: (s.autoRunTestsAfterMaterialize as boolean) ?? DEFAULTS.autoRunTestsAfterMaterialize,
        aiTestGenerationEnabled: (s.aiTestGenerationEnabled as boolean) ?? DEFAULTS.aiTestGenerationEnabled,
        testParallelConcurrency: (s.testParallelConcurrency as number) ?? DEFAULTS.testParallelConcurrency,
        testExecutionTimeoutSec: (s.testExecutionTimeoutSec as number) ?? DEFAULTS.testExecutionTimeoutSec,
        failingPkSamplesCount: (s.failingPkSamplesCount as number) ?? DEFAULTS.failingPkSamplesCount,
        queryTimeoutSec: (s.queryTimeoutSec as number) ?? DEFAULTS.queryTimeoutSec,
      });
      setLoaded(true);
    });
  }, [settingsOpen, loaded, workspaceId]);

  function update(field: keyof WorkspaceSettingsLocal, value: unknown) {
    setLocal((s) => ({ ...s, [field]: value }));
  }

  function renderSection(section: SettingsSection) {
    if (!loaded) {
      return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading...</div>;
    }
    switch (section) {
      case 'ai-behavior':
        return <AIBehaviorSection settings={local} patch={patch} onUpdate={update} />;
      case 'approval-gates':
        return (
          <ApprovalGatesSection
            workspaceId={workspaceId}
            settings={approval}
            onUpdate={setApproval}
            piiHeuristicsEnabled={local.piiHeuristicsEnabled}
            onPiiToggle={(v) => {
              update('piiHeuristicsEnabled', v);
              patch('piiHeuristicsEnabled', v);
            }}
          />
        );
      case 'data-profiling':
        return <DataProfilingSection settings={local} patch={patch} onUpdate={update} />;
      case 'models-sql':
        return <ModelsSqlSection settings={local} patch={patch} onUpdate={update} />;
      case 'documentation':
        return <DocumentationSection settings={local} patch={patch} onUpdate={update} />;
      case 'testing':
        return <TestingSection settings={local} patch={patch} onUpdate={update} />;
      case 'connections':
        return <ConnectionsSection settings={local} patch={patch} onUpdate={update} />;
      case 'ui-ux':
        return <UiUxSection />;
    }
  }

  return (
    <Dialog open={settingsOpen} onOpenChange={(open) => { if (!open) closeSettings(); }}>
      <DialogContent className="max-w-[860px] h-[580px] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogTitle className="text-sm font-semibold">
            Settings{workspaceName ? ` — ${workspaceName}` : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          <SettingsSidebar active={activeSection} onSelect={setActiveSection} />
          <ScrollArea className="flex-1">
            <div className="px-6 py-4">
              {renderSection(activeSection)}
            </div>
          </ScrollArea>
        </div>

        <div className="shrink-0 border-t border-border px-6 py-2 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          <span className="text-xs text-muted-foreground">Changes saved automatically</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
