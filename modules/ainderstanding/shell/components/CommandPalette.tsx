'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
  Kbd,
} from '@/core/ui';

const MODULES = [
  { key: 'connect', label: 'Go to Connect', shortcut: '⌘1' },
  { key: 'explore', label: 'Go to Explore', shortcut: '⌘2' },
  { key: 'govern', label: 'Go to Govern', shortcut: '⌘3' },
  { key: 'model', label: 'Go to Model', shortcut: '⌘4' },
  { key: 'document', label: 'Go to Document', shortcut: '⌘5' },
  { key: 'test', label: 'Go to Test', shortcut: '⌘6' },
  { key: 'export', label: 'Go to Export', shortcut: '⌘7' },
];

const AI_COMMANDS = [
  { key: 'mode', label: 'Switch AI mode...' },
  { key: 'context', label: 'Add to AI context...', shortcut: '⌘⇧C' },
  { key: 'stop', label: 'Stop current agent', shortcut: '⌘.' },
  { key: 'clear-context', label: 'Clear AI context' },
];

const ACTIONS = [
  { key: 'add-source', label: 'Add data source' },
  { key: 'build-all', label: 'Build all models', shortcut: '⌘⇧B' },
  { key: 'run-tests', label: 'Run all tests', shortcut: '⌘⇧T' },
  { key: 'export', label: 'Export workspace' },
  { key: 'settings', label: 'Open settings', shortcut: '⌘,' },
];

export function CommandPalette({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  function navigate(module: string) {
    router.push(`/workspace/${workspaceId}/${module}`);
    setOpen(false);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          {MODULES.map((mod) => (
            <CommandItem key={mod.key} onSelect={() => navigate(mod.key)}>
              <span>{mod.label}</span>
              {mod.shortcut && <CommandShortcut>{mod.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="AI">
          {AI_COMMANDS.map((cmd) => (
            <CommandItem key={cmd.key} onSelect={() => setOpen(false)}>
              <span>{cmd.label}</span>
              {cmd.shortcut && <CommandShortcut>{cmd.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          {ACTIONS.map((action) => (
            <CommandItem key={action.key} onSelect={() => setOpen(false)}>
              <span>{action.label}</span>
              {action.shortcut && <CommandShortcut>{action.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
