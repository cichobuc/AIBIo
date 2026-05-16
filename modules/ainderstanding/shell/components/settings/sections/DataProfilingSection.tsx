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

export function DataProfilingSection({ settings, patch, onUpdate }: Props) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground mb-4">Data & Profiling</h2>
      <Separator className="mb-4" />

      <SettingRow label="Auto-profile on source add" description="Automaticky spustí profiling všetkých tabuliek po pridaní zdroja.">
        <SettingRadio
          name="autoProfileOnSourceAdd"
          value={settings.autoProfileOnSourceAdd ? 'on' : 'off'}
          options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]}
          onChange={(v) => { const val = v === 'on'; onUpdate('autoProfileOnSourceAdd', val); patch('autoProfileOnSourceAdd', val); }}
        />
      </SettingRow>

      <Separator />

      <SettingRow label="Schema change auto-detect" description="Sleduje zmeny schémy (nové/zmazané stĺpce) pri každom refreshi.">
        <SettingRadio
          name="schemaChangeAutoDetect"
          value={settings.schemaChangeAutoDetect ? 'on' : 'off'}
          options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]}
          onChange={(v) => { const val = v === 'on'; onUpdate('schemaChangeAutoDetect', val); patch('schemaChangeAutoDetect', val); }}
        />
      </SettingRow>

      <Separator />

      <SettingRow label="PII heuristics" description="Automaticky navrhuje PII kandidátov na základe názvov a typov stĺpcov.">
        <SettingRadio
          name="piiHeuristics"
          value={settings.piiHeuristicsEnabled ? 'on' : 'off'}
          options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]}
          onChange={(v) => { const val = v === 'on'; onUpdate('piiHeuristicsEnabled', val); patch('piiHeuristicsEnabled', val); }}
        />
      </SettingRow>

      <Separator />

      <SettingRow label="Profile sample threshold" description="Tabuľky nad tento limit sa profilujú na vzorke namiesto full scan." polish>
        <SettingNumber
          value={settings.profileSampleThresholdRows}
          min={1000}
          max={100_000_000}
          suffix="rows"
          onChange={(v) => { onUpdate('profileSampleThresholdRows', v); patch('profileSampleThresholdRows', v); }}
        />
      </SettingRow>

      <Separator />

      <SettingRow label="Top values per column" description="Počet najpočetnejších hodnôt uchovávaných v profile." polish>
        <SettingNumber
          value={settings.topValuesPerColumn}
          min={1}
          max={100}
          suffix="values"
          onChange={(v) => { onUpdate('topValuesPerColumn', v); patch('topValuesPerColumn', v); }}
        />
      </SettingRow>
    </div>
  );
}
