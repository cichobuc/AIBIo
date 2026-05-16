'use client';
import { Separator } from '@/core/ui';
import { SettingRow } from '../widgets/SettingRow';
import { SettingNumber } from '../widgets/SettingNumber';
import type { WorkspaceSettingsLocal } from '../SettingsDialog';

interface Props {
  settings: WorkspaceSettingsLocal;
  patch: (field: string, value: unknown) => void;
  onUpdate: (field: keyof WorkspaceSettingsLocal, value: unknown) => void;
}

export function ModelsSqlSection({ settings, patch, onUpdate }: Props) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground mb-4">Models & SQL</h2>
      <Separator className="mb-4" />

      <SettingRow label="Self-heal retries" description="Maximálny počet automatických opráv po SQL build chybe. 0 = self-heal vypnutý.">
        <SettingNumber
          value={settings.selfHealMaxRetries}
          min={0}
          max={10}
          suffix="retries"
          onChange={(v) => { onUpdate('selfHealMaxRetries', v); patch('selfHealMaxRetries', v); }}
        />
      </SettingRow>

      <Separator />

      <SettingRow label="Parallel build concurrency" description="Počet modelov budovaných súčasne.">
        <SettingNumber
          value={settings.parallelBuildConcurrency}
          min={1}
          max={16}
          suffix="models"
          onChange={(v) => { onUpdate('parallelBuildConcurrency', v); patch('parallelBuildConcurrency', v); }}
        />
      </SettingRow>
    </div>
  );
}
