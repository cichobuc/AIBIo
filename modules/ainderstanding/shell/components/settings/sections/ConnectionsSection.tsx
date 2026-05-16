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

export function ConnectionsSection({ settings, patch, onUpdate }: Props) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground mb-4">Connections</h2>
      <Separator className="mb-4" />

      <SettingRow label="Default query timeout" description="Workspace-wide fallback. Per-source override v Connect → source detail.">
        <SettingNumber
          value={settings.queryTimeoutSec}
          min={1}
          max={600}
          suffix="sec"
          onChange={(v) => { onUpdate('queryTimeoutSec', v); patch('queryTimeoutSec', v); }}
        />
      </SettingRow>

      <div className="mt-4 rounded-md bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
        Connection credentials (host, port, user, password) sa editujú priamo v Connect module → source detail → Edit connection. Tu sú len workspace-wide defaults.
      </div>
    </div>
  );
}
