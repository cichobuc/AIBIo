'use client';
import { Separator } from '@/core/ui';
import { SettingRow } from '../widgets/SettingRow';
import { SettingRadio } from '../widgets/SettingRadio';
import { SettingSelect } from '../widgets/SettingSelect';
import { SettingNumber } from '../widgets/SettingNumber';
import type { WorkspaceSettingsLocal } from '../SettingsDialog';

interface Props {
  settings: WorkspaceSettingsLocal;
  patch: (field: string, value: unknown, endpoint?: string) => void;
  onUpdate: (field: keyof WorkspaceSettingsLocal, value: unknown) => void;
}

const AI_MODE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'queries', label: 'Queries' },
  { value: 'manual', label: 'Manual' },
];

export function AIBehaviorSection({ settings, patch, onUpdate }: Props) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground mb-4">AI Behavior</h2>
      <Separator className="mb-4" />

      <SettingRow label="Default AI mode" description="Ako supervisor dispatchuje agentov po otvorení workspace.">
        <SettingSelect
          value={settings.aiMode}
          options={AI_MODE_OPTIONS}
          onChange={(v) => {
            onUpdate('aiMode', v);
            patch('aiMode', v, '');
          }}
        />
      </SettingRow>

      <Separator />

      <SettingRow label="Show tool calls in chat" description="Zobrazí rozbaliteľné tool call logy v chat bublinách.">
        <SettingRadio
          name="showToolCalls"
          value={settings.showToolCalls ? 'on' : 'off'}
          options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]}
          onChange={(v) => {
            const val = v === 'on';
            onUpdate('showToolCalls', val);
            patch('showToolCalls', val);
          }}
        />
      </SettingRow>

      <Separator />

      <SettingRow label="Max supervisor turns" description="Hard cap na agentic loop per session." polish>
        <SettingNumber
          value={settings.maxSupervisorTurns}
          min={1}
          max={100}
          suffix="turns"
          onChange={(v) => { onUpdate('maxSupervisorTurns', v); patch('maxSupervisorTurns', v); }}
        />
      </SettingRow>

      <Separator />

      <SettingRow label="Session idle timeout" description="Nečinná session sa ukončí po tomto čase." polish>
        <SettingNumber
          value={settings.sessionTimeoutMin}
          min={1}
          max={1440}
          suffix="min"
          onChange={(v) => { onUpdate('sessionTimeoutMin', v); patch('sessionTimeoutMin', v); }}
        />
      </SettingRow>

      <Separator />

      <SettingRow label="Chat history retention" description="Počet správ zobrazených pri otvorení workspace." polish>
        <SettingNumber
          value={settings.chatHistoryRetentionCount}
          min={10}
          max={1000}
          suffix="messages"
          onChange={(v) => { onUpdate('chatHistoryRetentionCount', v); patch('chatHistoryRetentionCount', v); }}
        />
      </SettingRow>
    </div>
  );
}
