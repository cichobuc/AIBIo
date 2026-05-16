'use client';
import { Separator } from '@/core/ui';
import { SettingRow } from '../widgets/SettingRow';
import { SettingRadio } from '../widgets/SettingRadio';
import { SettingSelect } from '../widgets/SettingSelect';
import type { WorkspaceSettingsLocal } from '../SettingsDialog';

interface Props {
  settings: WorkspaceSettingsLocal;
  patch: (field: string, value: unknown) => void;
  onUpdate: (field: keyof WorkspaceSettingsLocal, value: unknown) => void;
}

const CONFIDENCE_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const VERBOSITY_OPTIONS = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'standard', label: 'Standard' },
  { value: 'detailed', label: 'Detailed' },
];

export function DocumentationSection({ settings, patch, onUpdate }: Props) {
  const sampleValue = settings.includeSampleDataInDocs ? 'yes' : 'no';

  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground mb-4">Documentation</h2>
      <Separator className="mb-4" />

      <SettingRow label="Auto-write docs" description="Uloží AI-navrhnutú dokumentáciu automaticky ak spĺňa confidence threshold.">
        <SettingRadio
          name="autoWriteDocs"
          value={settings.autoWriteDocs ? 'on' : 'off'}
          options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]}
          onChange={(v) => { const val = v === 'on'; onUpdate('autoWriteDocs', val); patch('autoWriteDocs', val); }}
        />
      </SettingRow>

      <Separator />

      <SettingRow label="Include sample data in docs" description="Či doc záznamy môžu obsahovať vzorové riadky z tabuľky.">
        <SettingRadio
          name="includeSampleDataInDocs"
          value={sampleValue}
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]}
          onChange={(v) => { const val = v === 'yes'; onUpdate('includeSampleDataInDocs', val); patch('includeSampleDataInDocs', val); }}
        />
      </SettingRow>

      <Separator />

      <SettingRow label="Doc confidence threshold" description="Minimálna dôvera AI aby sa doc uložil bez approval (ak auto-write On).">
        <SettingSelect
          value={settings.docConfidenceThreshold}
          options={CONFIDENCE_OPTIONS}
          onChange={(v) => { onUpdate('docConfidenceThreshold', v); patch('docConfidenceThreshold', v); }}
        />
      </SettingRow>

      <Separator />

      <SettingRow label="Doc verbosity" description="Miera detailu generovaných doc záznamov.">
        <SettingSelect
          value={settings.docVerbosity}
          options={VERBOSITY_OPTIONS}
          onChange={(v) => { onUpdate('docVerbosity', v); patch('docVerbosity', v); }}
        />
      </SettingRow>
    </div>
  );
}
