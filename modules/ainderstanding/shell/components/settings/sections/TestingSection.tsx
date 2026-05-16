'use client';
import { Separator } from '@/core/ui';
import { SettingRow } from '../widgets/SettingRow';
import { SettingRadio } from '../widgets/SettingRadio';
import { SettingNumber } from '../widgets/SettingNumber';
import type { WorkspaceSettingsLocal } from '../SettingsDialog';

interface Props {
  settings: WorkspaceSettingsLocal;
  patch: (field: string, value: unknown) => void;
  onUpdate: (field: keyof WorkspaceSettingsLocal, value: unknown) => void;
}

export function TestingSection({ settings, patch, onUpdate }: Props) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground mb-4">Testing</h2>
      <Separator className="mb-4" />

      <SettingRow label="Auto-run tests after materialize" description="Spustí test suite automaticky po každom úspešnom model build.">
        <SettingRadio
          name="autoRunTests"
          value={settings.autoRunTestsAfterMaterialize ? 'on' : 'off'}
          options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]}
          onChange={(v) => { const val = v === 'on'; onUpdate('autoRunTestsAfterMaterialize', val); patch('autoRunTestsAfterMaterialize', val); }}
        />
      </SettingRow>

      <Separator />

      <SettingRow label="AI test generation" description="Povolí ai-test-generator subagenta navrhovať nové testy.">
        <SettingRadio
          name="aiTestGeneration"
          value={settings.aiTestGenerationEnabled ? 'on' : 'off'}
          options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]}
          onChange={(v) => { const val = v === 'on'; onUpdate('aiTestGenerationEnabled', val); patch('aiTestGenerationEnabled', val); }}
        />
      </SettingRow>

      <Separator />

      <SettingRow label="Test parallel concurrency" description="Počet testov spúšťaných súčasne." polish>
        <SettingNumber
          value={settings.testParallelConcurrency}
          min={1}
          max={32}
          suffix="tests"
          onChange={(v) => { onUpdate('testParallelConcurrency', v); patch('testParallelConcurrency', v); }}
        />
      </SettingRow>

      <Separator />

      <SettingRow label="Test execution timeout" description="" polish>
        <SettingNumber
          value={settings.testExecutionTimeoutSec}
          min={1}
          max={300}
          suffix="sec per test"
          onChange={(v) => { onUpdate('testExecutionTimeoutSec', v); patch('testExecutionTimeoutSec', v); }}
        />
      </SettingRow>

      <Separator />

      <SettingRow label="Failing PK samples" description="Počet failing primary key hodnôt zobrazených v test result detaile." polish>
        <SettingNumber
          value={settings.failingPkSamplesCount}
          min={0}
          max={50}
          suffix="rows"
          onChange={(v) => { onUpdate('failingPkSamplesCount', v); patch('failingPkSamplesCount', v); }}
        />
      </SettingRow>
    </div>
  );
}
