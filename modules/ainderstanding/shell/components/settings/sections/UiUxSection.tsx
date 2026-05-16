'use client';
import { PanelLeft, PanelBottom, PanelRight } from 'lucide-react';
import { Kbd, Separator } from '@/core/ui';
import { useWorkspaceStore } from '../../../store/workspace-store';
import { SettingRow } from '../widgets/SettingRow';
import { SettingRadio } from '../widgets/SettingRadio';
import { SettingSwitch } from '../widgets/SettingSwitch';

export function UiUxSection() {
  const sidebarOpen = useWorkspaceStore((s) => s.sidebarOpen);
  const setSidebarOpen = useWorkspaceStore((s) => s.setSidebarOpen);
  const bottomPanelOpen = useWorkspaceStore((s) => s.bottomPanelOpen);
  const setBottomPanelOpen = useWorkspaceStore((s) => s.setBottomPanelOpen);
  const chatPanelOpen = useWorkspaceStore((s) => s.chatPanelOpen);
  const setChatPanelOpen = useWorkspaceStore((s) => s.setChatPanelOpen);

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

      <Separator className="my-2" />

      <h3 className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Panely</h3>

      <SettingRow
        icon={<PanelLeft className="h-4 w-4" />}
        label="Primary Sidebar"
        description={<>Ľavý panel s modulmi a navigáciou. Skratka: <Kbd>⌘B</Kbd></>}
      >
        <SettingSwitch checked={sidebarOpen} onChange={setSidebarOpen} aria-label="Primary Sidebar" />
      </SettingRow>

      <SettingRow
        icon={<PanelBottom className="h-4 w-4" />}
        label="Output Panel"
        description={<>Spodný panel: Output, SQL, Results, Approvals. Skratka: <Kbd>⌘J</Kbd></>}
      >
        <SettingSwitch checked={bottomPanelOpen} onChange={setBottomPanelOpen} aria-label="Output Panel" />
      </SettingRow>

      <SettingRow
        icon={<PanelRight className="h-4 w-4" />}
        label="Chat Panel"
        description={<>Pravý AI chat panel s konverzáciou a kontextom. Skratka: <Kbd>⌘\</Kbd></>}
      >
        <SettingSwitch checked={chatPanelOpen} onChange={setChatPanelOpen} aria-label="Chat Panel" />
      </SettingRow>

      <Separator className="mt-2" />

      <div className="mt-4 rounded-md bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
        Panel sizes (sidebar, AI chat panel, bottom panel) sa ukladajú automaticky do localStorage pri každom resize. Resetovať rozloženie: User menu (avatar) → Reset layout.
      </div>
    </div>
  );
}
