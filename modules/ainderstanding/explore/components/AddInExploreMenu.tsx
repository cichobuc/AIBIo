'use client';

import { Plus, Database, Code2 } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/core/ui';

type Props = {
  onAddConnection: () => void;
  onNewQuery: () => void;
};

export function AddInExploreMenu({ onAddConnection, onNewQuery }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6" title="Add…">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={onAddConnection} className="text-xs gap-2">
          <Database className="h-3.5 w-3.5" />
          Add Connection
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onNewQuery} className="text-xs gap-2">
          <Code2 className="h-3.5 w-3.5" />
          New Query
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
