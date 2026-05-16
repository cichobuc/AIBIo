'use client';
import { Separator } from '@/core/ui';
import { SettingRow } from '../widgets/SettingRow';
import { SettingRadio } from '../widgets/SettingRadio';

export function UiUxSection() {
  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground mb-4">UI / UX</h2>
      <Separator className="mb-4" />

      <SettingRow label="Dark mode" description="Aplikácia je primárne dark-mode. Light mode je post-MVP.">
        <SettingRadio
          name="darkMode"
          value="dark"
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light', disabled: true },
          ]}
          disabled
          onChange={() => {}}
        />
      </SettingRow>

      <Separator />

      <div className="mt-4 rounded-md bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
        Panel sizes (sidebar, AI chat panel, bottom panel) sa ukladajú automaticky do localStorage pri každom resize. Resetovať rozloženie: User menu (avatar) → Reset layout.
      </div>
    </div>
  );
}
